-- StudyPilot AI schema. Run in the Supabase SQL editor or via `supabase db push`.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '' check (char_length(name) <= 80),
  study_hours_per_day numeric(3,1) not null default 2 check (study_hours_per_day between 0.5 and 16),
  session_minutes int not null default 45 check (session_minutes between 15 and 180),
  tutor_history_enabled boolean not null default false,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  exam_date date,
  daily_hours numeric(3,1) check (daily_hours is null or daily_hours between 0.5 and 16),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subjects_user_idx on public.subjects(user_id);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  difficulty int not null default 3 check (difficulty between 1 and 5),
  mastery int not null default 0 check (mastery between 0 and 100),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index topics_user_idx on public.topics(user_id);
create index topics_subject_idx on public.topics(subject_id);

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  session_date date not null,
  start_time time not null,
  duration_minutes int not null check (duration_minutes between 15 and 240),
  priority text not null check (priority in ('high','medium','low')),
  reason text not null default '' check (char_length(reason) <= 300),
  status text not null default 'planned' check (status in ('planned','completed','skipped')),
  source text not null check (source in ('ai','rules','manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, topic_id, session_date, start_time)
);
create index sessions_user_date_idx on public.study_sessions(user_id, session_date);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  source text not null check (source in ('ai','sample')),
  created_at timestamptz not null default now()
);
create index quizzes_user_idx on public.quizzes(user_id);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position int not null,
  question text not null,
  options jsonb not null,
  correct_index int not null check (correct_index between 0 and 3),
  explanation text not null default ''
);
create index quiz_questions_quiz_idx on public.quiz_questions(quiz_id);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  score int not null check (score >= 0),
  total int not null check (total > 0),
  answers jsonb not null,
  created_at timestamptz not null default now()
);
create index attempts_user_idx on public.quiz_attempts(user_id, created_at);

create table public.tutor_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) <= 8000),
  mode text not null default 'simple',
  created_at timestamptz not null default now()
);
create index tutor_user_idx on public.tutor_messages(user_id, created_at);

-- Keep updated_at fresh
create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
create trigger t_profiles before update on public.profiles for each row execute function public.touch_updated_at();
create trigger t_subjects before update on public.subjects for each row execute function public.touch_updated_at();
create trigger t_topics before update on public.topics for each row execute function public.touch_updated_at();
create trigger t_sessions before update on public.study_sessions for each row execute function public.touch_updated_at();

-- Create a profile whenever a user registers
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'name', ''), 80));
  return new;
end; $$ language plpgsql security definer set search_path = public;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.study_sessions enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.tutor_messages enable row level security;

create policy profiles_select on public.profiles for select using (auth.uid() = id);
create policy profiles_update on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy subjects_all on public.subjects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy sessions_all on public.study_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy tutor_all on public.tutor_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Topics: owner only, and the parent subject must also belong to the owner
create policy topics_all on public.topics for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id and exists (
    select 1 from public.subjects s where s.id = subject_id and s.user_id = auth.uid()));

-- Quiz tables are read-only for end users. Writes happen server-side after ownership checks,
-- so a user cannot forge scores or read answer keys with the public anon key.
create policy quizzes_select on public.quizzes for select using (auth.uid() = user_id);
create policy quiz_questions_select on public.quiz_questions for select using (auth.uid() = user_id);
create policy quiz_attempts_select on public.quiz_attempts for select using (auth.uid() = user_id);

-- Table privileges
revoke all on public.quizzes, public.quiz_questions, public.quiz_attempts from anon, authenticated;
grant select on public.quizzes, public.quiz_attempts to authenticated;
-- Column-level grant: correct_index and explanation are NOT readable by the browser client.
grant select (id, quiz_id, user_id, position, question, options) on public.quiz_questions to authenticated;

revoke all on public.profiles, public.subjects, public.topics, public.study_sessions, public.tutor_messages from anon;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.subjects, public.topics, public.study_sessions, public.tutor_messages to authenticated;
