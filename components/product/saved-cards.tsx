"use client";
import {useState} from "react";
import {api,Empty,Loading,Notice,Row,useResource} from "./shared";
export default function SavedCards(){
 const {data,loading,error,refresh}=useResource("/payment-methods");const [busy,setBusy]=useState(""),[failure,setFailure]=useState("");
 const cards:Row[]=Array.isArray(data)?data:[];
 async function update(id:string,method:string){if(method==="DELETE"&&!window.confirm("Прибрати цю картку зі способів оплати SYNKRA?"))return;setBusy(id);setFailure("");try{await api(`/payment-methods/${id}`,method,method==="PATCH"?{isDefault:true}:undefined);await refresh();}catch{setFailure("Не вдалося зберегти зміни. Спробуйте ще раз.");}finally{setBusy("");}}
 return <section className="product-panel product-stack"><h2>Мої картки</h2><p className="product-muted">Картка з’явиться тут після першої оплати, якщо ви оберете її збереження. Наступного разу її можна буде вибрати під час оформлення замовлення.</p><Notice error={error||failure}/>{loading?<Loading/>:!cards.length?<Empty>Збережених карток поки немає.</Empty>:cards.map(card=><article key={card.id} className="product-panel product-stack"><div className="product-row"><strong>{card.brand||"Картка"} {card.last4?`•••• ${card.last4}`:""}</strong>{card.isDefault&&<span className="product-small">Основна</span>}</div><div className="product-row-start">{!card.isDefault&&<button disabled={busy===card.id} className="product-text-button" onClick={()=>update(card.id,"PATCH")}>Зробити основною</button>}<button disabled={busy===card.id} className="product-text-button" onClick={()=>update(card.id,"DELETE")}>Прибрати картку</button></div></article>)}<p className="product-small">Банківські реквізити обробляє LiqPay. Тут відображаються лише назва картки та останні цифри.</p></section>;
}
