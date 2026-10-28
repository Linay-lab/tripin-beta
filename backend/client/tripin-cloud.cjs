'use strict';
/**
 * TRIPIN Beta cloud adapter (opt-in, not connected to the existing UI yet).
 * Never store or commit access tokens; the caller supplies an active user JWT.
 * No service-role access, no anonymous writes, no production project.
 */
const APPROVED_ORIGIN = 'https://xxzchaewtmctplhamwwi.supabase.co';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function createTripinCloud({url, publishableKey, accessToken, fetchImpl = fetch}) {
  if (url !== APPROVED_ORIGIN) throw Error('Only the approved TRIPIN nonproduction project is permitted');
  if (!publishableKey || !accessToken) throw Error('A publishable key and signed-in user JWT are required');
  if (typeof fetchImpl !== 'function') throw TypeError('fetch is required');
  const headers = () => ({apikey:publishableKey, Authorization:'Bearer '+accessToken,
    'Content-Type':'application/json', Prefer:'return=representation'});
  async function request(path, options={}) {
    const response=await fetchImpl(url+path,{...options,headers:{...headers(),...options.headers}});
    const body=await response.text();
    let data;
    try {data=body?JSON.parse(body):null} catch {throw Error('Invalid cloud response')}
    if (!response.ok) throw Error('Cloud request failed (HTTP '+response.status+')');
    return data;
  }
  async function identity() {
    const user=await request('/auth/v1/user');
    if (!UUID.test(user?.id||'')) throw Error('Invalid authenticated user');
    return user.id;
  }
  const encode = value => encodeURIComponent(value);
  return Object.freeze({
    identity,
    async listTrips() {
      const userId=await identity();
      return request('/rest/v1/trips?owner_id=eq.'+encode(userId)+'&select=id,name,destination,start_date,end_date,currency,updated_at&order=updated_at.desc');
    },
    async createTrip({name,destination='',startDate=null,endDate=null,currency='TWD'}) {
      const userId=await identity();
      if (typeof name!=='string'||!name.trim()||name.length>200) throw Error('Invalid trip name');
      return request('/rest/v1/trips',{method:'POST',body:JSON.stringify({
        owner_id:userId,name:name.trim(),destination,start_date:startDate,end_date:endDate,currency
      })});
    },
    async listItems(tripId) {
      if (!UUID.test(tripId)) throw Error('Invalid trip ID');
      return request('/rest/v1/shopping_items?trip_id=eq.'+encode(tripId)+'&select=id,trip_id,name,quantity,recipient,category,price,currency,place_name,note,bought,updated_at');
    },
    async addItem({tripId,name,quantity=1,recipient='',category='',price=0,currency='TWD',placeName=null,note=null}) {
      if (!UUID.test(tripId)||typeof name!=='string'||!name.trim()||name.length>200) throw Error('Invalid shopping item');
      const userId=await identity();
      return request('/rest/v1/shopping_items',{method:'POST',body:JSON.stringify({
        trip_id:tripId,created_by:userId,name:name.trim(),quantity,recipient,category,price,currency,place_name:placeName,note
      })});
    }
  });
}
if (typeof module!=='undefined'&&module.exports) module.exports={createTripinCloud};
