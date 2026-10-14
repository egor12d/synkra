import {notFound} from 'next/navigation';
import {Catalog} from '@/components/Catalog';
import {sectionTitles,type CatalogSection} from '@/lib/catalog';
export async function generateMetadata({params}:{params:Promise<{section:string}>}) {const {section}=await params;const t=sectionTitles[section as CatalogSection];return{title:t?`${t.label} · SYNKRA`:'SYNKRA',description:t?.intro};}
export default async function CatalogPage({params,searchParams}:{params:Promise<{section:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){const {section}=await params;if(!(Object.hasOwn(sectionTitles,section)))notFound();const query=new URLSearchParams();Object.entries(await searchParams).forEach(([k,v])=>{if(typeof v==='string')query.set(k,v)});return <Catalog key={`${section}:${query.toString()}`} section={section as CatalogSection} initialQuery={query.toString()}/>;}

