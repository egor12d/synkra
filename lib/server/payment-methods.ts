import { z } from 'zod';
import { requireUser } from './auth';
import { ApiError, digest, liqpaySignature, localRequest, now, uuid } from './security';
import { audit, db, row, rows, run, settings, statement } from './store';

interface Method {id:string;user_id:string;merchant_key:string;token_ciphertext:string;token_iv:string;last4:string|null;brand:string;is_default:number;created_at:string;}
export interface PaymentOrder {id:string;user_id:string;amount:number;currency:string;plan_name:string;status:string;save_card:number;card_token_saved:number;checkout_issued:number;}
export function encryptionAvailable() { try {const value=settings().PAYMENT_TOKEN_ENCRYPTION_KEY;return !!value&&/^[A-Za-z0-9+/]{43}=$/.test(value)&&Buffer.from(value,'base64').length===32;}catch{return false;} }
async function tokenKey() { if(!encryptionAvailable())throw new ApiError(503,'Збереження карток ще не налаштовано.');return crypto.subtle.importKey('raw',Buffer.from(settings().PAYMENT_TOKEN_ENCRYPTION_KEY!,'base64'),'AES-GCM',false,['encrypt','decrypt']); }
const aad=(userId:string,merchant:string)=>new TextEncoder().encode(`SYNKRA:liqpay:${userId}:${merchant}`);
export function rejectRawCardData(value:unknown,provider=false,parent='') {
 if(!value||typeof value!=='object')return;
 for(const [key,entry] of Object.entries(value as Record<string,unknown>)){
  const normalized=key.toLowerCase().replace(/[^a-z0-9]/g,'');
  if(/(?:pan|cvv2?|cvc2?|cardnumber|cardnum|cardno|cardexpmonth|cardexpyear|cardexpiry)$/.test(normalized)||['pan','cvv','cvc','cvv2','cvc2','cardnumber','cardno','cardnum','sendercardnumber','expmonth','expyear','cardexpiry','expirationdate','cardexpiration'].includes(normalized)||(['number','expiry','expiration','securitycode'].includes(normalized)&&/card/i.test(parent))||(!provider&&['cardtoken','token'].includes(normalized)))throw new ApiError(400,'Реквізити картки вводяться лише у захищеній формі LiqPay.');
  if(normalized==='sendercardmask2'&&typeof entry==='string'&&/^\d{13,19}$/.test(entry.replace(/[ -]/g,'')))throw new ApiError(400,'Повний номер картки не приймається.');
  rejectRawCardData(entry,provider,`${parent}.${key}`);
 }
}
export async function saveCallbackMethod(order:PaymentOrder,callback:Record<string,unknown>) {
 if(!order.save_card||order.card_token_saved||typeof callback.card_token!=='string'||!callback.card_token||callback.card_token.length>2048)return;
 if(!encryptionAvailable())return; // A revoked owner key cannot prevent processing an authentic payment.
 const merchant=settings().LIQPAY_PUBLIC_KEY!;const token=callback.card_token;
 const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(order.user_id,merchant)},await tokenKey(),new TextEncoder().encode(token));
 const mask=String(callback.sender_card_mask2??'');const last4=mask.match(/(?:^|[*xX• -])(\d{4})$/)?.[1]??null;
 const incoming=String(callback.sender_card_type??'').toLowerCase();const brand=incoming==='visa'?'visa':['mc','mastercard'].includes(incoming)?'mastercard':incoming==='amex'?'amex':'card';
 const id=uuid(),fingerprint=await digest(`${merchant}:${token}`);
 await db().batch([
  statement('INSERT OR IGNORE INTO payment_methods (id,user_id,merchant_key,token_ciphertext,token_iv,token_hash,last4,brand,is_default,source_order_id,created_at) SELECT ?,user_id,?,?,?,?,?,?,CASE WHEN EXISTS(SELECT 1 FROM payment_methods WHERE user_id=orders.user_id AND is_default=1) THEN 0 ELSE 1 END,id,? FROM orders WHERE id=? AND status=\'paid\' AND save_card=1 AND card_token_saved=0',[id,merchant,Buffer.from(encrypted).toString('base64'),Buffer.from(iv).toString('base64'),fingerprint,last4,brand,now(),order.id]),
  statement('UPDATE orders SET card_token_saved=1 WHERE id=? AND status=\'paid\' AND save_card=1',[order.id]),
 ]);
 if(await row('SELECT id FROM payment_methods WHERE id=?',[id]))await audit(order.user_id,'PAYMENT_METHOD_SAVED',id,{brand,last4});
}
export async function methodRoutes(request:Request,path:string,body:unknown) {
 if(!path.startsWith('payment-methods'))return null;const u=await requireUser(request);const parts=path.split('/');rejectRawCardData(body);
 if(path==='payment-methods'&&request.method==='GET')return Response.json({data:(await rows<Method>('SELECT id,last4,brand,is_default,created_at FROM payment_methods WHERE user_id=? ORDER BY is_default DESC,created_at DESC',[u.id])).map(v=>({id:v.id,last4:v.last4,brand:v.brand,isDefault:!!v.is_default,createdAt:v.created_at}))});
 if(parts[1]&&['PATCH','DELETE'].includes(request.method)){
  if(!await row('SELECT id FROM payment_methods WHERE id=? AND user_id=?',[parts[1],u.id]))throw new ApiError(404,'Картку не знайдено.');
  if(request.method==='PATCH'){z.object({isDefault:z.literal(true)}).strict().parse(body);await db().batch([statement('UPDATE payment_methods SET is_default=0 WHERE user_id=? AND EXISTS(SELECT 1 FROM payment_methods WHERE id=? AND user_id=?)',[u.id,parts[1],u.id]),statement('UPDATE payment_methods SET is_default=1 WHERE id=? AND user_id=?',[parts[1],u.id])]);await audit(u.id,'PAYMENT_METHOD_DEFAULT_CHANGED',parts[1]);}
  else{await db().batch([statement('DELETE FROM payment_methods WHERE id=? AND user_id=?',[parts[1],u.id]),statement('UPDATE payment_methods SET is_default=1 WHERE id=(SELECT id FROM payment_methods WHERE user_id=? ORDER BY created_at LIMIT 1) AND NOT EXISTS(SELECT 1 FROM payment_methods WHERE user_id=? AND is_default=1)',[u.id,u.id])]);await audit(u.id,'PAYMENT_METHOD_DELETED',parts[1]);}
  return Response.json({data:{ok:true}});
 }
 throw new ApiError(404,'Маршрут карток не знайдено.');
}
function safeRedirect(value:unknown) { if(typeof value!=='string')return null;try{const url=new URL(value);return url.protocol==='https:'&&(url.hostname==='liqpay.ua'||url.hostname.endsWith('.liqpay.ua'))&&!url.username&&!url.password?url.href:null;}catch{return null;} }
export async function paySaved(request:Request,order:PaymentOrder,body:unknown) {
 rejectRawCardData(body);const v=z.object({methodId:z.string().min(1).max(128)}).strict().parse(body);if(order.status!=='pending')throw new ApiError(409,'Замовлення вже оброблене.');if(order.checkout_issued)throw new ApiError(409,'Для цього замовлення вже відкрито платіжну форму. Продовжіть ту саму оплату.');
 const e=settings();if(!e.LIQPAY_PUBLIC_KEY||!e.LIQPAY_PRIVATE_KEY||!e.APP_URL?.startsWith('https://'))throw new ApiError(503,'Прийом оплати ще не налаштовано.');
 const method=await row<Method>('SELECT * FROM payment_methods WHERE id=? AND user_id=?',[v.methodId,order.user_id]);if(!method)throw new ApiError(404,'Картку не знайдено.');if(method.merchant_key!==e.LIQPAY_PUBLIC_KEY)throw new ApiError(409,'Картка належить іншому платіжному підключенню.');
 let token:string;try{token=new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(method.token_iv,'base64'),additionalData:aad(order.user_id,method.merchant_key)},await tokenKey(),Buffer.from(method.token_ciphertext,'base64')));}catch{throw new ApiError(503,'Не вдалося відкрити збережений спосіб оплати. Перевірте ключ шифрування.');}
 const claim=await row('INSERT OR IGNORE INTO payment_attempts (order_id,method_id,status,created_at) SELECT ?,?,\'initiated\',? FROM orders WHERE id=? AND status=\'pending\' AND checkout_issued=0 RETURNING order_id',[order.id,v.methodId,now(),order.id]);
 if(!claim){const existing=await row<{status:string;redirect_url:string|null;method_id:string|null}>('SELECT status,redirect_url,method_id FROM payment_attempts WHERE order_id=?',[order.id]);if(!existing||existing.method_id!==v.methodId)throw new ApiError(409,'Для цього замовлення вже розпочато іншу оплату.');return Response.json({data:{orderId:order.id,status:existing.status==='initiated'?'pending':existing.status,redirectUrl:existing.redirect_url,alreadyRequested:true}});}
 const payload={public_key:e.LIQPAY_PUBLIC_KEY,version:Number(e.LIQPAY_VERSION??7),action:'paytoken',card_token:token,amount:(order.amount/100).toFixed(2),currency:order.currency,description:`SYNKRA: ${order.plan_name}`,order_id:order.id,ip:request.headers.get('cf-connecting-ip')??(localRequest(request)?'127.0.0.1':'0.0.0.0'),is_recurring:false,server_url:`${e.APP_URL}/api/payments/webhook`,language:'uk'};
 const data=Buffer.from(JSON.stringify(payload)).toString('base64');
 try{
  const response=await fetch('https://www.liqpay.ua/api/request',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data,signature:liqpaySignature(data,e.LIQPAY_PRIVATE_KEY,e.LIQPAY_VERSION??'7')}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('Gateway unavailable');const result=await response.json() as Record<string,unknown>;
  const gatewayStatus=String(result.status??''),redirectUrl=safeRedirect(result.redirect_to??result.checkout_url??result.url);const status=['failure','error','reversed'].includes(gatewayStatus)?'failed':redirectUrl||['3ds_verify','wait_3ds','wait_secure'].includes(gatewayStatus)?'challenge':'pending';
  await run('UPDATE payment_attempts SET status=?,redirect_url=? WHERE order_id=? AND status=\'initiated\'',[status,redirectUrl,order.id]);await audit(order.user_id,'SAVED_PAYMENT_REQUESTED',order.id,{status});
  return Response.json({data:{orderId:order.id,status,redirectUrl,message:status==='challenge'?'Завершіть підтвердження банку. Платіж очікує перевіреного повідомлення LiqPay.':status==='failed'?'Провайдер відхилив запит. Списання не підтверджено.':'Очікуємо підтвердження LiqPay. Не повторюйте оплату.'}});
 }catch{await run('UPDATE payment_attempts SET status=\'pending\' WHERE order_id=? AND status=\'initiated\'',[order.id]);return Response.json({data:{orderId:order.id,status:'pending',message:'Статус уточнюється у провайдера. Повторний запит для цього замовлення заблоковано.'}});}
}
