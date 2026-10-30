-- LOCAL SANDBOX CANDIDATE ONLY. Not applied to production.
-- Do not grant access to dormant tables automatically.
alter policy "Owners can update shopping items" on public.shopping_items
with check (
 created_by = (select auth.uid())
 and exists(select 1 from public.trips t where t.id=shopping_items.trip_id and t.owner_id=(select auth.uid()))
);
