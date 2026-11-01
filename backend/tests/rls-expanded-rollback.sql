-- Approved nonproduction database ONLY: xxzchaewtmctplhamwwi.
-- Real database roles with simulated JWT claims; NOT a fresh HTTP/JWT login test.
-- Every fixture and helper setting is rolled back. Never run on production.
begin;
set local statement_timeout = '30s';
select set_config('tripin.audit_a',(select id::text from auth.users order by created_at,id limit 1),true);
select set_config('tripin.audit_b',(select id::text from auth.users order by created_at,id offset 1 limit 1),true);
set local role authenticated;
do $audit$
declare
 a uuid:=current_setting('tripin.audit_a')::uuid;
 b uuid:=current_setting('tripin.audit_b')::uuid;
 ta uuid:=gen_random_uuid(); tb uuid:=gen_random_uuid();
 ca uuid:=gen_random_uuid(); cb uuid:=gen_random_uuid();
 it uuid:=gen_random_uuid(); st uuid:=gen_random_uuid(); ex uuid:=gen_random_uuid(); fb uuid:=gen_random_uuid();
 r record; n int; denied boolean; results jsonb:='[]'::jsonb;
begin
 if a is null or b is null or a=b then raise exception 'Two existing test users required'; end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 insert into public.trips(id,owner_id,name) values(tb,b,'rollback-rls-B');
 insert into public.saved_collections(id,user_id,title) values(cb,b,'rollback-collection-B');
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 insert into public.trips(id,owner_id,name) values(ta,a,'rollback-rls-A');
 insert into public.saved_collections(id,user_id,title) values(ca,a,'rollback-collection-A');
 insert into public.shopping_items(id,trip_id,created_by,name) values(it,ta,a,'rollback-item-A');
 insert into public.itinerary_stops(id,trip_id,user_id,visit_date,title,source_collection_id) values(st,ta,a,current_date,'rollback-stop-A',ca);
 insert into public.trip_expenses(id,trip_id,user_id,expense_date,title,amount) values(ex,ta,a,current_date,'rollback-expense-A',1);
 insert into public.trip_budgets(trip_id,owner_id,currency,amount) values(ta,a,'TWD',1);
 insert into public.trip_covers(trip_id,owner_id,storage_path) values(ta,a,a::text||'/rollback-cover.png');
 insert into public.beta_feedback(id,user_id,area,feedback_type,message) values(fb,a,'其他','問題回報','rollback-only audit feedback, no mail');
 results:=results||jsonb_build_array(jsonb_build_object('check','A and B create own fixtures','pass',true));
 for r in select * from (values
 ('trips','id',ta,'owner_id'),('shopping_items','id',it,'created_by'),
 ('saved_collections','id',ca,'user_id'),('itinerary_stops','id',st,'user_id'),
 ('trip_expenses','id',ex,'user_id'),('trip_budgets','trip_id',ta,'owner_id'),('trip_covers','trip_id',ta,'owner_id')
 ) as tests(tab,key_col,row_id,owner_col)
 loop
  perform set_config('request.jwt.claim.sub',a::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  execute format('select count(*) from public.%I where %I=$1',r.tab,r.key_col) into n using r.row_id;
  results:=results||jsonb_build_array(jsonb_build_object('check','A reads own '||r.tab,'pass',n=1));
  execute format('update public.%I set %I=%I where %I=$1',r.tab,r.owner_col,r.owner_col,r.key_col) using r.row_id;
  get diagnostics n=row_count;
  results:=results||jsonb_build_array(jsonb_build_object('check','A updates own '||r.tab,'pass',n=1));
  denied:=false;
  begin
   execute format('update public.%I set %I=$1 where %I=$2',r.tab,r.owner_col,r.key_col) using b,r.row_id;
  exception when insufficient_privilege then denied:=true;
  end;
  results:=results||jsonb_build_array(jsonb_build_object('check','A cannot transfer owner of '||r.tab,'pass',denied));
  perform set_config('request.jwt.claim.sub',b::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
  execute format('select count(*) from public.%I where %I=$1',r.tab,r.key_col) into n using r.row_id;
  results:=results||jsonb_build_array(jsonb_build_object('check','B cannot read A '||r.tab,'pass',n=0));
  execute format('update public.%I set %I=%I where %I=$1',r.tab,r.owner_col,r.owner_col,r.key_col) using r.row_id;
  get diagnostics n=row_count;
  results:=results||jsonb_build_array(jsonb_build_object('check','B cannot update A '||r.tab,'pass',n=0));
  execute format('delete from public.%I where %I=$1',r.tab,r.key_col) using r.row_id;
  get diagnostics n=row_count;
  results:=results||jsonb_build_array(jsonb_build_object('check','B cannot delete A '||r.tab,'pass',n=0));
 end loop;
 denied:=false;
 begin insert into public.shopping_items(trip_id,created_by,name) values(ta,b,'forbidden');
 exception when insufficient_privilege then denied:=true; end;
 results:=results||jsonb_build_array(jsonb_build_object('check','B cannot attach item to A trip','pass',denied));
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 denied:=false;
 begin insert into public.itinerary_stops(trip_id,user_id,visit_date,title,source_collection_id) values(ta,a,current_date,'forbidden-cross-collection',cb);
 exception when insufficient_privilege then denied:=true; end;
 results:=results||jsonb_build_array(jsonb_build_object('check','A cannot reference B private collection','pass',denied));
 n:=0;
 begin select count(*) into n from public.beta_feedback where id=fb;
 exception when insufficient_privilege then n:=0; end;
 results:=results||jsonb_build_array(jsonb_build_object('check','Feedback is insert-only for ordinary users','pass',n=0));
 perform set_config('tripin.audit_results',results::text,true);
end
$audit$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $anon$
declare r record; n int; results jsonb:=current_setting('tripin.audit_results')::jsonb;
begin
 for r in select unnest(array['trips','shopping_items','saved_collections','itinerary_stops','trip_expenses','trip_budgets','trip_covers','beta_feedback']) as tab
 loop
  n:=0;
  begin execute format('select count(*) from public.%I',r.tab) into n;
  exception when insufficient_privilege then n:=0; end;
  results:=results||jsonb_build_array(jsonb_build_object('check','Anonymous cannot read '||r.tab,'pass',n=0));
 end loop;
 perform set_config('tripin.audit_results',results::text,true);
end
$anon$;
reset role;
select jsonb_build_object('mode','SQL role simulation, transaction rolled back','checks',current_setting('tripin.audit_results')::jsonb) as audit_results;
rollback;
