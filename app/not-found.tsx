import Link from "next/link";
export default function NotFound(){return <section className="container section"><p className="eyebrow">404 / Трохи не той напрям</p><h1 className="page-title">Знайдемо твій шлях.</h1><p className="muted">Цієї сторінки не існує або її переміщено.</p><Link className="button" href="/" style={{marginTop:30}}>Повернутися на головну ↗</Link></section>}
