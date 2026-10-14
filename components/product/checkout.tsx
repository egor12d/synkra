"use client";
import {useEffect,useState} from "react";
import {api,date,Intro,Loading,money,Notice,Row,Status,useResource} from "./shared";
import PaymentWidget from "./payment-widget";
export default function Checkout({id}:{id:string}) {
 const {data,loading,error,refresh}=useResource(`/orders/${id}`);
 const {data:catalog}=useResource("/catalog");
 const {data:methods}=useResource("/payment-methods");
 const [busy,setBusy]=useState(false),[failure,setFailure]=useState("");
 const [saveCard,setSaveCard]=useState(false),[methodId,setMethodId]=useState(""),[payload,setPayload]=useState<{data:string;signature:string}|null>(null);
 const cards:Row[]=Array.isArray(methods)?methods:[];
 const order=data?.order||data, environment=data?.paymentEnvironment;
 useEffect(()=>{if(order?.status!=="pending")return;const timer=setInterval(()=>{if(document.visibilityState==="visible")refresh();},5000);return()=>clearInterval(timer);},[order?.status,refresh]);
 async function operation(mode="checkout"){
  setBusy(true);setFailure("");
  try{
   const result=await api(`/orders/${id}/${mode}`,"POST",mode==="pay-saved"?{methodId}:{saveCard});
   if(result.data&&result.signature&&result.url){
    setPayload({data:result.data,signature:result.signature});
   }else if(result.redirectUrl){const target=new URL(result.redirectUrl);if(target.protocol!=="https:")throw new Error("Некоректне посилання оплати.");window.location.assign(target.href);}
   else if(result.url||result.checkoutUrl)window.location.assign(result.url||result.checkoutUrl);
   else await refresh();
  }catch{setFailure("Не вдалося завершити дію. Спробуйте ще раз або залиште звернення.");}finally{setBusy(false);}
 }
 const title:Record<string,string>={pending:"Оплата замовлення",paid:"Ваш абонемент активовано.",failed:"Оплату відхилено.",cancelled:"Замовлення скасовано.",refunded:"Повернення зафіксовано."};
 return <main className="container product"><Intro overline="ОФОРМЛЕННЯ / БЕЗПЕЧНА ОПЛАТА" title="Ваш наступний крок."/>
  {loading?<Loading/>:!order?<Notice error={error}/>:<div className="product-two">
   <section className="product-panel">
    <p className="eyebrow">ЗАМОВЛЕННЯ № {id.slice(0,8)}</p>
    <h2>{order.plan?.name||order.planName||"Абонемент SYNKRA"}</h2>
    <p>{order.club?.name||order.clubName||catalog?.clubs?.find((c:Row)=>c.id===order.clubId)?.name}</p>
    <hr className="product-divider"/>
    <div className="product-row"><span>Сума замовлення</span><strong className="product-stat">{money((order.amount||order.total||0)/100)}</strong></div>
    <p className="product-small">Створено {date(order.createdAt)}. Абонемент активується після підтвердження оплати.</p>
    <Status value={order.status}/>
    {order.isDemo&&<p className="product-small">Історичний запис: кошти за цим замовленням не списувалися.</p>}
   </section>
   <section className="product-panel product-stack">
    <h2>{title[order.status]||"Стан замовлення"}</h2><Notice error={error||failure}/>
    {order.status==="pending"&&<>
     <p>Завершіть замовлення у зручний для вас спосіб. Воно збережеться у вашій історії.</p>
     {environment?.providerReady?<>{cards.length>0&&<label className="product-field"><span>Спосіб оплати</span><select value={methodId} onChange={e=>{setMethodId(e.target.value);setPayload(null);}}><option value="">Нова картка</option>{cards.map(card=><option value={card.id} key={card.id}>{card.brand||"Картка"}{card.last4?` •••• ${card.last4}`:""}</option>)}</select></label>}{!methodId&&environment.saveCardAvailable&&<label className="product-check"><input type="checkbox" checked={saveCard} disabled={!!payload} onChange={e=>setSaveCard(e.target.checked)}/><span>Зберегти картку для наступних оплат</span></label>}{payload&&!methodId?<PaymentWidget payload={payload} onUpdate={refresh}/>:<button className="button" disabled={busy} onClick={()=>operation(methodId?"pay-saved":"checkout")}>{busy?"Обробляємо…":`Оплатити ${money((order.amount||0)/100)} →`}</button>}<p className="product-small">Visa · Mastercard. Реквізити картки вводяться у захищеній формі LiqPay. Оплату підтверджує банк.</p></>:<a className="button" href={`/contact?kind=membership&club=${encodeURIComponent(order.clubId)}&plan=${encodeURIComponent(order.planId)}&order=${encodeURIComponent(id)}`}>Залишити запит на абонемент →</a>}
    </>}
    {order.status==="paid"&&<><p>{order.isDemo?"Абонемент створено без банківського списання коштів.":"Підтвердження та цифрова карта доступні у кабінеті."}</p><a href="/account" className="button">Перейти до кабінету →</a></>}
    {["failed","cancelled","refunded"].includes(order.status)&&<><p>{order.status==="refunded"?"Абонемент за цим замовленням скасовано. Операція залишається в історії.":"Абонемент за цим замовленням не активовано. Ви можете обрати тариф і створити нове замовлення."}</p><a className="button" href="/membership">Обрати абонемент →</a></>}
    <a href="/account" className="product-text-button">Історія замовлень ↗</a>
    {failure&&<a className="product-text-button" href={`/contact?kind=membership&club=${encodeURIComponent(order.clubId)}&plan=${encodeURIComponent(order.planId)}&order=${encodeURIComponent(id)}`}>Залишити звернення →</a>}
    {order.status==="pending"&&<a href="/membership" className="product-text-button">Змінити вибір абонемента</a>}
   </section>
  </div>}
 </main>;
}

