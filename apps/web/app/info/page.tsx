import {TripInfo} from '../../components/TripInfo';

export default async function Page({searchParams}:{searchParams:Promise<{trip?:string|string[]}>}){
  const {trip}=await searchParams;
  const requestedTrip=typeof trip==='string'?trip:'';
  return <TripInfo key={requestedTrip} requestedTrip={requestedTrip}/>;
}
