-- TRIPIN multi-user backend prototype (NOT applied to any database)
-- Target: Supabase PostgreSQL. Run only in a separate TEST project after review.
-- Never expose a service_role key in the GitHub Pages frontend.

create extension if not exists pgcrypto;

create table if not exists public.tripin_trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 150),
  destination text not null default '' check (char_length(destination) <= 200),
  start_date date,
  end_date date,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tripin_trip_dates_valid check (end_date is null or start_date is null or end_date >= start_date)
);

create table if not exists public.tripin_stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 200),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table if not exists public.tripin_shopping_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id uuid,
  store_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 200),
  quantity integer not null default 1 check (quantity between 1 and 100000),
  purchased boolean not null default false,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);

-- Composite foreign keys prevent attaching another user's trip or store.
alter table public.tripin_trips add constraint tripin_trips_id_owner_unique unique (id, owner_id);
alter table public.tripin_shopping_items
  add constraint tripin_items_trip_owner_fk foreign key (trip_id, owner_id)
  references public.tripin_trips(id, owner_id) on delete cascade;
alter table public.tripin_shopping_items
  add constraint tripin_items_store_owner_fk foreign key (store_id, owner_id)
  references public.tripin_stores(id, owner_id) on delete set null (store_id);

create index if not exists tripin_trips_owner_idx on public.tripin_trips(owner_id);
create index if not exists tripin_stores_owner_idx on public.tripin_stores(owner_id);
create index if not exists tripin_items_owner_idx on public.tripin_shopping_items(owner_id);
create index if not exists tripin_items_trip_idx on public.tripin_shopping_items(trip_id);

alter table public.tripin_trips enable row level security;
alter table public.tripin_stores enable row level security;
alter table public.tripin_shopping_items enable row level security;

-- Defense in depth: do not grant table access to anonymous clients.
revoke all on public.tripin_trips, public.tripin_stores, public.tripin_shopping_items from anon;
grant select, insert, update, delete on public.tripin_trips, public.tripin_stores, public.tripin_shopping_items to authenticated;

create policy tripin_trips_owner_select on public.tripin_trips for select to authenticated using (owner_id = (select auth.uid()));
create policy tripin_trips_owner_insert on public.tripin_trips for insert to authenticated with check (owner_id = (select auth.uid()));
create policy tripin_trips_owner_update on public.tripin_trips for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy tripin_trips_owner_delete on public.tripin_trips for delete to authenticated using (owner_id = (select auth.uid()));

create policy tripin_stores_owner_select on public.tripin_stores for select to authenticated using (owner_id = (select auth.uid()));
create policy tripin_stores_owner_insert on public.tripin_stores for insert to authenticated with check (owner_id = (select auth.uid()));
create policy tripin_stores_owner_update on public.tripin_stores for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy tripin_stores_owner_delete on public.tripin_stores for delete to authenticated using (owner_id = (select auth.uid()));

create policy tripin_items_owner_select on public.tripin_shopping_items for select to authenticated using (owner_id = (select auth.uid()));
create policy tripin_items_owner_insert on public.tripin_shopping_items for insert to authenticated with check (owner_id = (select auth.uid()));
create policy tripin_items_owner_update on public.tripin_shopping_items for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy tripin_items_owner_delete on public.tripin_shopping_items for delete to authenticated using (owner_id = (select auth.uid()));
