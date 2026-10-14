import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const project=path.resolve(new URL('..',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const scratch=path.resolve(project,'..','..','work','photo-sourcing');fs.mkdirSync(scratch,{recursive:true});
const directory=path.join(project,'public','images','catalog');fs.mkdirSync(directory,{recursive:true});
const manifestPath=path.join(project,'lib','data','image-assets.json');
const cachePath=path.join(scratch,'unsplash-search.json');
const headers={'User-Agent':'SYNKRA catalog photo sourcing (public stock pages; photographer attribution)','Accept':'application/json'};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const buckets={
 club:['gym interior','gym equipment','fitness studio','weight room','gym dumbbells','treadmill gym','fitness center','pilates studio','yoga studio','barbell gym','training facility','home gym','gym machines','fitness equipment'],
 female:['female fitness trainer','woman gym portrait','woman athlete fitness','female personal trainer','woman workout gym','woman yoga instructor'],
 male:['male fitness trainer','man gym portrait','man athlete fitness','male personal trainer','man workout gym','man training fitness'],
 workout:['strength training','bodyweight workout','pilates workout','yoga exercise','stretching exercise','dumbbell exercise','functional training','running fitness','weight training','core exercise'],
};
const countByKind={club:250,trainer:60,workout:120};
async function fetchRetry(url,options={},attempts=3){let last;for(let i=0;i<attempts;i++){try{const response=await fetch(url,{...options,signal:AbortSignal.timeout(30000)});if(response.ok)return response;last=new Error(`HTTP ${response.status}`);if(response.status!==429&&response.status<500)throw last;const retry=Number(response.headers.get('retry-after'));await delay(Number.isFinite(retry)&&retry>0?Math.min(retry*1000,15000):1000*(i+1));}catch(error){last=error;if(i+1<attempts)await delay(1000*(i+1));}}throw last;}
function normalize(photo,query,bucket){
 if(photo.plus===true||photo.premium===true||photo.is_premium===true||photo.sponsorship||photo.asset_type==='illustration')return null;
 const raw=photo.urls?.raw||photo.urls?.full||photo.urls?.regular;if(!raw)return null;const url=new URL(raw);if(url.hostname!=='images.unsplash.com'||!/^\/photo-/.test(url.pathname))return null;
 const text=[photo.alt_description,photo.description,photo.title,query].filter(Boolean).join(' ');const description=[photo.alt_description,photo.description].filter(Boolean).join(' ');
 if(/Getty|iStock|Unsplash\+|teenager|child|children|kid|baby|boy\b|girl\b|military|weapon|nude|naked|lingerie|planet fitness|gold.?s gym|adidas|nike|reebok|peloton/i.test(description))return null;
 if(!photo.user?.name||!photo.links?.html||Number(photo.width)<800||Number(photo.height)<600)return null;
 if(bucket==='club'&&!/(gym|fitness|weight|dumbbell|barbell|treadmill|studio|training|exercise|sport|workout|pilates|yoga)/i.test(description))return null;
 if(bucket==='female'&&(!/\b(woman|women|female)\b/i.test(description)||/\b(man|men|male)\b/i.test(description)))return null;
 if(bucket==='male'&&(!/\b(man|men|male)\b/i.test(description)||/\b(woman|women|female)\b/i.test(description)))return null;
 if(['female','male'].includes(bucket)&&!/(fitness|gym|exercise|training|athlet|sport|workout|yoga|pilates|running|runner|muscle|barbell|dumbbell|weight)/i.test(text))return null;
 if(bucket==='workout'&&!/(gym|fitness|exercise|training|athlet|sport|workout|yoga|pilates|stretch|running|runner|muscle|barbell|dumbbell|weight)/i.test(description))return null;
 return{id:photo.id,canonical:url.origin+url.pathname,downloadUrl:url.toString(),width:photo.width,height:photo.height,description:description.slice(0,700),query,bucket,credit:{author:photo.user.name,authorUrl:photo.user.links?.html||`https://unsplash.com/@${photo.user.username}`,license:'Unsplash License',licenseUrl:'https://unsplash.com/license',sourceUrl:photo.links.html,sourceName:'Unsplash',originalId:photo.id,changes:'Оптимізація розміру та перекодування у WebP; композицію збережено.'}};
}
let found=[];
if(fs.existsSync(cachePath)&&!process.argv.includes('--refresh')){found=JSON.parse(fs.readFileSync(cachePath,'utf8'));console.log(`Loaded ${found.length} licensed candidates from search cache.`);}else{
 let requests=0;
 for(const [bucket,queries] of Object.entries(buckets)){
  for(const query of queries){
   for(let page=1;page<=4;page++){
    try{const url=`https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query)}&per_page=30&page=${page}`;const response=await fetchRetry(url,{headers});const data=await response.json();const results=data.results||[];for(const photo of results){const candidate=normalize(photo,query,bucket);if(candidate)found.push(candidate);}requests++;if(requests%10===0)console.log(`Search: ${requests} pages; ${found.length} licensed candidates.`);if(!results.length)break;}catch(error){console.log(`Search unavailable: ${bucket}/${query}/${page}: ${error.message}`);break;}
    await delay(350);
   }
  }
  fs.writeFileSync(cachePath,JSON.stringify(found));console.log(`Candidate pool ${bucket}: ${found.filter(v=>v.bucket===bucket).length}`);
 }
}
const pools=Object.fromEntries(Object.keys(buckets).map(bucket=>{const byId=new Map();for(const v of found.filter(v=>v.bucket===bucket))if(!byId.has(v.canonical))byId.set(v.canonical,v);return[bucket,[...byId.values()]];}));
console.log('Distinct candidates:',Object.fromEntries(Object.entries(pools).map(([k,v])=>[k,v.length])));
if(process.argv.includes('--discover-only'))process.exit(0);
const previous=JSON.parse(fs.readFileSync(manifestPath,'utf8').replace(/^\uFEFF/,''));const entries={...previous.entries};
const usedSources=new Set();const usedHashes=new Map();const planned=[];
for(const [kind,count] of Object.entries(countByKind))for(let i=1;i<=count;i++){
 const id=`${kind}-${i}`;const existing=entries[id];if(existing?.source==='licensed-original'&&existing.photoCredit&&fs.existsSync(path.join(project,'public',existing.path))){usedSources.add(existing.photoCredit.sourceUrl);usedSources.add(existing.photoCredit.originalId);usedHashes.set(existing.sha256,id);continue;}
 const bucket=kind==='trainer'?(i%2===1?'female':'male'):kind;
 const candidate=pools[bucket].find(v=>!usedSources.has(v.canonical)&&!usedSources.has(v.id)&&!usedSources.has(v.credit.sourceUrl));
 if(!candidate){console.log(`Insufficient relevant ${bucket} originals: ${id} remains unresolved.`);continue;}
 usedSources.add(candidate.canonical);usedSources.add(candidate.id);usedSources.add(candidate.credit.sourceUrl);planned.push({id,candidate});
}
let completed=0,failed=0;const save=()=>fs.writeFileSync(manifestPath,JSON.stringify({version:1,entries},null,2)+'\n');
async function download({id,candidate}){
 try{const url=new URL(candidate.downloadUrl);url.searchParams.set('w','1100');url.searchParams.set('q','85');url.searchParams.set('fit','max');url.searchParams.set('auto','format');const response=await fetchRetry(url,{headers:{'User-Agent':headers['User-Agent']}});const original=Buffer.from(await response.arrayBuffer());const metadata=await sharp(original).metadata();if((metadata.width||0)<500||(metadata.height||0)<400)throw new Error('Downloaded image below minimum dimensions');const bytes=await sharp(original).rotate().resize({width:1100,withoutEnlargement:true}).webp({quality:82,effort:4}).toBuffer();const sha256=crypto.createHash('sha256').update(bytes).digest('hex');if(usedHashes.has(sha256))throw new Error(`Duplicate photograph bytes: ${usedHashes.get(sha256)}`);usedHashes.set(sha256,id);fs.writeFileSync(path.join(directory,`${id}.webp`),bytes);entries[id]={path:`/images/catalog/${id}.webp`,sha256,source:'licensed-original',registeredAt:new Date().toISOString(),photoCredit:candidate.credit};completed++;if(completed%10===0){save();console.log(`Downloaded ${completed}/${planned.length} unique originals.`);}}catch(error){failed++;console.log(`Photo ${id} failed: ${error.message}`);}
}
const queue=[...planned];await Promise.all(Array.from({length:4},async()=>{while(queue.length){const task=queue.shift();await download(task);await delay(100);}}));save();
const summary=Object.fromEntries(Object.keys(countByKind).map(kind=>[kind,{required:countByKind[kind],available:Object.keys(entries).filter(id=>id.startsWith(kind+'-')&&entries[id].source==='licensed-original'&&entries[id].photoCredit).length}]));
fs.writeFileSync(path.join(scratch,'download-summary.json'),JSON.stringify({completed,failed,summary},null,2));console.log(JSON.stringify({completed,failed,summary},null,2));
if(Object.entries(summary).some(([kind,v])=>v.available<countByKind[kind]))process.exitCode=2;
