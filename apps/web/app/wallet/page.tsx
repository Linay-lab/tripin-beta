import {Wallet} from '../../components/Wallet';

export default async function Page({searchParams}:{searchParams:Promise<{trip?:string|string[]}>}){
  const {trip}=await searchParams;
  const requestedTrip=typeof trip==='string'?trip:'';
  return <Wallet key={requestedTrip} requestedTrip={requestedTrip}/>;
}
