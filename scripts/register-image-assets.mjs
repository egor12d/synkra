import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const project=path.resolve(new URL('..',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const directory=path.join(project,'public','images','catalog');
const manifestPath=path.join(project,'lib','data','image-assets.json');
const source=process.argv.includes('--licensed')?'licensed-original':'generated-original';
const counts={club:250,trainer:60,workout:120,exercise:300,recipe:150,program:40,article:30,city:100};
const marketing=new Set(['strength','balance','energy','club','program','nutrition','trainer','menu','about']);
const old=JSON.parse(fs.readFileSync(manifestPath,'utf8').replace(/^\uFEFF/,''));const entries={};const fingerprints=new Map();
if(!fs.existsSync(directory))fs.mkdirSync(directory,{recursive:true});
for(const file of fs.readdirSync(directory).sort()){
 const match=/^(club|trainer|workout|exercise|recipe|program|article|city)-(\d+)\.webp$/.exec(file);const promo=/^marketing-([a-z]+)\.webp$/.exec(file);if(!match&&!(promo&&marketing.has(promo[1])))continue;
 const kind=match?.[1]||'marketing',index=match?Number(match[2]):promo[1];if(match&&(index<1||index>counts[kind]))throw new Error(`Unexpected catalog image: ${file}`);
 const bytes=fs.readFileSync(path.join(directory,file));if(bytes.length<1024)throw new Error(`Image too small or incomplete: ${file}`);
 if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')throw new Error(`Not an actual WebP: ${file}`);
 const sha256=crypto.createHash('sha256').update(bytes).digest('hex');if(fingerprints.has(sha256))throw new Error(`Duplicate original: ${file} equals ${fingerprints.get(sha256)}`);fingerprints.set(sha256,file);
 const id=`${kind}-${index}`;const previous=old.entries[id];entries[id]={path:`/images/catalog/${file}`,sha256,source:previous?.sha256===sha256?previous.source:source,registeredAt:previous?.sha256===sha256?previous.registeredAt:new Date().toISOString(),...(previous?.sha256===sha256&&previous.photoCredit?{photoCredit:previous.photoCredit}:{})};
}
fs.writeFileSync(manifestPath,JSON.stringify({version:1,entries},null,2)+'\n');
const requested=['club','trainer','workout','exercise','recipe','program','article'];const missing=requested.flatMap(kind=>Array.from({length:counts[kind]},(_,i)=>`${kind}-${i+1}`).filter(id=>!entries[id]));console.log(JSON.stringify({registered:Object.keys(entries).length,requested:requested.reduce((s,k)=>s+counts[k],0),byKind:Object.fromEntries([...Object.keys(counts),'marketing'].map(kind=>[kind,Object.keys(entries).filter(id=>id.startsWith(kind+'-')).length])),missingCount:missing.length,...(process.argv.includes('--list-missing')?{missing}:{})},null,2));
