-- Run against a database where the migration is applied. Raises an error on failure.
-- Local stand-in for Supabase: stub auth schema and roles are created by the runner.
do $$
declare
  a uuid := '00000000-0000-0000-0000-00000000000a';
  b uuid := '00000000-0000-0000-0000-00000000000b';
  n int;
begin
  insert into auth.users (id, raw_user_meta_data) values (a, '{"full_name":"Teacher A"}');
  insert into auth.users (id, raw_user_meta_data) values (b, '{}');

  -- trigger created both profiles
  select count(*) into n from public.profiles;
  if n <> 2 then raise exception 'FAIL: expected 2 profiles, got %', n; end if;

  -- act as teacher A
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;

  select count(*) into n from public.profiles;
  if n <> 1 then raise exception 'FAIL: A should see 1 profile, saw %', n; end if;

  update public.profiles set full_name = 'A Renamed' where id = a;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: A could not update own profile'; end if;

  update public.profiles set full_name = 'Hacked' where id = b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: A updated B profile'; end if;

  begin
    insert into public.profiles (id, full_name) values (gen_random_uuid(), 'x');
    raise exception 'FAIL: A could insert a profile';
  exception when insufficient_privilege or others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;

  begin
    delete from public.profiles where id = a;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'FAIL: A deleted a profile'; end if;
  exception when insufficient_privilege then null;
  end;

  -- anonymous visitor sees nothing / is blocked
  reset role;
  set local role anon;
  begin
    select count(*) into n from public.profiles;
    if n <> 0 then raise exception 'FAIL: anon saw % profiles', n; end if;
  exception when insufficient_privilege then null;
  end;

  reset role;
  raise notice 'ALL PROFILE RLS TESTS PASSED';
end $$;
