import type { Metadata } from "next";
import "./globals.css";
import "./hero-responsive.css";
import { Header, Footer, CookieChoice } from "@/components/Shell";

export const metadata: Metadata = {
  metadataBase: new URL("https://synkra-fitness-ukraine.aglowsloth32.chatgpt.site"),
  title: {default: "SYNKRA — Рух, що стає звичкою", template: "%s | SYNKRA"},
  description: "Клуби, тренери, програми та харчування в одній українській фітнес-екосистемі. Знайди свій ритм із SYNKRA.",
  openGraph: {title:"SYNKRA — Твоя сила. Твій ритм. Твій рух.",description:"Рух, що стає звичкою.",locale:"uk_UA",type:"website",images:["/images/hero.webp"]},
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body><a className="skip-link" href="#main">Перейти до вмісту</a><Header/><div id="main" tabIndex={-1}>{children}</div><Footer/><CookieChoice/></body>
    </html>
  );
}
