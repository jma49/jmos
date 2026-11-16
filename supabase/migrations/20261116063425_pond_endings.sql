-- The pond that ages: how many visitors have reached the pond's third
-- ending (docs/decisions/0029-no-name-the-third-ending.md).
--
-- Every visitor who reaches the end fades the looks a little for
-- everyone, so the database keeps one row for each of them, and the pond
-- reads how many there are.
--
-- - pond_endings has a row to a visitor. Visitors have no account, so a
--   visitor is the salted hash of their address, as a Soapbox reaction's
--   is (soapbox_reaction_visitor(), with the same `visitor_salt` in
--   private.secrets). A signed-in member is counted by address too: the
--   end is reached in a browser, with or without an account, and must
--   not count twice.
-- - Everyone reads `reached_at` and nothing else, which is enough to
--   count the rows; the hash is never readable through the API.
-- - Anyone may insert, and what they send is thrown away: a trigger
--   writes the whole row (the hash, and the database's own time). The
--   insert policy checks that the row is one the trigger wrote.
-- - A visitor counted already is not an error: the trigger returns null,
--   so the insert adds nothing and answers as any other. The site's
--   insert is then a plain one, the same from every client, and the
--   primary key stays as the last guard.
-- - At most 6 new rows in any one hour, site-wide. Reaching the end
--   takes weeks, so more than that is someone inventing addresses. The
--   count is taken under an advisory lock, one for the whole table, so
--   inserts at the same moment can't all get through, and two from one
--   address wait for each other rather than meeting at the primary key.
-- - No one updates or deletes through the API: there is no grant and no
--   policy for either.
--
-- No security definer function is callable by visitors or members here:
-- the trigger function's execute is revoked, and the count is a plain
-- select. It leaves no Security Advisor finding.
--
-- Applied with `supabase db push` after 20261004025117_member_limits.sql
-- (schema.sql already includes it). It can be run again safely.

create table if not exists public.pond_endings (
  -- A salted hash of the visitor's IP address; never readable through the API.
  visitor text primary key,
  reached_at timestamptz not null default now()
);

alter table public.pond_endings enable row level security;

drop policy if exists "The count of endings is public" on public.pond_endings;
create policy "The count of endings is public"
  on public.pond_endings for select
  to anon, authenticated
  using (true);

-- The trigger below runs before this check, so the check sees the row
-- the trigger wrote: a hash, never what the caller sent.
drop policy if exists "Anyone can reach the end" on public.pond_endings;
create policy "Anyone can reach the end"
  on public.pond_endings for insert
  to anon, authenticated
  with check (visitor ~ '^[0-9a-f]{64}$');

-- Visitors see when each ending was reached (so they can count them),
-- not whose it was. An insert has to name a column; the trigger replaces
-- whatever it's given.
revoke all on public.pond_endings from anon, authenticated;
grant select (reached_at) on public.pond_endings to anon, authenticated;
grant insert (visitor) on public.pond_endings to anon, authenticated;

-- Writes the row for whoever is asking: `visitor` from the request's IP
-- address (without one a visitor can't be told apart, so it's refused)
-- and `reached_at` from the database's clock. Returns null, adding no
-- row, for a visitor counted already. Refuses a seventh new visitor in
-- an hour.
create or replace function public.pond_ending_visitor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  headers json := nullif(current_setting('request.headers', true), '')::json;
  address text := coalesce(
    headers ->> 'cf-connecting-ip',
    headers ->> 'x-real-ip',
    trim(split_part(headers ->> 'x-forwarded-for', ',', 1))
  );
  salt text := (select value from private.secrets where name = 'visitor_salt');
begin
  if address is null or address = '' then
    raise exception 'Can''t tell who reached the end.';
  end if;
  new.visitor := encode(sha256(convert_to(salt || address, 'UTF8')), 'hex');
  new.reached_at := now();
  -- One lock for the table: the limit is site-wide, and the same
  -- visitor asking twice at once must find their first row.
  perform pg_advisory_xact_lock(hashtextextended('pond_endings', 0));
  if exists (select 1 from public.pond_endings where visitor = new.visitor) then
    return null;
  end if;
  if (select count(*) from public.pond_endings where reached_at > now() - interval '1 hour') >= 6 then
    raise exception using errcode = 'P0429', message = 'The pond is very busy right now. Try again in an hour.';
  end if;
  return new;
end;
$$;
revoke all on function public.pond_ending_visitor() from public, anon, authenticated;

drop trigger if exists pond_ending_visitor on public.pond_endings;
create trigger pond_ending_visitor
  before insert on public.pond_endings
  for each row execute function public.pond_ending_visitor();

notify pgrst, 'reload schema';
