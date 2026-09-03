create table if not exists newsletter_surveys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references newsletter_projects(id) on delete cascade,
  title text not null,
  description text,
  survey_kind text not null default 'survey'
    check (survey_kind in ('survey', 'event')),
  status text not null default 'draft'
    check (status in ('draft', 'open', 'closed')),
  respondent_target text,
  start_at timestamptz,
  end_at timestamptz,
  event_prize text,
  draw_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists newsletter_surveys_project_id_idx
  on newsletter_surveys(project_id);

create table if not exists newsletter_survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references newsletter_surveys(id) on delete cascade,
  project_id uuid not null references newsletter_projects(id) on delete cascade,
  question_order integer not null default 1 check (question_order > 0),
  title text not null,
  question_type text not null default 'single_choice'
    check (question_type in ('single_choice', 'multiple_choice', 'short_text', 'long_text', 'scale')),
  options text[] not null default '{}',
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists newsletter_survey_questions_survey_id_idx
  on newsletter_survey_questions(survey_id);

create index if not exists newsletter_survey_questions_project_id_idx
  on newsletter_survey_questions(project_id);

create table if not exists newsletter_survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references newsletter_surveys(id) on delete cascade,
  project_id uuid not null references newsletter_projects(id) on delete cascade,
  respondent_key text,
  response_payload jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);

create index if not exists newsletter_survey_responses_survey_id_idx
  on newsletter_survey_responses(survey_id);

create index if not exists newsletter_survey_responses_project_id_idx
  on newsletter_survey_responses(project_id);

create index if not exists newsletter_survey_responses_project_submitted_at_idx
  on newsletter_survey_responses(project_id, submitted_at desc);
