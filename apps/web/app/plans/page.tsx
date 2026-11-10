import {Plans} from '../../components/Plans';

export default async function Page({searchParams}:{searchParams:Promise<{trip?:string|string[]}>}){
  const {trip}=await searchParams;
  const requestedTrip=typeof trip==='string'?trip:'';
  return <Plans key={requestedTrip} requestedTrip={requestedTrip}/>;
}
