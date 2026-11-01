import type { Metadata } from 'next';
import './globals.css';
import { TripinShell } from '../components/TripinShell';
export const metadata: Metadata = {title:'旅點 TRIPIN｜開發測試版',description:'想買的，旅途中別再錯過。',referrer:'no-referrer'};
export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="zh-Hant"><body><TripinShell>{children}</TripinShell></body></html>;
}
