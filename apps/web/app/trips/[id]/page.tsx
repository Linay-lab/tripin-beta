import { Overview } from '../../../components/Pages';
export default async function Page({params}:{params:Promise<{id:string}>}){return <Overview id={(await params).id}/>;}
