import Link from 'next/link';
import {photoCreditForEntity} from '@/lib/image-assets';
import './photo-credit.css';
export function PhotoCreditLine({entity,compact=false}:{entity:{id?:unknown;image?:unknown};compact?:boolean}){
 const credit=photoCreditForEntity(entity);if(!credit)return null;
 return <p className={`syn-photo-credit ${compact?'compact':''}`}>Фото: <a href={credit.authorUrl||credit.sourceUrl} target="_blank" rel="noreferrer">{credit.author}</a><span> / </span><a href={credit.sourceUrl} target="_blank" rel="noreferrer">{credit.sourceName}</a>{!compact&&<><span> · </span><a href={credit.licenseUrl} target="_blank" rel="noreferrer">{credit.license}</a></>}<Link href={`/photo-credits#${entity.id}`} className="syn-photo-credit-details" aria-label={`Джерело та ліцензія фотографії: ${credit.author}`}>ⓘ</Link></p>;
}
