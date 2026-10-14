import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const state=process.env.SYNKRA_LOCAL_STATE??'.wrangler/state';
if(!path.resolve(root,state).startsWith(path.resolve(root)+path.sep))throw new Error('Local state must stay inside the project.');
const result=spawnSync(process.execPath,['--import','./scripts/windows-os-compat.mjs','--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB','--config','wrangler.local.json','--local','--persist-to',state],{cwd:root,encoding:'utf8',input:'y\n',maxBuffer:8*1024*1024});
if(result.error)throw result.error;
if(result.status!==0){process.stderr.write(result.stderr||result.stdout);process.exit(result.status??1);}
console.log('Local D1 migrations applied. Existing migration history was preserved.');
