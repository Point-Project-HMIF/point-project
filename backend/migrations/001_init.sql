create extension if not exists pgcrypto;

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  theme text not null,
  year integer not null unique,
  starts_at date not null,
  ends_at date not null,
  status text not null default 'draft' check (status in ('draft', 'aktif', 'arsip')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  description text not null default '',
  requirements jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (event_id, name)
);

create table if not exists timeline_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  label text not null,
  starts_at date not null,
  ends_at date not null,
  description text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists committee_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  identity text not null default '',
  position text not null,
  division text not null,
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete restrict,
  category_id uuid not null references categories(id) on delete restrict,
  name text not null,
  batch integer not null check (batch in (1, 2)),
  leader_name text not null,
  leader_email text not null,
  leader_phone text not null default '',
  institution text not null,
  members jsonb not null default '[]'::jsonb,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  stage text not null check (stage in ('awal', 'final')),
  proposal_url text,
  prototype_url text,
  ppt_url text,
  report_url text,
  poster_url text,
  status text not null default 'submitted'
    check (status in ('draft', 'submitted', 'reviewed', 'accepted', 'rejected')),
  submitted_at timestamptz not null default now()
);

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  type text not null check (type in ('finalis', 'pemenang', 'info')),
  title text not null,
  body text not null default '',
  results jsonb not null default '[]'::jsonb,
  published_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nim text not null default '',
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('admin', 'super_admin', 'juri')),
  division text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists judge_scores (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  judge_id uuid not null references admin_users(id) on delete restrict,
  score integer not null check (score between 0 and 100),
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (submission_id, judge_id)
);

create index if not exists idx_categories_event on categories(event_id);
create index if not exists idx_timeline_event on timeline_items(event_id, sort_order);
create index if not exists idx_committee_event on committee_members(event_id);
create index if not exists idx_teams_event on teams(event_id);
create index if not exists idx_teams_status on teams(verification_status);
create index if not exists idx_submissions_team on submissions(team_id);
create index if not exists idx_announcements_event_type on announcements(event_id, type);
create index if not exists idx_admin_users_nim on admin_users(nim);
