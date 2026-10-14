import { catalogItems } from '@/lib/server/commerce';
export async function GET(request: Request) {
  const origin=new URL(request.url).origin;
  const routes=['','/clubs','/clubs/map','/trainers','/workouts','/exercises','/programs','/recipes','/blog','/membership','/about','/faq','/support','/contact','/offers','/privacy','/terms','/cookies'];
  for(const section of ['clubs','trainers','workouts','exercises','programs','recipes','blog']) {
    const items=await catalogItems(section === 'blog' ? 'articles' : section);
    for(const item of items as any[]) if(item.status!=='DEMO') routes.push(`/${section}/${item.slug}`);
  }
  const escape=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(route=>`<url><loc>${escape(origin+route)}</loc></url>`).join('')}</urlset>`,{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=3600'}});
}
