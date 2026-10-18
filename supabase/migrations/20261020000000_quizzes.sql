-- Phase 3: quizzes, questions, options and private answer keys.
--
-- Design rules:
--  * Teachers can READ their own quiz content, but can only WRITE it through the
--    save_question / delete_question functions below (validated, all-or-nothing).
--  * answer_keys is its own table. Students will never be granted access to it.
--  * Content is editable only while the quiz is a draft.
--  * Publishing itself comes in Phase 4; the columns and the exact-24-hours rule
--    are created now so the schema is stable. Teachers cannot write them directly.

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 120),
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  closes_at timestamptz,
  created_at timestamptz not null default now(),
  constraint quizzes_publish_consistency check (
    (status = 'draft' and published_at is null and closes_at is null)
    or (status = 'published' and published_at is not null
        and closes_at = published_at + interval '24 hours')
  )
);
create index quizzes_classroom_id_idx on public.quizzes (classroom_id);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  position int not null,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  marks int not null check (marks between 1 and 100),
  created_at timestamptz not null default now()
);
create index questions_quiz_id_idx on public.questions (quiz_id);

create table public.options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  position int not null,
  body text not null check (char_length(btrim(body)) between 1 and 300),
  created_at timestamptz not null default now(),
  unique (id, question_id)
);
create index options_question_id_idx on public.options (question_id);

create table public.answer_keys (
  question_id uuid primary key references public.questions (id) on delete cascade,
  correct_option_id uuid not null,
  -- the correct option must belong to the same question
  foreign key (correct_option_id, question_id)
    references public.options (id, question_id) on delete cascade
);

-- ---------- ownership helpers (used by policies and functions) ----------

create function public.owns_quiz(p_quiz_id uuid, p_require_draft boolean default false)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.quizzes q
    join public.classrooms c on c.id = q.classroom_id
    where q.id = p_quiz_id
      and c.teacher_id = (select auth.uid())
      and (not p_require_draft or q.status = 'draft')
  );
$$;

create function public.owns_question(p_question_id uuid, p_require_draft boolean default false)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.questions qu
    join public.quizzes q on q.id = qu.quiz_id
    join public.classrooms c on c.id = q.classroom_id
    where qu.id = p_question_id
      and c.teacher_id = (select auth.uid())
      and (not p_require_draft or q.status = 'draft')
  );
$$;

-- ---------- write functions ----------

-- Create (p_question_id is null) or replace a question together with its options and answer key.
-- p_correct_index is 0-based and refers to p_options.
create function public.save_question(
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

create function public.delete_question(p_question_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.owns_question(p_question_id, true) then
    raise exception 'Question not found or no longer editable' using errcode = '42501';
  end if;
  delete from public.questions where id = p_question_id;
end;
$$;

revoke all on function public.owns_quiz(uuid, boolean) from public, anon, authenticated;
revoke all on function public.owns_question(uuid, boolean) from public, anon, authenticated;
revoke all on function public.save_question(uuid, uuid, text, int, text[], int) from public, anon, authenticated;
revoke all on function public.delete_question(uuid) from public, anon, authenticated;
grant execute on function public.owns_quiz(uuid, boolean) to authenticated;
grant execute on function public.owns_question(uuid, boolean) to authenticated;
grant execute on function public.save_question(uuid, uuid, text, int, text[], int) to authenticated;
grant execute on function public.delete_question(uuid) to authenticated;

-- ---------- privileges ----------

revoke all on public.quizzes, public.questions, public.options, public.answer_keys from anon, authenticated;

grant select on public.quizzes, public.questions, public.options, public.answer_keys to authenticated;
grant insert (classroom_id, title) on public.quizzes to authenticated;
grant update (title) on public.quizzes to authenticated;
grant delete on public.quizzes to authenticated;
-- questions / options / answer_keys: read-only for teachers; writes go through the functions above.

-- ---------- row level security ----------

alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.options enable row level security;
alter table public.answer_keys enable row level security;

-- Quiz rules check the row's own columns directly (not a helper that re-reads the table),
-- so that "insert ... returning" works: a function cannot see the row being inserted.
create policy "quizzes_select_own" on public.quizzes
  for select to authenticated
  using (exists (select 1 from public.classrooms c
                 where c.id = quizzes.classroom_id and c.teacher_id = (select auth.uid())));
create policy "quizzes_insert_own" on public.quizzes
  for insert to authenticated
  with check (exists (select 1 from public.classrooms c
                      where c.id = quizzes.classroom_id and c.teacher_id = (select auth.uid())));
create policy "quizzes_update_draft_own" on public.quizzes
  for update to authenticated
  using (status = 'draft' and exists (select 1 from public.classrooms c
                 where c.id = quizzes.classroom_id and c.teacher_id = (select auth.uid())))
  with check (status = 'draft' and exists (select 1 from public.classrooms c
                 where c.id = quizzes.classroom_id and c.teacher_id = (select auth.uid())));
create policy "quizzes_delete_draft_own" on public.quizzes
  for delete to authenticated
  using (status = 'draft' and exists (select 1 from public.classrooms c
                 where c.id = quizzes.classroom_id and c.teacher_id = (select auth.uid())));

create policy "questions_select_own" on public.questions
  for select to authenticated using (public.owns_quiz(quiz_id));
create policy "options_select_own" on public.options
  for select to authenticated using (public.owns_question(question_id));
create policy "answer_keys_select_own" on public.answer_keys
  for select to authenticated using (public.owns_question(question_id));
