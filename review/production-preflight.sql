-- Read-only contract check for a separately reviewed production rollout.
-- This script changes no data, schema, policy, bucket, or deployment.
begin read only;
with checks as (
 select 'public_table_rls' as check_name,
        case when not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity) then 'PASS' else 'BLOCKED' end as status,
        'Every exposed public table must have RLS enabled; this alone does not validate policy semantics.' as detail
 union all
 select 'private_photo_buckets',
        case when not exists(select 1 from storage.buckets where id in ('collection-photos','trip-covers','item-images','shopping-item-photos') and public) then 'PASS' else 'BLOCKED' end,
        'Known photo buckets must not be public; actual object-level policies require separate tests.'
 union all
 select 'shopping_revision_column',
        case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='shopping_items' and column_name='revision' and data_type='bigint' and is_nullable='NO') then 'PASS' else 'BLOCKED' end,
        'The reviewed Next item mutation patch requires a non-null bigint revision column.'
 union all
 select 'shopping_revision_trigger',
        case when exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid where n.nspname='public' and c.relname='shopping_items' and t.tgname='shopping_items_revision' and t.tgenabled='O' and not p.prosecdef) then 'PASS' else 'BLOCKED' end,
        'The enabled revision trigger must run without SECURITY DEFINER; its definition still needs review.'
 union all
 select 'public_security_definer_execute',
        case when exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))) then 'REVIEW' else 'PASS' end,
        'Review broad function grants and return types. This is not proof that an event-trigger function is callable as RPC.'
)
select check_name,status,detail from checks order by check_name;
rollback;
