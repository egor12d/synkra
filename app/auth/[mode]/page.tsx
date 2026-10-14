import Auth from "@/components/product/auth";
export async function generateMetadata({params}:{params:Promise<{mode:string}>}){const {mode}=await params;const titles:Record<string,string>={login:"Вхід",register:"Створення акаунта",verify:"Підтвердження email","forgot-password":"Відновлення доступу","reset-password":"Новий пароль"};return {title:`${titles[mode]||"Авторизація"}`,description:"Безпечний доступ до вашого простору SYNKRA."};}
export default async function Page({params}:{params:Promise<{mode:string}>}) {const {mode}=await params;return <Auth mode={mode}/>;}

