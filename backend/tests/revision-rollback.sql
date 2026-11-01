begin;
create temporary table revision_results (name text, passed boolean) on commit drop;
grant select, insert on revision_results to authenticated;
do $$ declare uid uuid; begin
 select id into uid from auth.users order by created_at limit 1;
 if uid is null then raise exception 'Dedicated test user missing'; end if;
 perform set_config('request.jwt.claims',json_build_object('sub',uid,'role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$
declare tid uuid; iid uuid; rev bigint; affected integer;
begin
 insert into public.trips(owner_id,name) values(auth.uid(),'tripin-revision-rollback') returning id into tid;
 insert into public.shopping_items(trip_id,created_by,name,revision) values(tid,auth.uid(),'initial',999) returning id,revision into iid,rev;
 insert into revision_results values('Server sets initial revision',rev=0);
 update public.shopping_items set name='first writer' where id=iid and revision=0 returning revision into rev;
 insert into revision_results values('First conditional update increments revision',rev=1);
 update public.shopping_items set name='stale writer' where id=iid and revision=0;
 get diagnostics affected = row_count;
 insert into revision_results values('Stale conditional update changes zero rows',affected=0);
 delete from public.shopping_items where id=iid and revision=0;
 get diagnostics affected = row_count;
 insert into revision_results values('Stale conditional delete changes zero rows',affected=0);
 insert into revision_results select 'Newer data survived stale operations',name='first writer' and revision=1 from public.shopping_items where id=iid;
 update public.shopping_items set revision=0,bought=true where id=iid and revision=1 returning revision into rev;
 insert into revision_results values('Client cannot reset revision on update',rev=2);
 delete from public.shopping_items where id=iid and revision=2;
 get diagnostics affected = row_count;
 insert into revision_results values('Current revision delete succeeds',affected=1);
end $$;
select name,passed from revision_results;
rollback;