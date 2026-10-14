import { z } from 'zod';
import QRCode from 'qrcode';
import * as catalog from '../catalog';
import {imageForEntity} from '../image-assets';
import {catalogDisplayRecord} from '../catalog-copy';
import { emailPolicy, requireUser } from './auth';
import { ApiError, liqpaySignature, localRequest, now, safeEqual, uuid } from './security';
import { audit, db, outbox, row, run, settings, statement } from './store';
import { encryptionAvailable, methodRoutes, paySaved, rejectRawCardData, saveCallbackMethod } from './payment-methods';

interface Order {id:string;user_id:string;plan_id:string;club_id:string;plan_name:string;amount:number;currency:string;duration:number;status:string;created_at:string;save_card:number;card_token_saved:number;checkout_issued:number;}
const paymentSummary=(value:unknown)=>{const v=value as Record<string,unknown>;return Object.fromEntries(['order_id','payment_id','status','amount','currency','version','action','test'].filter(k=>k in v).map(k=>[k,v[k]]));};
export const camel = (entry:Record<string,unknown>) => Object.fromEntries(Object.entries(entry).map(([k,v])=>[k.replace(/_([a-z])/g,(_,c)=>c.toUpperCase()),k==='is_demo'?!!v:['profile','exercises','detail','data'].includes(k)&&typeof v==='string'?JSON.parse(v):v]));
let catalogSeed:Promise<void>|null=null;
let classSeed:Promise<void>|null=null;
let classSeedDate='';
export async function ensureCatalogSeed() {
 if(!catalogSeed)catalogSeed=(async()=>{
  if(await row('SELECT id FROM content WHERE id=\'__meta:catalog-seed:v1\''))return;
  const source=catalog as unknown as Record<string,unknown>;
  const statements=[];
  for(const kind of ['cities','clubs','trainers','exercises','workouts','programs','recipes','articles','plans'])for(const item of source[kind] as Record<string,unknown>[])statements.push(statement('INSERT OR IGNORE INTO content (id,kind,data,updated_at) VALUES (?,?,?,?)',[`${kind}:${item.id}`,kind,JSON.stringify(item),now()]));
  for(let offset=0;offset<statements.length;offset+=50)await db().batch(statements.slice(offset,offset+50));
  await run('INSERT OR IGNORE INTO content (id,kind,data,updated_at) VALUES (\'__meta:catalog-seed:v1\',\'__meta\',\'{"version":1}\',?)',[now()]);
 })().catch(error=>{catalogSeed=null;throw error;});
 await catalogSeed;
 const date=now().slice(0,10);const marker=`__meta:classes:${date}`;
 if(classSeedDate!==date){classSeedDate=date;classSeed=(async()=>{if(await row('SELECT id FROM content WHERE id=?',[marker]))return;
  const statements=catalog.buildClasses().map(item=>statement('INSERT OR IGNORE INTO content (id,kind,data,updated_at) VALUES (?,\'classes\',?,?)',[`classes:${item.id}`,JSON.stringify(item),now()]));
  for(let offset=0;offset<statements.length;offset+=50)await db().batch(statements.slice(offset,offset+50));
  await run('INSERT OR IGNORE INTO content (id,kind,data,updated_at) VALUES (?,\'__meta\',\'{"version":1}\',?)',[marker,now()]);
 })().catch(error=>{classSeedDate='';throw error;});}await classSeed;
}
export async function catalogItems(kind:string) { await ensureCatalogSeed(); const entries=(await db().prepare(`SELECT data FROM content WHERE kind=? AND COALESCE(json_extract(data,'$.deleted'),0)!=1${kind==='classes'?" AND json_extract(data,'$.startsAt')>=?":''}`).bind(...(kind==='classes'?[kind,now().slice(0,10)]:[kind])).all<{data:string}>()).results;return entries.map(v=>{const item=catalogDisplayRecord(JSON.parse(v.data) as Record<string,unknown>);if(typeof item.image==='string')item.image=imageForEntity(item);return item;}); }
export function paymentEnvironment(request:Request) { const e=settings();const providerReady=!!(e.LIQPAY_PUBLIC_KEY&&e.LIQPAY_PRIVATE_KEY);return {demoAllowed:localRequest(request)&&e.ALLOW_DEMO_PAYMENTS==='true',providerReady,saveCardAvailable:providerReady&&encryptionAvailable()&&!!e.APP_URL?.startsWith('https://'),provider:'liqpay',currency:'UAH'}; }
async function completePayment(order:Order,provider:string,providerId:string,payload:unknown) {
 const existing=await row<{order_id:string}>('SELECT order_id FROM payments WHERE provider_id=?',[`${provider}:${providerId}`]); if(existing&&existing.order_id!==order.id) throw new ApiError(409,'Платіж уже належить іншому замовленню.'); if(!['pending','paid'].includes(order.status)) throw new ApiError(409,'Замовлення закрите.');
 const date=now(),ends=new Date(Date.now()+order.duration*86400000).toISOString();
 await db().batch([
  statement('INSERT OR IGNORE INTO payments (id,order_id,provider,provider_id,amount,status,payload,created_at) VALUES (?,?,?,?,?,\'success\',?,?)',[uuid(),order.id,provider,`${provider}:${providerId}`,order.amount,JSON.stringify(paymentSummary(payload)),date]),
  statement('UPDATE orders SET status=\'paid\' WHERE id=? AND status=\'pending\' AND EXISTS(SELECT 1 FROM payments WHERE provider_id=? AND order_id=orders.id AND status=\'success\')',[order.id,`${provider}:${providerId}`]),
  statement('INSERT OR IGNORE INTO memberships (id,order_id,user_id,club_id,plan_name,starts_at,ends_at,status,card_code,created_at) SELECT ?,id,user_id,club_id,plan_name,?,?,\'active\',?,? FROM orders WHERE id=? AND status=\'paid\'',[uuid(),date,ends,uuid(),date,order.id]),
  statement('UPDATE leads SET status=\'WON\' WHERE user_id=? AND kind=\'registration\' AND EXISTS(SELECT 1 FROM orders WHERE id=? AND status=\'paid\')',[order.user_id,order.id]),
  statement('INSERT OR IGNORE INTO notifications (id,user_id,title,message,event_key,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM orders WHERE id=? AND status=\'paid\')',[uuid(),order.user_id,'Абонемент активовано',`${order.plan_name}. Діє до ${ends.slice(0,10)}.`,`${order.id}:activated`,date,order.id]),
  statement('INSERT OR IGNORE INTO outbox (id,user_id,channel,recipient,subject,body,event_key,created_at) SELECT ?,id,\'email\',email,?,?,?,? FROM users WHERE id=? AND EXISTS(SELECT 1 FROM orders WHERE id=? AND status=\'paid\')',[uuid(),'Абонемент SYNKRA активовано',`Замовлення ${order.id}. ${order.plan_name}. Діє до ${ends.slice(0,10)}.`,`${order.id}:email`,date,order.user_id,order.id]),
 ]);
 if((await row<{status:string}>('SELECT status FROM orders WHERE id=?',[order.id]))?.status!=='paid')throw new ApiError(409,'Платіж уже використаний іншим замовленням.');
 const user=await row<{telegram_chat_id:string|null}>('SELECT telegram_chat_id FROM users WHERE id=?',[order.user_id]); if(user?.telegram_chat_id) await outbox(order.user_id,'telegram',user.telegram_chat_id,'Абонемент активовано',order.plan_name,`${order.id}:telegram`);
 if(!existing) await audit(order.user_id,'PAYMENT_CONFIRMED',order.id,{provider,amount:order.amount});
}
export async function paymentWebhook(request:Request) {
 const e=settings(); if(!e.LIQPAY_PRIVATE_KEY||!e.LIQPAY_PUBLIC_KEY) throw new ApiError(503,'Платіжний провайдер не налаштований.');
 const form=await request.formData(); const data=String(form.get('data')??''),signature=String(form.get('signature')??''); if(!data||data.length>32000||!safeEqual(liqpaySignature(data,e.LIQPAY_PRIVATE_KEY,e.LIQPAY_VERSION??'7'),signature)) throw new ApiError(401,'Невірний підпис платежу.');
 let v:Record<string,unknown>; try{v=JSON.parse(Buffer.from(data,'base64').toString('utf8'));}catch{throw new ApiError(400,'Некоректний платіж.');}
 rejectRawCardData(v,true);
 const order=await row<Order>('SELECT * FROM orders WHERE id=?',[v.order_id]); if(!order) throw new ApiError(404,'Замовлення не знайдено.');
 if(v.public_key!==e.LIQPAY_PUBLIC_KEY||v.currency!=='UAH'||Math.round(Number(v.amount)*100)!==order.amount||!['pay','paytoken'].includes(String(v.action))||Number(v.version)!==Number(e.LIQPAY_VERSION??'7')) throw new ApiError(400,'Сума або реквізити платежу не збігаються.');
 if(v.action==='paytoken'&&!await row('SELECT order_id FROM payment_attempts WHERE order_id=?',[order.id]))throw new ApiError(400,'Для замовлення не було запиту оплати токеном.');
 if(v.status==='success') { if(v.sandbox===1||v.sandbox==='1') throw new ApiError(400,'Sandbox-платіж не є реальною оплатою.'); if(!v.payment_id) throw new ApiError(400,'Відсутній ідентифікатор платежу.'); await completePayment(order,'liqpay',String(v.payment_id),v);await saveCallbackMethod(order,v);await run('UPDATE payment_attempts SET status=\'confirmed\' WHERE order_id=?',[order.id]); }
 else if(['failure','error','reversed'].includes(String(v.status))) {
  const paymentId=`liqpay:${v.payment_id??order.id}:${v.status}`;
  await db().batch([statement('INSERT OR IGNORE INTO payments (id,order_id,provider,provider_id,amount,status,payload,created_at) VALUES (?,?,\'liqpay\',?,?,?,?,?)',[uuid(),order.id,paymentId,order.amount,String(v.status),JSON.stringify(paymentSummary(v)),now()]),statement('UPDATE orders SET status=? WHERE id=? AND status!=\'paid\'',[String(v.status)==='reversed'?'refunded':'failed',order.id])]);
  if(v.status==='reversed') await db().batch([statement('UPDATE orders SET status=\'refunded\' WHERE id=?',[order.id]),statement('UPDATE memberships SET status=\'cancelled\' WHERE order_id=?',[order.id])]);
  await run('UPDATE payment_attempts SET status=\'failed\' WHERE order_id=?',[order.id]);
 }
 return Response.json({data:{ok:true}});
}
export async function commerceRoute(request:Request,path:string,body:unknown) {
 if(path.startsWith('payment-methods'))return methodRoutes(request,path,body);
 if(!path.startsWith('orders')&&!path.startsWith('memberships')) return null;
 const u=await requireUser(request); const parts=path.split('/');
 rejectRawCardData(body);
 if(path==='orders'&&request.method==='POST') { if(emailPolicy(request).verificationRequired&&!u.email_verified) throw new ApiError(403,'Спочатку підтвердіть email.'); const v=z.object({planId:z.string(),clubId:z.string()}).parse(body); const plan=(await catalogItems('plans')).find(p=>p.id===v.planId),club=(await catalogItems('clubs')).find(c=>c.id===v.clubId); if(!plan||!club) throw new ApiError(400,'Оберіть наявний клуб і тариф.'); const price=Number(plan.price),duration=Number(plan.durationDays??30); if(!Number.isFinite(price)||price<=0||!Number.isInteger(duration)||duration<1) throw new ApiError(400,'Тариф не готовий до продажу.'); const id=uuid(); await run('INSERT INTO orders (id,user_id,plan_id,club_id,plan_name,amount,duration,created_at) VALUES (?,?,?,?,?,?,?,?)',[id,u.id,v.planId,v.clubId,String(plan.name),Math.round(price*100),duration,now()]); await audit(u.id,'ORDER_CREATED',id); return Response.json({data:camel((await row('SELECT * FROM orders WHERE id=?',[id]))!)}); }
 if(parts[0]==='orders'&&parts[1]) {
  const order=await row<Order>('SELECT * FROM orders WHERE id=? AND user_id=?',[parts[1],u.id]); if(!order) throw new ApiError(404,'Замовлення не знайдено.');
  if(parts.length===2&&request.method==='GET') {const demo=await row('SELECT id FROM payments WHERE order_id=? AND provider=\'demo\'',[order.id]);return Response.json({data:{...camel({...order}),isDemo:!!demo,paymentEnvironment:paymentEnvironment(request)}});}
  if(['checkout','pay-saved'].includes(parts[2])&&request.method==='POST') {
   if(emailPolicy(request).verificationRequired&&!u.email_verified)throw new ApiError(403,'Спочатку підтвердіть email.');
   if(order.status!=='pending')throw new ApiError(409,'Замовлення вже оброблене.');const e=settings();const club=(await catalogItems('clubs')).find(c=>c.id===order.club_id);
   if(!e.LIQPAY_PUBLIC_KEY||!e.LIQPAY_PRIVATE_KEY)throw new ApiError(503,'Прийом онлайн-оплати ще не підключено.');if(!club?.confirmedPartner)throw new ApiError(409,'Клуб не підтвердив партнерство й продаж абонементів.');if(!e.APP_URL?.startsWith('https://'))throw new ApiError(503,'Налаштуйте HTTPS APP_URL для callback.');
   if(parts[2]==='pay-saved')return paySaved(request,order,body);
   const preference=z.object({saveCard:z.boolean().optional().default(false)}).strict().parse(body);if(preference.saveCard&&!paymentEnvironment(request).saveCardAvailable)throw new ApiError(503,'Збереження карток ще не налаштовано.');
   const checkout=await row('UPDATE orders SET checkout_issued=1,save_card=?,card_consent_at=? WHERE id=? AND status=\'pending\' AND NOT EXISTS(SELECT 1 FROM payment_attempts WHERE order_id=orders.id) RETURNING id',[preference.saveCard?1:0,preference.saveCard?now():null,order.id]);if(!checkout)throw new ApiError(409,'Для замовлення вже розпочато оплату збереженою карткою. Очікуйте підтвердження.');
   const payload={public_key:e.LIQPAY_PUBLIC_KEY,version:Number(e.LIQPAY_VERSION??7),action:'pay',amount:(order.amount/100).toFixed(2),currency:'UAH',description:`SYNKRA: ${order.plan_name}`,order_id:order.id,server_url:`${e.APP_URL}/api/payments/webhook`,result_url:`${e.APP_URL}/checkout/${order.id}`,language:'uk',...(preference.saveCard?{recurringbytoken:1}:{})};
   const data=Buffer.from(JSON.stringify(payload)).toString('base64');return Response.json({data:{provider:'liqpay',url:'https://www.liqpay.ua/api/3/checkout',data,signature:liqpaySignature(data,e.LIQPAY_PRIVATE_KEY,e.LIQPAY_VERSION??'7')}});
  }
  if(parts[2]==='demo-pay'&&request.method==='POST') { if(!paymentEnvironment(request).demoAllowed) throw new ApiError(403,'Тестова оплата дозволена лише в локальному середовищі.'); await completePayment(order,'demo',order.id,{test:true}); return Response.json({data:{ok:true,orderId:order.id,environment:'demo'}}); }
  if(['demo-fail','demo-cancel','demo-refund'].includes(parts[2])&&request.method==='POST'){
   if(!paymentEnvironment(request).demoAllowed)throw new ApiError(403,'Тестові операції дозволені лише локально.');const refund=parts[2]==='demo-refund',status=refund?'refunded':parts[2]==='demo-cancel'?'cancelled':'failed';
   if(refund){if(!await row('SELECT id FROM payments WHERE order_id=? AND provider=\'demo\' AND status=\'success\'',[order.id]))throw new ApiError(409,'Повернення доступне лише для тестової оплати.');if(!['paid','refunded'].includes(order.status))throw new ApiError(409,'Замовлення не сплачене.');}
   else if(order.status!=='pending'&&order.status!==status)throw new ApiError(409,'Замовлення вже оброблене.');
   await db().batch([statement('UPDATE orders SET status=? WHERE id=?',[status,order.id]),statement('INSERT OR IGNORE INTO payments (id,order_id,provider,provider_id,amount,status,payload,created_at) VALUES (?,?,\'demo\',?,?,?,?,?)',[uuid(),order.id,`demo:${order.id}:${status}`,order.amount,status,JSON.stringify({test:true,status}),now()]),...(refund?[statement('UPDATE memberships SET status=\'cancelled\' WHERE order_id=?',[order.id])]:[])]);await audit(u.id,`DEMO_PAYMENT_${status.toUpperCase()}`,order.id);return Response.json({data:{ok:true,orderId:order.id,status,environment:'demo'}});
  }
 }
 if(parts[0]==='memberships'&&parts[1]&&['card','qr'].includes(parts[2])&&request.method==='GET') { const member=await row('SELECT m.*,o.plan_id FROM memberships m JOIN orders o ON o.id=m.order_id WHERE m.id=? AND m.user_id=?',[parts[1],u.id]); if(!member) throw new ApiError(404,'Абонемент не знайдено.');const verificationUrl=`${settings().APP_URL??new URL(request.url).origin}/api/cards/${member.card_code}`; if(parts[2]==='qr'){const svg=await QRCode.toString(verificationUrl,{type:'svg',margin:2,errorCorrectionLevel:'M',width:256});return new Response(svg,{headers:{'Content-Type':'image/svg+xml','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'"}});} return Response.json({data:{...camel(member),holder:u.name,cardToken:member.card_code,expiresAt:member.ends_at,verificationUrl}}); }
 return null;
}
