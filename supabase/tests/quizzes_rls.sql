-- Needs migrations for profiles, classrooms/students and quizzes. Raises an error on any failure.
create function public.test_fails(p_sql text) returns boolean
language plpgsql as $$
begin execute p_sql; return false; exception when others then return true; end $$;

do $$
declare
  a uuid := '00000000-0000-0000-0000-0000000000d1';
  b uuid := '00000000-0000-0000-0000-0000000000d2';
  a_class uuid; b_class uuid; a_quiz uuid; a_quiz2 uuid; b_quiz uuid;
  q1 uuid; q2 uuid; b_q uuid;
  n int; v text; arr text[]; st text; pub timestamptz;
begin
  insert into auth.users (id, raw_user_meta_data) values (a, '{}'), (b, '{}');

  ---------------------------------------------------------------- setup classrooms + B's quiz
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  insert into public.classrooms (name) values ('A Class') returning id into a_class;
  reset role;
  perform set_config('request.jwt.claim.sub', b::text, true);
  set local role authenticated;
  insert into public.classrooms (name) values ('B Class') returning id into b_class;
  insert into public.quizzes (classroom_id, title) values (b_class, 'B Quiz') returning id into b_quiz;
  reset role;

  ---------------------------------------------------------------- teacher A
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;

  insert into public.quizzes (classroom_id, title) values (a_class, 'Fractions Test')
    returning id, status, published_at into a_quiz, st, pub;
  if st <> 'draft' or pub is not null then raise exception 'FAIL: new quiz should be an unpublished draft'; end if;

  if not public.test_fails(format('insert into public.quizzes (classroom_id, title) values (%L, %L)', b_class, 'Sneaky')) then
    raise exception 'FAIL: A created a quiz in Bs classroom'; end if;
  if not public.test_fails(format('insert into public.quizzes (classroom_id, title, status) values (%L, %L, %L)', a_class, 'Sneaky', 'published')) then
    raise exception 'FAIL: A set status on insert'; end if;
  if not public.test_fails(format('update public.quizzes set status = %L where id = %L', 'published', a_quiz)) then
    raise exception 'FAIL: A published directly'; end if;
  if not public.test_fails(format('update public.quizzes set closes_at = now() where id = %L', a_quiz)) then
    raise exception 'FAIL: A set closes_at directly'; end if;

  -- valid questions
  q1 := public.save_question(a_quiz, null, '  What is 1/2 + 1/2?  ', 2, array['1','2','1/4','0'], 0);
  q2 := public.save_question(a_quiz, null, 'Second question', 1, array['yes','no'], 1);

  select body into v from public.questions where id = q1;
  if v <> 'What is 1/2 + 1/2?' then raise exception 'FAIL: body not trimmed: [%]', v; end if;
  select array_agg(body order by position) into arr from public.options where question_id = q1;
  if arr <> array['1','2','1/4','0'] then raise exception 'FAIL: options wrong: %', arr; end if;
  select o.body into v from public.answer_keys k
    join public.options o on o.id = k.correct_option_id and o.question_id = k.question_id
    where k.question_id = q1;
  if v <> '1' then raise exception 'FAIL: key for q1 should be option 1, got %', v; end if;
  select position into n from public.questions where id = q2;
  if n <> 2 then raise exception 'FAIL: q2 position should be 2, got %', n; end if;

  -- edit q1: new options, new key, same position, still one key, no duplicate question
  perform public.save_question(a_quiz, q1, 'Updated', 3, array['x','y','z'], 2);
  select array_agg(body order by position) into arr from public.options where question_id = q1;
  if arr <> array['x','y','z'] then raise exception 'FAIL: edit options wrong: %', arr; end if;
  select o.body into v from public.answer_keys k
    join public.options o on o.id = k.correct_option_id and o.question_id = k.question_id
    where k.question_id = q1;
  if v <> 'z' then raise exception 'FAIL: key after edit should be z, got %', v; end if;
  select count(*) into n from public.answer_keys where question_id = q1;
  if n <> 1 then raise exception 'FAIL: expected exactly 1 key for q1, got %', n; end if;
  select count(*) into n from public.questions where quiz_id = a_quiz;
  if n <> 2 then raise exception 'FAIL: expected 2 questions, got %', n; end if;
  select position, marks into n, st from public.questions where id = q1; -- st reused as text of marks
  if n <> 1 or st <> '3' then raise exception 'FAIL: q1 position/marks wrong: % %', n, st; end if;

  -- invalid input is rejected
  if not public.test_fails(format('select public.save_question(%L, null, %L, %s, %L::text[], %s)', a_quiz, 'Q', 1, '{"a"}', 0)) then raise exception 'FAIL: 1 option accepted'; end if;
  if not public.test_fails(format('select public.save_question(%L, null, %L, %s, %L::text[], %s)', a_quiz, 'Q', 1, '{"a","b","c","d","e"}', 0)) then raise exception 'FAIL: 5 options accepted'; end if;
  if not public.test_fails(format('select public.save_question(%L, null, %L, %s, %L::text[], %s)', a_quiz, '   ', 1, '{"a","b"}', 0)) then raise exception 'FAIL: blank question accepted'; end if;
  if not public.test_fails(format('select public.save_question(%L, null, %L, %s, %L::text[], %s)', a_quiz, 'Q', 0, '{"a","b"}', 0)) then raise exception 'FAIL: 0 marks accepted'; end if;
  if not public.test_fails(format('select public.save_question(%L, null, %L, %s, %L::text[], %s)', a_quiz, 'Q', 101, '{"a","b"}', 0)) then raise exception 'FAIL: 101 marks accepted'; end if;
  if not public.test_fails(format('select public.save_question(%L, null, %L, %s, %L::text[], %s)', a_quiz, 'Q', 1, '{"a","b"}', 2)) then raise exception 'FAIL: out-of-range key accepted'; end if;
  if not public.test_fails(format('select public.save_question(%L, null, %L, %s, %L::text[], %s)', a_quiz, 'Q', 1, '{"a","b"}', -1)) then raise exception 'FAIL: negative key accepted'; end if;
  if not public.test_fails(format('select public.save_question(%L, null, %L, %s, %L::text[], %s)', a_quiz, 'Q', 1, '{"a",""}', 0)) then raise exception 'FAIL: blank option accepted'; end if;
  select count(*) into n from public.questions where quiz_id = a_quiz;
  if n <> 2 then raise exception 'FAIL: failed saves left partial data (% questions)', n; end if;

  -- 100-question limit
  insert into public.quizzes (classroom_id, title) values (a_class, 'Big Quiz') returning id into a_quiz2;
  for i in 1..100 loop perform public.save_question(a_quiz2, null, 'Q ' || i, 1, array['a','b'], 0); end loop;
  if not public.test_fails(format('select public.save_question(%L, null, %L, %s, %L::text[], %s)', a_quiz2, 'One too many', 1, '{"a","b"}', 0)) then
    raise exception 'FAIL: 101st question accepted'; end if;

  -- direct table writes are blocked (only the functions may write content)
  if not public.test_fails(format('insert into public.questions (quiz_id, body, marks) values (%L, %L, 1)', a_quiz, 'direct')) then raise exception 'FAIL: direct question insert'; end if;
  if not public.test_fails(format('insert into public.options (question_id, position, body) values (%L, 9, %L)', q1, 'direct')) then raise exception 'FAIL: direct option insert'; end if;
  if not public.test_fails(format('update public.answer_keys set correct_option_id = correct_option_id where question_id = %L', q1)) then raise exception 'FAIL: direct key update'; end if;
  if not public.test_fails(format('delete from public.questions where id = %L', q1)) then raise exception 'FAIL: direct question delete'; end if;

  -- A can read own content
  select count(*) into n from public.answer_keys where question_id in (q1, q2);
  if n <> 2 then raise exception 'FAIL: A cannot read own keys (%)', n; end if;

  -- rename draft works
  update public.quizzes set title = 'Fractions Test 2' where id = a_quiz;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: A could not rename draft'; end if;
  reset role;

  ---------------------------------------------------------------- teacher B
  perform set_config('request.jwt.claim.sub', b::text, true);
  set local role authenticated;

  select count(*) into n from public.quizzes;
  if n <> 1 then raise exception 'FAIL: B sees % quizzes (expected 1)', n; end if;
  select count(*) into n from public.questions;
  if n <> 0 then raise exception 'FAIL: B sees % questions', n; end if;
  select count(*) into n from public.options;
  if n <> 0 then raise exception 'FAIL: B sees % options', n; end if;
  select count(*) into n from public.answer_keys;
  if n <> 0 then raise exception 'FAIL: B sees % answer keys', n; end if;

  if not public.test_fails(format('select public.save_question(%L, null, %L, 1, %L::text[], 0)', a_quiz, 'Intruder', '{"a","b"}')) then raise exception 'FAIL: B added a question to As quiz'; end if;
  if not public.test_fails(format('select public.save_question(%L, %L, %L, 1, %L::text[], 0)', a_quiz, q1, 'Hijack', '{"a","b"}')) then raise exception 'FAIL: B edited As question'; end if;
  if not public.test_fails(format('select public.delete_question(%L)', q1)) then raise exception 'FAIL: B deleted As question'; end if;

  -- B cannot smuggle As question into Bs own quiz
  if not public.test_fails(format('select public.save_question(%L, %L, %L, 1, %L::text[], 0)', b_quiz, q1, 'Smuggle', '{"a","b"}')) then raise exception 'FAIL: B edited As question via own quiz'; end if;

  update public.quizzes set title = 'Hacked' where id = a_quiz;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B renamed As quiz'; end if;
  delete from public.quizzes where id = a_quiz;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B deleted As quiz'; end if;

  b_q := public.save_question(b_quiz, null, 'B question', 1, array['p','q'], 1);
  if b_q is null then raise exception 'FAIL: B could not add to own quiz'; end if;
  reset role;

  ---------------------------------------------------------------- anonymous
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  if not public.test_fails('select count(*) from public.quizzes') then raise exception 'FAIL: anon read quizzes'; end if;
  if not public.test_fails('select count(*) from public.questions') then raise exception 'FAIL: anon read questions'; end if;
  if not public.test_fails('select count(*) from public.options') then raise exception 'FAIL: anon read options'; end if;
  if not public.test_fails('select count(*) from public.answer_keys') then raise exception 'FAIL: anon read answer keys'; end if;
  if not public.test_fails(format('select public.save_question(%L, null, %L, 1, %L::text[], 0)', a_quiz, 'Anon', '{"a","b"}')) then raise exception 'FAIL: anon saved a question'; end if;
  reset role;

  ---------------------------------------------------------------- database-level integrity (as superuser)
  if not public.test_fails(format('update public.answer_keys set correct_option_id = (select id from public.options where question_id = %L limit 1) where question_id = %L', q1, q2)) then
    raise exception 'FAIL: answer key pointing at another question accepted'; end if;

  -- simulate Phase 4 publishing
  if not public.test_fails(format('update public.quizzes set status = %L, published_at = now(), closes_at = now() + interval %L where id = %L', 'published', '23 hours', a_quiz)) then
    raise exception 'FAIL: a 23-hour deadline was accepted'; end if;
  if not public.test_fails(format('update public.quizzes set status = %L where id = %L', 'published', a_quiz)) then
    raise exception 'FAIL: published without timestamps accepted'; end if;
  update public.quizzes set status = 'published', published_at = now(), closes_at = now() + interval '24 hours' where id = a_quiz;

  ---------------------------------------------------------------- A after publishing: locked
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  if not public.test_fails(format('select public.save_question(%L, null, %L, 1, %L::text[], 0)', a_quiz, 'Late', '{"a","b"}')) then raise exception 'FAIL: added question to published quiz'; end if;
  if not public.test_fails(format('select public.save_question(%L, %L, %L, 1, %L::text[], 0)', a_quiz, q1, 'Late edit', '{"a","b"}')) then raise exception 'FAIL: edited published question'; end if;
  if not public.test_fails(format('select public.delete_question(%L)', q1)) then raise exception 'FAIL: deleted published question'; end if;
  update public.quizzes set title = 'Renamed late' where id = a_quiz;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: renamed published quiz'; end if;
  delete from public.quizzes where id = a_quiz;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: deleted published quiz'; end if;
  select count(*) into n from public.answer_keys where question_id in (q1, q2);
  if n <> 2 then raise exception 'FAIL: A cannot read keys of published quiz'; end if;

  ---------------------------------------------------------------- cascades
  delete from public.quizzes where id = a_quiz2;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: A could not delete draft quiz'; end if;
  reset role;
  select count(*) into n from public.questions where quiz_id = a_quiz2;
  if n <> 0 then raise exception 'FAIL: questions survived quiz deletion'; end if;
  select count(*) into n from public.options o join public.questions q on q.id = o.question_id where q.quiz_id = a_quiz2;
  if n <> 0 then raise exception 'FAIL: options survived quiz deletion'; end if;

  raise notice 'ALL QUIZ TESTS PASSED';
end $$;

drop function public.test_fails(text);
