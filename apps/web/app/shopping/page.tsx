import {Shopping} from '../../components/Shopping';

export default async function Page({searchParams}:{searchParams:Promise<{trip?:string|string[]}>}){
  const {trip}=await searchParams;
  const requestedTrip=typeof trip==='string'?trip:'';
  return <Shopping key={requestedTrip} requestedTrip={requestedTrip}/>;
}
