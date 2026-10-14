import {Catalog} from '@/components/Catalog';
export const metadata={title:'Карта клубів України · SYNKRA',description:'Географічно точна карта в міжнародно визнаних кордонах України.'};
export default async function MapPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const query=new URLSearchParams();Object.entries(await searchParams).forEach(([k,v])=>{if(typeof v==='string')query.set(k,v)});query.set('view','map');return <Catalog section="clubs" initialQuery={query.toString()} mapOnly/>;}
