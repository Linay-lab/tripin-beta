-- Applied ONLY to approved nonproduction project xxzchaewtmctplhamwwi.
-- Generated with Supabase CLI migration new; not applied to production.
-- Photo policies and bucket visibility require a separate authorized Storage change.
begin;
alter policy stops_insert_own_trip on public.itinerary_stops
with check (
 user_id = (select auth.uid())
 and exists (select 1 from public.trips t where t.id=itinerary_stops.trip_id and t.owner_id=(select auth.uid()))
 and (source_collection_id is null or exists (select 1 from public.saved_collections c where c.id=itinerary_stops.source_collection_id and c.user_id=(select auth.uid())))
);
alter policy stops_update_own_trip on public.itinerary_stops
using (user_id=(select auth.uid()) and exists (select 1 from public.trips t where t.id=itinerary_stops.trip_id and t.owner_id=(select auth.uid())))
with check (
 user_id = (select auth.uid())
 and exists (select 1 from public.trips t where t.id=itinerary_stops.trip_id and t.owner_id=(select auth.uid()))
 and (source_collection_id is null or exists (select 1 from public.saved_collections c where c.id=itinerary_stops.source_collection_id and c.user_id=(select auth.uid())))
);
commit;

-- Photo bucket verified private; keep the original policy name to avoid rename errors.
begin;
alter policy collection_photos_public_read on storage.objects
 to authenticated
 using (bucket_id = 'collection-photos' and (storage.foldername(name))[1] = ((select auth.uid())::text));
commit;
