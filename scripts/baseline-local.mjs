// Adopt a preexisting LOCAL database only when every generated schema object matches.
// This records already-applied migrations. It never creates or modifies application tables.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const migrations=readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort();
const expected=new DatabaseSync(':memory:');
for(const migration of migrations)expected.exec(readFileSync(path.join(root,'drizzle',migration),'utf8'));
const objects=expected.prepare("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'").all();
const storage=path.join(root,'.wrangler/state/v3/d1');
const files=readdirSync(storage,{recursive:true}).filter(f=>String(f).endsWith('.sqlite'));
const candidates=[];
for(const file of files){const database=new DatabaseSync(path.join(storage,file));if(database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get())candidates.push(database);else database.close();}
assert.equal(candidates.length,1,'Expected exactly one local application D1 database.');
const database=candidates[0];database.exec('PRAGMA busy_timeout=5000');
const normalize=value=>String(value).replace(/\s+/g,' ').trim();
for(const object of objects){const actual=database.prepare('SELECT sql FROM sqlite_master WHERE name=? AND type=?').get(object.name,object.type);assert.ok(actual,`Missing schema object ${object.name}`);assert.equal(normalize(actual.sql),normalize(object.sql),`Schema differs for ${object.name}; baseline refused.`);}
assert.ok(database.prepare("SELECT name FROM sqlite_master WHERE name='d1_migrations'").get(),'Run Wrangler migrations list first to initialize its own migration ledger.');
database.exec('BEGIN IMMEDIATE');
try{for(const migration of migrations){if(!database.prepare('SELECT name FROM d1_migrations WHERE name=?').get(migration))database.prepare('INSERT INTO d1_migrations (name) VALUES (?)').run(migration);}database.exec('COMMIT');}catch(error){database.exec('ROLLBACK');throw error;}
expected.close();database.close();console.log(`Verified ${objects.length} schema objects; recorded ${migrations.length} already-applied local migrations. Application data unchanged.`);
