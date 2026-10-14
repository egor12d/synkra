import completedManifest from './data/image-assets.json';

export const catalogImageCounts = {club:250,trainer:60,workout:120,exercise:300,recipe:150,program:40,article:30,city:100} as const;
export type CatalogImageKind = keyof typeof catalogImageCounts;
export type PhotoCredit = {author:string;authorUrl?:string;license:string;licenseUrl:string;sourceUrl:string;sourceName:'Unsplash'|'Wikimedia Commons';originalId:string;changes:string};
export type ImageAsset = {path:string;sha256:string;source:'generated-original'|'licensed-original';registeredAt:string;photoCredit?:PhotoCredit};
const assets = completedManifest.entries as Record<string,ImageAsset>;
export const marketingImageIds=['marketing-strength','marketing-balance','marketing-energy','marketing-club','marketing-program','marketing-nutrition','marketing-trainer','marketing-menu','marketing-about'] as const;
const legacyImages = new Set([
 '/images/gym.jpg','/images/gym.webp','/images/workout.jpg','/images/workout.webp',
 '/images/trainer.jpg','/images/trainer.webp','/images/food.jpg','/images/food.webp',
 '/images/running.jpg','/images/running.webp',
 '/images/training.webp','/images/strength.webp','/images/yoga.webp','/images/nutrition.webp',
]);
const fallbackByKind:Record<CatalogImageKind,string> = {club:'/images/gym.jpg',trainer:'/images/trainer.jpg',workout:'/images/workout.jpg',exercise:'/images/workout.jpg',recipe:'/images/food.jpg',program:'/images/workout.jpg',article:'/images/running.jpg',city:'/images/gym.jpg'};
export function catalogImageKind(id:string):CatalogImageKind|null {const match=/^(club|trainer|workout|exercise|recipe|program|article|city)-(\d+)$/.exec(id);if(!match)return null;const kind=match[1] as CatalogImageKind;const number=Number(match[2]);return number>=1&&number<=catalogImageCounts[kind]?kind:null;}
export function catalogImagePath(id:string):string|null {return catalogImageKind(id)||(marketingImageIds as readonly string[]).includes(id)?`/images/catalog/${id}.webp`:null;}
/** Only completed originals are exposed; an administrator's custom photo takes precedence. */
export function imageForEntity(entity:{id?:unknown;image?:unknown},fallback?:string):string {
 const id=typeof entity.id==='string'?entity.id:'';const existing=typeof entity.image==='string'?entity.image:'';const target=catalogImagePath(id);
 if(existing&&!legacyImages.has(existing)&&existing!==target)return existing;
 const asset=assets[id];if(asset?.path===target)return asset.path;
 const kind=catalogImageKind(id);return existing&&existing!==target?existing:fallback||(kind?fallbackByKind[kind]:'/images/gym.jpg');
}
export function completedImageAsset(id:string):ImageAsset|null {return assets[id]??null;}
export function photoCreditForEntity(entity:{id?:unknown;image?:unknown}):PhotoCredit|null {const id=typeof entity.id==='string'?entity.id:'';const asset=assets[id];return asset?.photoCredit&&imageForEntity(entity)===asset.path?asset.photoCredit:null;}
export function allPhotoCredits() {return Object.entries(assets).flatMap(([id,asset])=>asset.photoCredit?[{id,image:asset.path,...asset.photoCredit}]:[]);}
export function catalogImageRequirements(kinds:CatalogImageKind[]=['club','trainer','workout','exercise','recipe','program','article']) {return kinds.flatMap(kind=>Array.from({length:catalogImageCounts[kind]},(_,i)=>({id:`${kind}-${i+1}`,path:`/images/catalog/${kind}-${i+1}.webp`,complete:!!assets[`${kind}-${i+1}`]})));}
