create table if not exists rubric_questions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  question text not null,
  description text not null default '',
  max_score integer not null default 100 check (max_score between 1 and 100),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rubric_questions_event on rubric_questions(event_id, sort_order);

create table if not exists judge_assessments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  judge_id uuid not null references admin_users(id) on delete cascade,
  notes text not null default '',
  total_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(team_id, judge_id)
);

create index if not exists idx_judge_assessments_team on judge_assessments(team_id);
create index if not exists idx_judge_assessments_judge on judge_assessments(judge_id);

create table if not exists judge_assessment_scores (
  assessment_id uuid not null references judge_assessments(id) on delete cascade,
  question_id uuid not null references rubric_questions(id) on delete cascade,
  score integer not null default 0 check (score >= 0 and score <= 100),
  primary key (assessment_id, question_id)
);

insert into rubric_questions (event_id, question, description, max_score, sort_order)
select e.id, seed.question, seed.description, seed.max_score, seed.sort_order
from events e
cross join (
  values
    ('Kesesuaian masalah dan pengguna', 'Apakah solusi menjawab masalah pengguna dengan jelas?', 100, 1),
    ('Alur UX dan kemudahan penggunaan', 'Nilai struktur alur, navigasi, dan kemudahan peserta menjelaskan pengalaman pengguna.', 100, 2),
    ('Kualitas UI dan konsistensi visual', 'Nilai kualitas visual, hirarki, konsistensi komponen, dan kerapian rancangan.', 100, 3),
    ('Prototype dan interaksi', 'Nilai kelengkapan prototype Figma, interaksi, dan kesiapan untuk diuji.', 100, 4),
    ('Presentasi dan argumentasi', 'Nilai kemampuan tim menjelaskan proses, keputusan desain, dan dampak solusi.', 100, 5)
) as seed(question, description, max_score, sort_order)
where e.status = 'aktif'
  and not exists (select 1 from rubric_questions rq where rq.event_id = e.id);
