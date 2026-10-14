import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {applyLocalAdmin,configureLocalAdmin,parseLocalAdminSetting} from './configure-local-admin.mjs';
const root=path.resolve(import.meta.dirname,'..'),folder=path.join(root,'.sites-runtime/tests');fs.mkdirSync(folder,{recursive:true});
const file=path.join(folder,`owner-config-${Date.now()}.sqlite`),db=new DatabaseSync(file);
for(const name of fs.readdirSync(path.join(root,'drizzle')).filter(n=>n.endsWith('.sql')).sort())db.exec(fs.readFileSync(path.join(root,'drizzle',name),'utf8'));
const insert=db.prepare('INSERT INTO users (id,email,name,password_hash,role,email_verified,created_at) VALUES (?,?,?,?,?,?,?)');
insert.run('owner','owner@example.test','Owner','unchanged-password-hash','CLIENT',0,new Date().toISOString());
insert.run('other','other@example.test','Other','other-password-hash','CLIENT',1,new Date().toISOString());
insert.run('closed','closed@example.test','Closed','closed-hash','CLOSED',0,new Date().toISOString());db.close();
const configurationRoot=path.join(folder,`owner-startup-${Date.now()}`);
const databaseFolder=path.join(configurationRoot,'.wrangler/state/v3/d1');fs.mkdirSync(databaseFolder,{recursive:true});
const startupDatabase=path.join(databaseFolder,'application.sqlite');fs.copyFileSync(file,startupDatabase);
const configurationFile=path.join(configurationRoot,'.dev.vars'),messages=[];
for(const source of [
 'BOOTSTRAP_ADMIN_EMAIL=\r\n# optional owner\r\n',
 'BOOTSTRAP_ADMIN_EMAIL=\n# optional owner\n',
 'BOOTSTRAP_ADMIN_EMAIL=""\n',
 'BOOTSTRAP_ADMIN_EMAIL= # optional owner\n',
 'BOOTSTRAP_ADMIN_EMAIL=not-an-email\n',
 'BOOTSTRAP_ADMIN_EMAIL="owner@example.test" trailing-text\n',
]){
 fs.writeFileSync(configurationFile,source);
 assert.doesNotThrow(()=>configureLocalAdmin({projectRoot:configurationRoot,log:message=>messages.push(message)}));
 const untouched=new DatabaseSync(startupDatabase,{readOnly:true});
 assert.equal(untouched.prepare("SELECT count(*) AS count FROM users WHERE role='ADMIN'").get().count,0);
 untouched.close();
}
assert.equal(messages.length,2);
assert.deepEqual(parseLocalAdminSetting('BOOTSTRAP_ADMIN_EMAIL=" OWNER@example.test " # owner\r\n'),{email:'owner@example.test',invalid:false});
assert.deepEqual(parseLocalAdminSetting('BOOTSTRAP_ADMIN_EMAIL=\r\nLIQPAY_PUBLIC_KEY=other-setting\r\n'),{email:'',invalid:false});
fs.writeFileSync(configurationFile,'BOOTSTRAP_ADMIN_EMAIL="OWNER@example.test" # owner\n');
configureLocalAdmin({projectRoot:configurationRoot,log:()=>{}});
const startupOwner=new DatabaseSync(startupDatabase,{readOnly:true});
assert.equal(startupOwner.prepare("SELECT role FROM users WHERE id='owner'").get().role,'ADMIN');
startupOwner.close();
assert.deepEqual(applyLocalAdmin(file,'OWNER@example.test'),{found:true,changed:true});
assert.deepEqual(applyLocalAdmin(file,'owner@example.test'),{found:true,changed:false});
assert.deepEqual(applyLocalAdmin(file,'unknown@example.test'),{found:false,changed:false});
assert.throws(()=>applyLocalAdmin(file,'closed@example.test'),/closed/);
assert.throws(()=>applyLocalAdmin(file,'not-an-email'),/Invalid/);
const verify=new DatabaseSync(file,{readOnly:true});
const owner=verify.prepare('SELECT role,email_verified,password_hash FROM users WHERE id=?').get('owner');
assert.equal(owner.role,'ADMIN');assert.equal(owner.email_verified,0);assert.equal(owner.password_hash,'unchanged-password-hash');
assert.equal(verify.prepare('SELECT role FROM users WHERE id=?').get('other').role,'CLIENT');
assert.equal(verify.prepare('SELECT count(*) AS count FROM audit WHERE action=?').get('LOCAL_OWNER_CONFIGURED').count,1);
verify.close();console.log('PASS: optional/invalid owner settings do not block startup or grant privileges; CRLF, quoted email, comments, local owner assignment, unchanged password/verification, other-account isolation, idempotent audit, missing/closed/invalid account guards.');
