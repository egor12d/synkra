export const metadata={title:"Оплата замовлення",description:"Підсумок вашого замовлення та безпечна оплата абонемента."};
import Checkout from "@/components/product/checkout";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <Checkout id={id}/>;}


