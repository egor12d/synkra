"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import "./product.css";
export type Row = Record<string, any>;
export async function api(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`/api${path}`, { method, credentials: "same-origin", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const value = await response.json() as Row;
  if (!response.ok) throw new Error(value.message || value.error || "Не вдалося виконати дію. Спробуйте ще раз.");
  return value.data ?? value;
}
export function actionError(error:unknown){const message=(error as Error)?.message||"Не вдалося виконати дію.";return /налаштован|підключ|підтвердив|партнерств|готовий до продажу|ще не підтвердж|тимчасово недоступ/i.test(message)?"Не вдалося завершити дію. Спробуйте ще раз або залиште звернення.":message;}
export function useResource(path: string) {
  const [data, setData] = useState<Row | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => { setError(""); try { setData(await api(path)); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } }, [path]);
  useEffect(() => { refresh(); }, [refresh]);
  return { data, error, loading, refresh, setData };
}
export function Intro({ overline, title, text }: {overline: string; title: string; text?: string}) { return <header className="product-intro"><p className="eyebrow">{overline}</p><h1 className="page-title">{title}</h1>{text && <p className="product-lead">{text}</p>}</header>; }
export function Notice({error, message}: {error?: string; message?: string}) { return error ? <p role="alert" className="product-notice error">{error}</p> : message ? <p role="status" className="product-notice">{message}</p> : null; }
export function Empty({children}: {children: ReactNode}) { return <div className="product-empty">{children}</div>; }
export function Loading() { return <div className="product-empty" role="status">Завантажуємо ваш простір…</div>; }
export function Gate() { return <Empty><h2>Ваш простір починається з входу.</h2><p>Збережені тренування, харчування та записи доступні у вашому акаунті.</p><a className="button" href="/auth/login">Увійти →</a></Empty>; }
export function Field({label, name, type = "text", value, onChange, required = false, min, max, placeholder,step}: {label: string; name: string; type?: string; value?: string | number; onChange?: (v: string) => void; required?: boolean; min?: string | number; max?: string | number; placeholder?: string;step?:string|number}) { return <label className="product-field"><span>{label}</span><input name={name} type={type} value={value} onChange={onChange ? e => onChange(e.target.value) : undefined} required={required} min={min} max={max} step={step??(type==="number"?"any":undefined)} placeholder={placeholder}/></label>; }
export function Select({label, value, onChange, children, name, defaultValue}: {label: string; value?: string; defaultValue?: string; onChange?: (v:string)=>void; children: ReactNode; name?: string}) { return <label className="product-field"><span>{label}</span><select name={name} value={value} defaultValue={defaultValue} onChange={onChange ? e=>onChange(e.target.value) : undefined}>{children}</select></label>; }
export const money = (n: number) => new Intl.NumberFormat("uk-UA", {style:"currency",currency:"UAH",maximumFractionDigits:0}).format(n || 0);
export const date = (s: string) => s ? new Date(s).toLocaleDateString("uk-UA", {day:"numeric",month:"long",year:"numeric"}) : "—";
export const day = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
export function Status({value}: {value:string}) {if(String(value).toLowerCase()==="demo")return null; const labels: Record<string,string> = {pending:"Очікує",paid:"Сплачено",active:"Активний",failed:"Відхилено",cancelled:"Скасовано",refunded:"Повернено",expired:"Завершено",open:"Відкрито",resolved:"Вирішено",new:"Нова",contacted:"Зв’язалися",qualified:"Кваліфікована",proposal:"Пропозиція",won:"Успішно",lost:"Закрита",converted:"Конвертовано",confirmed:"Підтверджено"}; const key=String(value).toLowerCase(); return <span className={`product-status status-${key}`}>{labels[key] || value}</span>; }
export function download(name:string, content:string, mime="text/plain") { const href=URL.createObjectURL(new Blob([content],{type:mime})); const a=document.createElement("a");a.href=href;a.download=name;a.click();URL.revokeObjectURL(href); }

