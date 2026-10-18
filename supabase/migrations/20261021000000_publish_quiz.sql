-- Phase 4: publishing.
--  * publish_quiz() is the ONLY way a quiz becomes published. Times come from the database clock:
--    published_at = now(), closes_at = published_at + 24 hours (also enforced by a table check).
--  * save_question / delete_question are re-created so they lock the quiz row while editing.
--    Publishing takes the same lock, so an edit and a publish can never interleave.

create or replace function public.save_question(
  p_quiz_id uuid,
  p_question_id uuid,
  p_body text,
  p_marks int,
  p_options text[],
  p_correct_index int
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question_id uuid;
  v_option_id uuid;
  v_correct_option uuid;
  v_n int := coalesce(array_length(p_options, 1), 0);
  i int;
begin
  if not public.owns_quiz(p_quiz_id, true) then
    raise exception 'Quiz not found or no longer editable' using errcode = '42501';
  end if;
  -- Hold a share lock on the quiz row until this transaction ends. publish_quiz needs an
  -- exclusive lock, so it waits for us; if it got there first, this re-check sees "published".
  perform 1 from public.quizzes where id = p_quiz_id and status = 'draft' for share;
  if not found then
    raise exception 'Quiz not found or no longer editable' using errcode = '42501';
  end if;

  if p_body is null or char_length(btrim(p_body)) not between 1 and 1000 then
    raise exception 'Question text must be 1 to 1000 characters' using errcode = '22023';
  end if;
  if p_marks is null or p_marks not between 1 and 100 then
    raise exception 'Marks must be between 1 and 100' using errcode = '22023';
  end if;
  if v_n not between 2 and 4 then
    raise exception 'A question needs 2 to 4 options' using errcode = '22023';
  end if;
  for i in 1..v_n loop
    if p_options[i] is null or char_length(btrim(p_options[i])) not between 1 and 300 then
      raise exception 'Each option must be 1 to 300 characters' using errcode = '22023';
    end if;
  end loop;
  if p_correct_index is null or p_correct_index not between 0 and v_n - 1 then
    raise exception 'Choose which option is correct' using errcode = '22023';
  end if;

  if p_question_id is null then
    if (select count(*) from public.questions where quiz_id = p_quiz_id) >= 100 then
      raise exception 'A quiz can have at most 100 questions' using errcode = '22023';
    end if;
    insert into public.questions (quiz_id, position, body, marks)
    values (
      p_quiz_id,
      coalesce((select max(position) from public.questions where quiz_id = p_quiz_id), 0) + 1,
      btrim(p_body),
      p_marks
    )
    returning id into v_question_id;
  else
    update public.questions
       set body = btrim(p_body), marks = p_marks
     where id = p_question_id and quiz_id = p_quiz_id
    returning id into v_question_id;
    if v_question_id is null then
      raise exception 'Question not found in this quiz' using errcode = '42501';
    end if;
    delete from public.options where question_id = v_question_id; -- also removes the old answer key
  end if;

  for i in 1..v_n loop
    insert into public.options (question_id, position, body)
    values (v_question_id, i, btrim(p_options[i]))
    returning id into v_option_id;
    if i = p_correct_index + 1 then v_correct_option := v_option_id; end if;
  end loop;

  insert into public.answer_keys (question_id, correct_option_id)
  values (v_question_id, v_correct_option);

  return v_question_id;
end;
$$;

create or replace function public.delete_question(p_question_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quiz_id uuid;
begin
  if not public.owns_question(p_question_id, true) then
    raise exception 'Question not found or no longer editable' using errcode = '42501';
  end if;
  select quiz_id into v_quiz_id from public.questions where id = p_question_id;
  perform 1 from public.quizzes where id = v_quiz_id and status = 'draft' for share;
  if not found then
    raise exception 'Question not found or no longer editable' using errcode = '42501';
  end if;
  delete from public.questions where id = p_question_id;
end;
$$;

-- Publishes a draft quiz. Returns the closing time.
create function public.publish_quiz(p_quiz_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_now timestamptz := now();
  v_questions int;
  v_incomplete int;
begin
  if not public.owns_quiz(p_quiz_id) then
    raise exception 'Quiz not found' using errcode = '42501';
  end if;

  -- Exclusive lock: waits for any in-progress edit, and blocks new edits until we finish.
  select status into v_status from public.quizzes where id = p_quiz_id for update;
  if v_status <> 'draft' then
    raise exception 'This quiz is already published' using errcode = '22023';
  end if;

  select count(*) into v_questions from public.questions where quiz_id = p_quiz_id;
  if v_questions = 0 then
    raise exception 'Add at least one question before publishing' using errcode = '22023';
  end if;

  select count(*) into v_incomplete
  from public.questions q
  where q.quiz_id = p_quiz_id
    and (
      (select count(*) from public.options o where o.question_id = q.id) not between 2 and 4
      or not exists (select 1 from public.answer_keys k where k.question_id = q.id)
    );
  if v_incomplete > 0 then
    raise exception '% question(s) are incomplete (need 2 to 4 options and a correct answer)', v_incomplete
      using errcode = '22023';
  end if;

  update public.quizzes
     set status = 'published',
         published_at = v_now,
         closes_at = v_now + interval '24 hours'
   where id = p_quiz_id;

  return v_now + interval '24 hours';
end;
$$;

revoke all on function public.save_question(uuid, uuid, text, int, text[], int) from public, anon, authenticated;
revoke all on function public.delete_question(uuid) from public, anon, authenticated;
revoke all on function public.publish_quiz(uuid) from public, anon, authenticated;
grant execute on function public.save_question(uuid, uuid, text, int, text[], int) to authenticated;
grant execute on function public.delete_question(uuid) to authenticated;
grant execute on function public.publish_quiz(uuid) to authenticated;
