-- Approved test project only; production application requires separate review.
begin;
alter table public.shopping_items add column revision bigint not null default 0 check (revision >= 0);
create function public.shopping_items_bump_revision()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if TG_OP = 'INSERT' then
    NEW.revision := 0;
  else
    NEW.revision := OLD.revision + 1;
    NEW.updated_at := clock_timestamp();
  end if;
  return NEW;
end;
$$;
revoke all on function public.shopping_items_bump_revision() from public, anon, authenticated;
create trigger shopping_items_revision before insert or update on public.shopping_items
for each row execute function public.shopping_items_bump_revision();
commit;
