import { requireUser, type User } from './auth';
import { ApiError, digest, now, randomToken, safeEqual } from './security';
import { audit, db, notify, outbox, row, rows, run, settings, statement } from './store';

export async function flushOutbox(limit=30) {
 const e=settings(); let sent=0,failed=0,skipped=0;
 const entries=await rows<{id:string;channel:string;recipient:string;subject:string;body:string;attempts:number}>('SELECT * FROM outbox WHERE status=\'pending\' AND attempts<5 ORDER BY created_at LIMIT ?',[limit]);
 for(const entry of entries) {
  if((entry.channel==='email'&&(!e.EMAIL_API_URL||!e.EMAIL_API_KEY||!e.EMAIL_FROM))||(entry.channel==='telegram'&&!e.TELEGRAM_BOT_TOKEN)){skipped++;continue;}
  const claimed=await row('UPDATE outbox SET status=\'sending\',attempts=attempts+1,claimed_at=? WHERE id=? AND status=\'pending\' RETURNING id',[now(),entry.id]); if(!claimed)continue;
  try {
   const response=entry.channel==='telegram'?await fetch(`https://api.telegram.org/bot${e.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:entry.recipient,text:`${entry.subject}\n\n${entry.body}`})}):await fetch(e.EMAIL_API_URL!,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${e.EMAIL_API_KEY}`,'Idempotency-Key':entry.id},body:JSON.stringify({from:e.EMAIL_FROM,to:[entry.recipient],subject:entry.subject,text:entry.body})});
   if(!response.ok)throw new Error(`Provider HTTP ${response.status}`); await run('UPDATE outbox SET status=\'sent\',sent_at=?,last_error=NULL WHERE id=?',[now(),entry.id]); sent++;
  }catch(error){await run('UPDATE outbox SET status=?,last_error=? WHERE id=?',[entry.attempts+1>=5?'failed':'pending',error instanceof Error?error.message:'Provider error',entry.id]);failed++;}
 }
 return {sent,failed,skipped};
}
export async function scheduledJobs() {
 const timestamp=now(); await run('UPDATE outbox SET status=\'pending\' WHERE status=\'sending\' AND claimed_at<?',[new Date(Date.now()-600000).toISOString()]); await run('UPDATE memberships SET status=\'expired\' WHERE ends_at<=? AND status IN (\'active\',\'frozen\')',[timestamp]);
 const expiring=await rows<{id:string;user_id:string;ends_at:string;plan_name:string}>('SELECT * FROM memberships WHERE status=\'active\' AND ends_at>? AND ends_at<?',[timestamp,new Date(Date.now()+3*86400000).toISOString()]);
 for(const member of expiring){ const event=`expiry:${member.id}:${member.ends_at.slice(0,10)}`;await notify(member.user_id,'Абонемент завершується',`${member.plan_name} діє до ${member.ends_at.slice(0,10)}.`,event); const u=await row<User>('SELECT * FROM users WHERE id=?',[member.user_id]); if(u&&JSON.parse(u.profile).emailNotifications!==false) await outbox(u.id,'email',u.email,'Абонемент завершується',member.ends_at.slice(0,10),`${event}:email`); }
 const bookings=await rows<{id:string;user_id:string;name:string;starts_at:string}>('SELECT b.id,b.user_id,c.name,c.starts_at FROM bookings b JOIN class_sessions c ON c.id=b.class_id WHERE b.status=\'confirmed\' AND c.starts_at>? AND c.starts_at<?',[timestamp,new Date(Date.now()+2*3600000).toISOString()]);
 for(const booking of bookings){await notify(booking.user_id,'Нагадування про заняття',`${booking.name}: ${booking.starts_at}`,`booking-reminder:${booking.id}`);const u=await row<User>('SELECT * FROM users WHERE id=?',[booking.user_id]); if(u?.telegram_chat_id&&JSON.parse(u.profile).telegramNotifications!==false) await outbox(u.id,'telegram',u.telegram_chat_id,'Незабаром тренування',`${booking.name}: ${booking.starts_at}`,`booking-reminder:${booking.id}:telegram`);}
 await run('DELETE FROM sessions WHERE expires_at<?',[timestamp]); await run('DELETE FROM tokens WHERE expires_at<?',[timestamp]); await run('DELETE FROM rate_limits WHERE expires_at<?',[Math.floor(Date.now()/1000)]);
 return {expiring:expiring.length,reminders:bookings.length,...await flushOutbox()};
}
export async function telegramWebhook(request:Request) {
 const e=settings(); if(!e.TELEGRAM_WEBHOOK_SECRET||!safeEqual(request.headers.get('X-Telegram-Bot-Api-Secret-Token')??'',e.TELEGRAM_WEBHOOK_SECRET)) throw new ApiError(401,'Невірний секрет webhook.');
 const data=await request.json() as {update_id:number;message?:{chat:{id:number;type:string};text?:string}}; if(!Number.isInteger(data.update_id))throw new ApiError(400,'Некоректне оновлення.');
 const seen=await row('INSERT OR IGNORE INTO telegram_updates (id,created_at) VALUES (?,?) RETURNING id',[String(data.update_id),now()]); if(!seen)return Response.json({data:{ok:true}});
 const message=data.message; if(!message||message.chat.type!=='private'||!message.text)return Response.json({data:{ok:true}}); const chat=String(message.chat.id),text=message.text.trim(); let u=await row<User>('SELECT * FROM users WHERE telegram_chat_id=?',[chat]); let reply='Команди: /profile, /membership, /schedule, /workouts, /unlink. Прив’яжіть акаунт у кабінеті SYNKRA.';
 if(text.startsWith('/start ')) { const code=text.split(' ')[1]; const token=await row<{user_id:string}>('UPDATE tokens SET used=1 WHERE id=? AND kind=\'telegram\' AND used=0 AND expires_at>? RETURNING user_id',[await digest(code),now()]); if(token){await run('UPDATE users SET telegram_chat_id=NULL WHERE telegram_chat_id=?',[chat]);await run('UPDATE users SET telegram_chat_id=? WHERE id=?',[chat,token.user_id]);u=await row<User>('SELECT * FROM users WHERE id=?',[token.user_id]);reply='Акаунт SYNKRA прив’язано. /help — список команд.';await audit(token.user_id,'TELEGRAM_LINKED',token.user_id);}else reply='Посилання недійсне або використане. Створіть нове у кабінеті.'; }
 else if(u){
  if(text==='/profile')reply=`${u.name}\nМісто: ${u.city||'не вказане'}\nEmail: ${u.email_verified?'підтверджено':'не підтверджено'}`;
  if(text==='/membership'){const members=await rows<{plan_name:string;ends_at:string;status:string}>('SELECT * FROM memberships WHERE user_id=? ORDER BY created_at DESC LIMIT 5',[u.id]);reply=members.length?members.map(m=>`${m.plan_name} · ${m.status} · до ${m.ends_at.slice(0,10)}`).join('\n'):'Активних абонементів немає.';}
  if(text==='/schedule'){const list=await rows<{name:string;starts_at:string}>('SELECT c.name,c.starts_at FROM bookings b JOIN class_sessions c ON c.id=b.class_id WHERE b.user_id=? AND b.status=\'confirmed\' AND c.starts_at>? ORDER BY c.starts_at LIMIT 10',[u.id,now()]);reply=list.length?list.map(v=>`${v.name} · ${v.starts_at}`).join('\n'):'Майбутніх бронювань немає.';}
  if(text==='/workouts'){const logs=await rows<{name:string;duration:number}>('SELECT name,duration FROM workout_logs WHERE user_id=? ORDER BY created_at DESC LIMIT 5',[u.id]);reply=logs.length?logs.map(v=>`${v.name} · ${v.duration} хв`).join('\n'):'Історія тренувань порожня.';}
  if(text==='/unlink'){await run('UPDATE users SET telegram_chat_id=NULL WHERE id=?',[u.id]);reply='Telegram від’єднано від акаунта.';}
 }
 await outbox(u?.id??null,'telegram',chat,'SYNKRA',reply,`telegram-update:${data.update_id}`); await flushOutbox(5); return Response.json({data:{ok:true}});
}
export async function automationRoute(request:Request,path:string) {
 if(path==='telegram/link'&&request.method==='POST'){const u=await requireUser(request);const e=settings();if(!e.TELEGRAM_BOT_USERNAME||!e.TELEGRAM_BOT_TOKEN)throw new ApiError(503,'Telegram-бот ще не налаштований.');const token=randomToken();await db().batch([statement('DELETE FROM tokens WHERE user_id=? AND kind=\'telegram\'',[u.id]),statement('INSERT INTO tokens (id,user_id,kind,expires_at) VALUES (?,?,\'telegram\',?)',[await digest(token),u.id,new Date(Date.now()+600000).toISOString()])]);return Response.json({data:{url:`https://t.me/${e.TELEGRAM_BOT_USERNAME}?start=${token}`,expiresIn:600}});}
 if(path==='telegram/unlink'&&request.method==='POST'){const u=await requireUser(request);await run('UPDATE users SET telegram_chat_id=NULL WHERE id=?',[u.id]);return Response.json({data:{ok:true}});}
 if(path==='admin/automation/run'&&request.method==='POST'){await requireUser(request,['ADMIN']);return Response.json({data:await scheduledJobs()});}
 return null;
}
