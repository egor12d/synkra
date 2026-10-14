import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const validEmail=email=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export function parseLocalAdminSetting(source){
 const match=source.match(/^[ \t]*BOOTSTRAP_ADMIN_EMAIL[ \t]*=[ \t]*([^\r\n]*)\r?$/m);
 const value=(match?.[1]??'').replace(/\s+#.*$/,'').trim();
 if(!value||value.startsWith('#'))return {email:'',invalid:false};
 const email=value.replace(/^(['"])(.*)\1$/,'$2').trim().toLowerCase();
 return {email:validEmail(email)?email:'',invalid:Boolean(email)&&!validEmail(email)};
}
// This trusted, local operator command is not an HTTP endpoint or a hosted registration rule.
export function applyLocalAdmin(file,email){
 const normalized=email.trim().toLowerCase();if(!validEmail(normalized))throw new Error('Invalid BOOTSTRAP_ADMIN_EMAIL.');
 const db=new DatabaseSync(file);db.exec('PRAGMA busy_timeout=5000');
 try{
  db.exec('BEGIN IMMEDIATE');
  const user=db.prepare('SELECT id,role FROM users WHERE email=?').get(normalized);
  if(!user){db.exec('COMMIT');return {found:false,changed:false};}
  if(user.role==='CLOSED')throw new Error('The configured owner account is closed.');
  if(user.role==='ADMIN'){db.exec('COMMIT');return {found:true,changed:false};}
  db.prepare("UPDATE users SET role='ADMIN' WHERE id=?").run(user.id);
  db.prepare('INSERT INTO audit (id,user_id,action,target,detail,created_at) VALUES (?,NULL,?,?,?,?)').run(randomUUID(),'LOCAL_OWNER_CONFIGURED',user.id,JSON.stringify({source:'local-owner-configuration'}),new Date().toISOString());
  db.exec('COMMIT');return {found:true,changed:true};
 }catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error;}finally{db.close();}
}
export function configureLocalAdmin({projectRoot=root,log=console.log}={}){
 const configuration=path.join(projectRoot,'.dev.vars');if(!fs.existsSync(configuration))return;
 const {email,invalid}=parseLocalAdminSetting(fs.readFileSync(configuration,'utf8'));
 if(invalid){log('Сайт продолжит запуск. Для доступа владельца укажите корректный BOOTSTRAP_ADMIN_EMAIL в .dev.vars и повторите запуск.');return;}
 if(!email)return;
 const folder=path.join(projectRoot,'.wrangler/state/v3/d1');if(!fs.existsSync(folder))return;
 const databases=[];
 for(const relative of fs.readdirSync(folder,{recursive:true}).map(String).filter(file=>file.endsWith('.sqlite'))){
  const file=path.join(folder,relative),db=new DatabaseSync(file,{readOnly:true});
  try{if(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get())databases.push(file);}finally{db.close();}
 }
 if(databases.length!==1)throw new Error('Expected exactly one local application database.');
 const result=applyLocalAdmin(databases[0],email);
 log(result.found?'Администратор из локальной настройки готов. Используйте существующий пароль и откройте /admin.':'Аккаунт владельца ещё не создан. После регистрации повторно запустите Start-SYNKRA.cmd.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))configureLocalAdmin();
