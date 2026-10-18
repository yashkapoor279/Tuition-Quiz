-- Needs migrations through publish_quiz. Raises an error on any failure.
create function public.test_fails(p_sql text) returns boolean
language plpgsql as $$
begin execute p_sql; return false; exception when others then return true; end $$;

do $$
declare
  a uuid := '00000000-0000-0000-0000-0000000000e1';
  b uuid := '00000000-0000-0000-0000-0000000000e2';
  a_class uuid; a_empty uuid; a_quiz uuid; a_quiz2 uuid; a_quiz3 uuid;
  q1 uuid; q2 uuid; q3 uuid;
  closes timestamptz; pub timestamptz; closes_col timestamptz; st text; n int; errmsg text;
begin
  insert into auth.users (id, raw_user_meta_data) values (a, '{}'), (b, '{}');

  ---------------------------------------------------------------- setup as teacher A
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  insert into public.classrooms (name) values ('A Class') returning id into a_class;
  insert into public.quizzes (classroom_id, title) values (a_class, 'Empty Quiz') returning id into a_empty;
  insert into public.quizzes (classroom_id, title) values (a_class, 'Real Quiz') returning id into a_quiz;
  insert into public.quizzes (classroom_id, title) values (a_class, 'Second Quiz') returning id into a_quiz2;
  insert into public.quizzes (classroom_id, title) values (a_class, 'Third Quiz') returning id into a_quiz3;
  q1 := public.save_question(a_quiz, null, 'Q1', 1, array['a','b'], 0);
  q2 := public.save_question(a_quiz, null, 'Q2', 2, array['a','b','c'], 2);
  q3 := public.save_question(a_quiz2, null, 'Q3', 1, array['a','b'], 1);
  perform public.save_question(a_quiz3, null, 'Q4', 1, array['a','b'], 1);

  if not public.test_fails(format('select public.publish_quiz(%L)', a_empty)) then raise exception 'FAIL: empty quiz was published'; end if;
  select status into st from public.quizzes where id = a_empty;
  if st <> 'draft' then raise exception 'FAIL: empty quiz changed status to %', st; end if;
  reset role;

  ---------------------------------------------------------------- B and anon cannot publish A's quiz
  perform set_config('request.jwt.claim.sub', b::text, true);
  set local role authenticated;
  if not public.test_fails(format('select public.publish_quiz(%L)', a_quiz)) then raise exception 'FAIL: B published As quiz'; end if;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  if not public.test_fails(format('select public.publish_quiz(%L)', a_quiz)) then raise exception 'FAIL: anon published a quiz'; end if;
  reset role;
  select status into st from public.quizzes where id = a_quiz;
  if st <> 'draft' then raise exception 'FAIL: quiz changed status after rejected attempts'; end if;

  ---------------------------------------------------------------- A publishes
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  closes := public.publish_quiz(a_quiz);
  select status, published_at, closes_at into st, pub, closes_col from public.quizzes where id = a_quiz;
  if st <> 'published' then raise exception 'FAIL: status is %', st; end if;
  if pub <> now() then raise exception 'FAIL: published_at (%) is not the database time (%)', pub, now(); end if;
  if closes_col - pub <> interval '24 hours' then raise exception 'FAIL: window is %, not exactly 24 hours', closes_col - pub; end if;
  if closes <> closes_col then raise exception 'FAIL: returned closing time differs from stored one'; end if;

  -- cannot publish twice (the deadline must not be extendable)
  if not public.test_fails(format('select public.publish_quiz(%L)', a_quiz)) then raise exception 'FAIL: published twice'; end if;
  select closes_at into closes_col from public.quizzes where id = a_quiz;
  if closes_col <> closes then raise exception 'FAIL: deadline moved on second publish'; end if;

  -- locked after publishing
  if not public.test_fails(format('select public.save_question(%L, null, %L, 1, %L::text[], 0)', a_quiz, 'Late', '{"a","b"}')) then raise exception 'FAIL: question added after publish'; end if;
  if not public.test_fails(format('select public.save_question(%L, %L, %L, 1, %L::text[], 0)', a_quiz, q1, 'Late edit', '{"a","b"}')) then raise exception 'FAIL: question edited after publish'; end if;
  if not public.test_fails(format('select public.delete_question(%L)', q1)) then raise exception 'FAIL: question deleted after publish'; end if;
  update public.quizzes set title = 'Renamed late' where id = a_quiz;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: renamed after publish'; end if;
  delete from public.quizzes where id = a_quiz;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: deleted after publish'; end if;
  if not public.test_fails(format('update public.quizzes set closes_at = closes_at + interval %L where id = %L', '1 day', a_quiz)) then raise exception 'FAIL: A moved the deadline'; end if;

  -- other drafts are unaffected and still editable
  perform public.save_question(a_quiz2, q3, 'Q3 edited', 1, array['a','b'], 0);
  reset role;

  ---------------------------------------------------------------- incomplete quizzes are refused
  -- (as superuser: simulate data that the normal functions would never produce)
  delete from public.answer_keys where question_id = q3;
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  if not public.test_fails(format('select public.publish_quiz(%L)', a_quiz2)) then raise exception 'FAIL: published a question without an answer key'; end if;
  begin
    perform public.publish_quiz(a_quiz2);
  exception when others then errmsg := sqlerrm;
  end;
  if errmsg not like '%incomplete%' then raise exception 'FAIL: unhelpful message: %', errmsg; end if;
  reset role;

  delete from public.options where question_id = (select id from public.questions where quiz_id = a_quiz3 limit 1) and position = 2;
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  if not public.test_fails(format('select public.publish_quiz(%L)', a_quiz3)) then raise exception 'FAIL: published a question with 1 option'; end if;
  select status into st from public.quizzes where id = a_quiz3;
  if st <> 'draft' then raise exception 'FAIL: failed publish changed status'; end if;
  reset role;

  raise notice 'ALL PUBLISH TESTS PASSED';
end $$;

drop function public.test_fails(text);
