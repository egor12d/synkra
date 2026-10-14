import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
const root=path.resolve(import.meta.dirname,'..'),folder=path.join(root,'.wrangler/state/v3/d1');
if(!fs.existsSync(folder))throw new Error('Start SYNKRA once to initialize the database.');
const candidates=fs.readdirSync(folder,{recursive:true}).map(String).filter(file=>file.endsWith('.sqlite'));
let found=false;
for(const relative of candidates){
 const file=path.join(folder,relative),db=new DatabaseSync(file,{readOnly:true});
 if(!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get()){db.close();continue;}
 found=true;console.log(`Database: ${file}\n`);
 const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
 for(const table of tables){const identifier=String(table.name).replaceAll('"','""');console.log(`${table.name}: ${db.prepare(`SELECT count(*) AS count FROM "${identifier}"`).get().count} records`);}
 db.close();
}
if(!found)throw new Error('Application database was not found. No files were changed.');
