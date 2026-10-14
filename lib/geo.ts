import ukraine from './data/ukraine.json';
import type { City, Club } from './catalog';
export type Coordinate = [number,number];
export const ukraineGeometry = ukraine.geometry as {type:string;coordinates: Coordinate[][][]};
export const mapSource = ukraine.properties;
const rad=(n:number)=>n*Math.PI/180;
const mercator=(latitude:number)=>Math.log(Math.tan(Math.PI/4+rad(latitude)/2));
export function project(latitude:number,longitude:number):Coordinate { return [(longitude-21.5)*50,(mercator(53)-mercator(latitude))*50*180/Math.PI]; }
export function unproject(x:number,y:number):Coordinate { return [(2*Math.atan(Math.exp(mercator(53)-y/(50*180/Math.PI)))-Math.PI/2)*180/Math.PI,x/50+21.5]; }
function ringContains(point:Coordinate,ring:Coordinate[]):boolean {
  let inside=false; const [x,y]=point;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) { const [xi,yi]=ring[i]; const [xj,yj]=ring[j]; if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside; }
  return inside;
}
export function isInUkraine(latitude:number,longitude:number):boolean { if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return false;return ukraineGeometry.coordinates.some(p=>ringContains([longitude,latitude],p[0])&&!p.slice(1).some(r=>ringContains([longitude,latitude],r))); }
export function distanceToCountryEdge(latitude:number,longitude:number):number {
 const kx=111.32*Math.cos(rad(latitude)),ky=111.32;let min=Infinity;
 for(const polygon of ukraineGeometry.coordinates)for(const ring of polygon)for(let i=1;i<ring.length;i++){const ax=(ring[i-1][0]-longitude)*kx,ay=(ring[i-1][1]-latitude)*ky,bx=(ring[i][0]-longitude)*kx,by=(ring[i][1]-latitude)*ky;const dx=bx-ax,dy=by-ay;const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));min=Math.min(min,Math.hypot(ax+t*dx,ay+t*dy));}return min;
}
export function coordinateQuality(latitude:number,longitude:number):'VALIDATED'|'BOUNDARY_REVIEW'|'INVALID' { if(isInUkraine(latitude,longitude))return 'VALIDATED';return distanceToCountryEdge(latitude,longitude)<=1?'BOUNDARY_REVIEW':'INVALID'; }
export function distanceKm(a:Coordinate,b:Coordinate):number { const dLat=rad(b[0]-a[0]);const dLon=rad(b[1]-a[1]);const h=Math.sin(dLat/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dLon/2)**2;return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h)); }
export function validateClubPoint(club:Club,city:City): {valid:boolean;reason:string} { if(club.cityId!==city.id)return{valid:false,reason:'Невідповідне місто'};const quality=coordinateQuality(club.latitude,club.longitude);const exactCityCenter=club.latitude===city.latitude&&club.longitude===city.longitude;if(quality==='INVALID'||(quality==='BOUNDARY_REVIEW'&&!(club.status==='DEMO'&&club.coordinateKind==='CITY_CENTER'&&exactCityCenter)))return{valid:false,reason:'Координати поза полігоном; потрібна перевірка'};if(distanceKm([club.latitude,club.longitude],[city.latitude,city.longitude])>20)return{valid:false,reason:'Координати далеко від указаного міста'};if(club.coordinateKind==='CITY_CENTER'&&club.status!=='DEMO')return{valid:false,reason:'Центр міста не є адресою клубу'};return{valid:true,reason:quality==='BOUNDARY_REVIEW'?'Центр міста GeoNames; поблизу узагальненої берегової лінії, потрібна перевірка':club.status==='DEMO'?'Демонстраційна точка в центрі міста':'Перевірені координати'}; }
export function ukraineSvgPath():string { return ukraineGeometry.coordinates.map(p=>p.map(r=>'M'+r.map(([lng,lat])=>project(lat,lng).map(v=>v.toFixed(2)).join(',')).join('L')+'Z').join(' ')).join(' '); }
export function clusterClubs(clubs:Club[],zoom:number) { const grid=44/zoom; const buckets=new Map<string,{x:number;y:number;clubs:Club[]}>();for(const c of clubs) { const [x,y]=project(c.latitude,c.longitude);const key=`${Math.floor(x/grid)}:${Math.floor(y/grid)}`;const b=buckets.get(key);if(b)b.clubs.push(c);else buckets.set(key,{x,y,clubs:[c]}); }return Array.from(buckets.values()).map(b=>({...b,x:b.clubs.reduce((a,c)=>a+project(c.latitude,c.longitude)[0],0)/b.clubs.length,y:b.clubs.reduce((a,c)=>a+project(c.latitude,c.longitude)[1],0)/b.clubs.length})); }
