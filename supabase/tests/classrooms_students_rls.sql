-- Needs the profiles + classrooms/students migrations applied. Raises an error on any failure.
do $$
declare
  a uuid := '00000000-0000-0000-0000-0000000000c1';
  b uuid := '00000000-0000-0000-0000-0000000000c2';
  a_class uuid;
  b_class uuid;
  a_code text;
  n int;
  v text;
  ok boolean;
begin
  insert into auth.users (id, raw_user_meta_data) values (a, '{"full_name":"Teacher A"}'), (b, '{"full_name":"Teacher B"}');

  ------------------------------------------------------------------ as teacher A
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;

  insert into public.classrooms (name) values ('Class 5 Maths') returning id, join_code into a_class, v;
  if v !~ '^[A-HJ-NP-Z2-9]{6}$' then raise exception 'FAIL: bad join code %', v; end if;
  if (select teacher_id from public.classrooms where id = a_class) <> a then
    raise exception 'FAIL: teacher_id not set to caller'; end if;

  insert into public.students (classroom_id, full_name) values (a_class, 'Rohan Kumar Sharma') returning login_code into v;
  if v !~ '^RKS-[0-9]{4}$' then raise exception 'FAIL: expected RKS-dddd, got %', v; end if;
  insert into public.students (classroom_id, full_name) values (a_class, 'Asha Rao') returning login_code into v;
  if v !~ '^ARX-[0-9]{4}$' then raise exception 'FAIL: expected ARX-dddd, got %', v; end if;
  insert into public.students (classroom_id, full_name) values (a_class, 'राम') returning login_code into v;
  if v !~ '^XXX-[0-9]{4}$' then raise exception 'FAIL: expected XXX-dddd, got %', v; end if;

  -- 200 students with identical names: every code must be unique within the class
  insert into public.students (classroom_id, full_name)
    select a_class, 'Same Name' from generate_series(1, 200);
  select count(distinct login_code) into n from public.students where classroom_id = a_class and full_name = 'Same Name';
  if n <> 200 then raise exception 'FAIL: expected 200 unique codes, got %', n; end if;

  select login_code into a_code from public.students where classroom_id = a_class limit 1;

  -- cannot choose protected columns on insert
  ok := false;
  begin insert into public.classrooms (name, join_code) values ('X Class', 'AAAAAA');
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL: A could set join_code'; end if;

  ok := false;
  begin insert into public.classrooms (name, teacher_id) values ('X Class', b);
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL: A could set teacher_id'; end if;

  ok := false;
  begin insert into public.students (classroom_id, full_name, login_code) values (a_class, 'Zed Zed', 'ZZZ-0000');
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL: A could set login_code'; end if;

  -- cannot change protected columns on update
  ok := false;
  begin update public.students set login_code = 'ABC-1234' where classroom_id = a_class;
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL: A could change login_code'; end if;

  ok := false;
  begin update public.students set classroom_id = gen_random_uuid() where classroom_id = a_class;
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL: A could move students'; end if;

  -- name constraints
  ok := false;
  begin insert into public.classrooms (name) values ('a');
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'FAIL: 1-char classroom name accepted'; end if;

  -- renaming works
  update public.classrooms set name = 'Class 5 Science' where id = a_class;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: A could not rename own classroom'; end if;

  reset role;
  ------------------------------------------------------------------ as teacher B
  perform set_config('request.jwt.claim.sub', b::text, true);
  set local role authenticated;

  insert into public.classrooms (name) values ('Class 6 English') returning id into b_class;

  select count(*) into n from public.classrooms;
  if n <> 1 then raise exception 'FAIL: B sees % classrooms (expected 1)', n; end if;
  select count(*) into n from public.students;
  if n <> 0 then raise exception 'FAIL: B sees % students (expected 0)', n; end if;

  ok := false;
  begin insert into public.students (classroom_id, full_name) values (a_class, 'Intruder One');
  exception when insufficient_privilege or others then ok := true; end;
  if not ok then raise exception 'FAIL: B added a student to As classroom'; end if;

  update public.classrooms set name = 'Hacked' where id = a_class;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B renamed As classroom'; end if;

  update public.students set full_name = 'Hacked' where classroom_id = a_class;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B renamed As students'; end if;

  delete from public.students where classroom_id = a_class;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B deleted As students'; end if;

  delete from public.classrooms where id = a_class;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B deleted As classroom'; end if;

  reset role;
  ------------------------------------------------------------------ anonymous
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  ok := false;
  begin perform count(*) from public.students;
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL: anon could read students'; end if;
  ok := false;
  begin perform count(*) from public.classrooms;
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL: anon could read classrooms'; end if;
  reset role;

  ------------------------------------------------------------------ cascade
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  delete from public.classrooms where id = a_class;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: A could not delete own classroom'; end if;
  reset role;
  select count(*) into n from public.students where classroom_id = a_class;
  if n <> 0 then raise exception 'FAIL: students not removed with classroom'; end if;

  raise notice 'ALL CLASSROOM/STUDENT TESTS PASSED';
end $$;
