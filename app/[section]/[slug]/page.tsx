import {notFound} from 'next/navigation';
import {CatalogDetail} from '@/components/CatalogDetail';
import {sectionItems,sectionTitles,type CatalogSection} from '@/lib/catalog';
import {catalogItems} from '@/lib/server/commerce';
type DetailParams={section:string;slug:string};
async function getItem(section:CatalogSection,slug:string){try{const all=await catalogItems(section==='blog'?'articles':section);return all.find(i=>i.slug===slug);}catch{return sectionItems(section).find(i=>i.slug===slug);}}
export async function generateMetadata({params}:{params:Promise<DetailParams>}){const {section,slug}=await params;if(!(Object.hasOwn(sectionTitles,section)))return{title:'SYNKRA'};const item=await getItem(section as CatalogSection,slug);return{title:item?`${item.name} · SYNKRA`:'SYNKRA',description:item&&'description' in item?String(item.description):sectionTitles[section as CatalogSection].intro};}
export default async function DetailPage({params}:{params:Promise<DetailParams>}){const {section,slug}=await params;if(!(Object.hasOwn(sectionTitles,section)))notFound();const item=await getItem(section as CatalogSection,slug);if(!item)notFound();return <CatalogDetail key={`${section}:${slug}`} section={section as CatalogSection} item={item as Parameters<typeof CatalogDetail>[0]['item']}/>;}

