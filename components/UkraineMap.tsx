'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { LocateFixed, Minus, Plus, RotateCcw, ArrowUpRight } from 'lucide-react';
import type { Club } from '@/lib/catalog';
import { clusterClubs, coordinateQuality, distanceKm, mapSource, project, ukraineSvgPath } from '@/lib/geo';
import {GoogleClubMap} from './GoogleClubMap';

const boundaryPath=ukraineSvgPath();
export function UkraineMap({clubs}:{clubs:Club[]}) {
 const [apiKey,setApiKey]=useState<string|null>(null);const [local,setLocal]=useState(false);const [failed,setFailed]=useState(false);const fallback=useCallback(()=>{setFailed(true);setLocal(true)},[]);
 useEffect(()=>{let active=true;fetch('/api/maps/config').then(async r=>r.ok?await r.json() as {data?:{googleMapsApiKey?:string}}:null).then(body=>{if(active&&body?.data?.googleMapsApiKey)setApiKey(body.data.googleMapsApiKey)}).catch(()=>{});return()=>{active=false}},[]);
 return <div>{apiKey&&<div className="syn-map-provider"><span>{failed?'Google Maps недоступна. Працює локальна карта.':local?'Локальна карта України':'Google Maps'}</span><button onClick={()=>setLocal(!local)}>{local?'Спробувати Google Maps':'Локальна карта'}</button></div>}{apiKey&&!local?<GoogleClubMap clubs={clubs} apiKey={apiKey} onFallback={fallback}/>:<LocalUkraineMap clubs={clubs}/>}</div>;
}
function LocalUkraineMap({clubs}:{clubs:Club[]}) {
 const [zoom,setZoom]=useState(1);const [pan,setPan]=useState({x:0,y:0});const [selected,setSelected]=useState<Club[]>([]);const [geoMessage,setGeoMessage]=useState('');const svgRef=useRef<SVGSVGElement>(null);const drag=useRef<{x:number;y:number;px:number;py:number;moved:boolean}|null>(null);
 const mapClubs=useMemo(()=>clubs.filter(c=>{const q=coordinateQuality(c.latitude,c.longitude);return q==='VALIDATED'||(q==='BOUNDARY_REVIEW'&&c.status==='DEMO'&&c.coordinateKind==='CITY_CENTER')}),[clubs]);
 const markers=useMemo(()=>clusterClubs(mapClubs,zoom),[mapClubs,zoom]);
 function adjustZoom(next:number) { const value=Math.max(1,Math.min(8,next));setPan(p=>({x:500-(500-p.x)*value/zoom,y:330-(330-p.y)*value/zoom}));setZoom(value); }
 function geolocate(){if(!navigator.geolocation){setGeoMessage('Геолокація недоступна у цьому браузері.');return;}setGeoMessage('Визначаємо місце…');navigator.geolocation.getCurrentPosition(pos=>{const closest=[...clubs].sort((a,b)=>distanceKm([pos.coords.latitude,pos.coords.longitude],[a.latitude,a.longitude])-distanceKm([pos.coords.latitude,pos.coords.longitude],[b.latitude,b.longitude]))[0];if(closest){const [x,y]=project(closest.latitude,closest.longitude);setZoom(3);setPan({x:500-x*3,y:330-y*3});setSelected(clubs.filter(c=>c.cityId===closest.cityId));setGeoMessage(`Найближче місто: ${closest.city}. Маркери позначають центри міст.`);}else setGeoMessage('За поточними фільтрами немає клубів.');},()=>setGeoMessage('Доступ до геолокації не надано. Оберіть місто у фільтрах.'),{timeout:10000,maximumAge:300000});}
 const labelCities=useMemo(()=>Array.from(new Map(clubs.map(c=>[c.cityId,c])).values()).filter((_,i)=>i<30),[clubs]);
 return <div className="syn-map-wrap">
  <div className="syn-map-controls"><button type="button" aria-label="Збільшити карту" onClick={()=>adjustZoom(zoom*1.4)}><Plus size={19}/></button><button type="button" aria-label="Зменшити карту" onClick={()=>adjustZoom(zoom/1.4)}><Minus size={19}/></button><button type="button" aria-label="Скинути карту" onClick={()=>{setZoom(1);setPan({x:0,y:0});setSelected([])}}><RotateCcw size={17}/></button><button type="button" aria-label="Знайти найближче місто" onClick={geolocate}><LocateFixed size={18}/></button></div>
  <svg ref={svgRef} className="syn-map" viewBox="0 0 1000 660" role="img" aria-label="Карта клубів України в міжнародно визнаних кордонах" onPointerDown={e=>{if((e.target as Element).closest('[data-marker]'))return;const r=svgRef.current?.getBoundingClientRect();if(!r)return;drag.current={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y,moved:false};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(!drag.current)return;const r=svgRef.current?.getBoundingClientRect();if(!r)return;const dx=(e.clientX-drag.current.x)*1000/r.width;const dy=(e.clientY-drag.current.y)*660/r.height;drag.current.moved=Math.abs(dx)+Math.abs(dy)>3;setPan({x:drag.current.px+dx,y:drag.current.py+dy});}} onPointerUp={()=>{drag.current=null}} onWheel={e=>{if(e.ctrlKey){e.preventDefault();adjustZoom(zoom*(e.deltaY>0?0.9:1.1));}}}>
   <defs><pattern id="syn-map-grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="#d2d8ca" strokeWidth="0.6"/></pattern></defs>
   <rect width="1000" height="660" fill="#e5e9e0"/><rect width="1000" height="660" fill="url(#syn-map-grid)"/>
   <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}><path d={boundaryPath} fill="#f9f9f3" fillRule="evenodd" stroke="#7c8a72" strokeWidth={1.2/zoom}/>
    <text x="410" y="620" className="syn-map-sea" fontSize={18/zoom}>ЧОРНЕ МОРЕ</text><text x="770" y="535" className="syn-map-sea" fontSize={14/zoom}>АЗОВСЬКЕ МОРЕ</text>
    {labelCities.map(c=>{const[x,y]=project(c.latitude,c.longitude);return <text key={c.cityId} x={x} y={y-19/zoom} textAnchor="middle" fontSize={11/zoom} fill="#59634f">{c.city}</text>;})}
    {markers.map((m,i)=><g data-marker="true" key={i} transform={`translate(${m.x} ${m.y})`} role="button" tabIndex={0} aria-label={`${m.clubs.length} просторів: ${m.clubs[0].city}`} onClick={()=>{setSelected(m.clubs);if(new Set(m.clubs.map(c=>c.cityId)).size>1){const next=Math.min(8,zoom*1.7);setZoom(next);setPan({x:500-m.x*next,y:330-m.y*next});}}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(m.clubs)}}} style={{cursor:'pointer'}}><circle r={(m.clubs.length>3?16:12)/zoom} fill={selected.some(s=>m.clubs.some(c=>c.id===s.id))?'#111715':'#BCE66A'} stroke="#111715" strokeWidth={1/zoom}/><text fill={selected.some(s=>m.clubs.some(c=>c.id===s.id))?'#BCE66A':'#111715'} textAnchor="middle" dominantBaseline="central" fontSize={11/zoom} fontWeight="700">{m.clubs.length}</text></g>)}
   </g>
  </svg>
  <div className="syn-map-legend"><span><i/> Центри міст</span><span>{clubs.length} записів · WGS84 / Web Mercator</span></div>
  {geoMessage&&<p className="syn-map-message" role="status">{geoMessage}</p>}
  {selected.length>0&&<aside className="syn-map-selection"><button className="syn-close" aria-label="Закрити вибір" onClick={()=>setSelected([])}>×</button><p className="eyebrow">{selected[0].city}</p><h3>{selected.length} {selected.length===1?'простір':'простори'}</h3><p className="muted">Оберіть простір, щоб переглянути напрями руху.</p>{selected.slice(0,8).map(c=><Link key={c.id} href={`/clubs/${c.slug}`} className="syn-map-selection-link">{c.name}<ArrowUpRight size={17}/></Link>)}</aside>}
  <small className="syn-map-attribution">Кордони: <a href={mapSource.source} target="_blank" rel="noreferrer">Natural Earth, public domain</a> · Центри міст: <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames, CC BY 4.0</a>.</small>
 </div>
}
