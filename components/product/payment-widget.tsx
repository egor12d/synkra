"use client";
import {useEffect,useId,useState} from "react";
type Payload={data:string;signature:string};
type Widget={on:(event:string,callback:()=>void)=>Widget};
type CheckoutSDK={init:(options:Record<string,unknown>)=>Widget};
declare global {interface Window {LiqPayCheckout?:CheckoutSDK;LiqPayCheckoutCallback?:()=>void}}
let sdkPromise:Promise<CheckoutSDK>|null=null;
function loadSDK(){
 if(window.LiqPayCheckout)return Promise.resolve(window.LiqPayCheckout);
 if(!sdkPromise)sdkPromise=new Promise<CheckoutSDK>((resolve,reject)=>{
  const script=document.createElement("script");script.src="https://static.liqpay.ua/libjs/checkout.js";script.async=true;
  const timeout=setTimeout(()=>{sdkPromise=null;reject(new Error("Завантаження платіжної форми затримується."));},20000);
  const ready=()=>{if(window.LiqPayCheckout){clearTimeout(timeout);resolve(window.LiqPayCheckout);}};
  window.LiqPayCheckoutCallback=ready;script.onload=ready;
  script.onerror=()=>{clearTimeout(timeout);sdkPromise=null;script.remove();reject(new Error("Спробуйте відкрити захищену сторінку оплати."));};
  document.head.appendChild(script);
 });
 return sdkPromise;
}
export default function PaymentWidget({payload,onUpdate}:{payload:Payload;onUpdate:()=>void}){
 const key=useId().replace(/[^a-zA-Z0-9_-]/g,"");const id=`liqpay-${key}`;
 const [error,setError]=useState("");
 useEffect(()=>{let disposed=false;setError("");loadSDK().then(sdk=>{if(!disposed)sdk.init({...payload,embedTo:`#${id}`,mode:"embed",language:"uk"}).on("liqpay.callback",()=>{if(!disposed)onUpdate();}).on("liqpay.close",()=>{if(!disposed)onUpdate();});}).catch(e=>{if(!disposed)setError(e.message);});return()=>{disposed=true;};},[payload.data,payload.signature,id,onUpdate]);
 return <div className="payment-embedded"><div id={id} aria-label="Захищена форма оплати LiqPay"/>{error&&<p role="alert" className="product-small">{error}</p>}<form action="https://www.liqpay.ua/api/3/checkout" method="POST"><input type="hidden" name="data" value={payload.data}/><input type="hidden" name="signature" value={payload.signature}/><button type="submit" className="product-text-button">Відкрити оплату на захищеній сторінці ↗</button></form></div>;
}
