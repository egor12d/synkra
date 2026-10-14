"use client";
export default function ErrorPage({reset}:{reset:()=>void}){return <section className="container section"><p className="eyebrow">Тимчасова перерва</p><h1 className="page-title">Повернемося до руху.</h1><p className="muted">Не вдалося завантажити сторінку. Спробуй ще раз.</p><button className="button" style={{marginTop:30}} onClick={reset}>Спробувати знову ↗</button></section>}
