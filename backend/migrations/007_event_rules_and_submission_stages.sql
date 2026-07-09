create table if not exists event_rules (
  event_id uuid primary key references events(id) on delete cascade,
  min_team_members integer not null default 2 check (min_team_members >= 1),
  max_team_members integer not null default 3 check (max_team_members >= min_team_members),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into event_rules (event_id, min_team_members, max_team_members)
select id, 2, 3
from events
on conflict (event_id) do nothing;

alter table submissions
  drop constraint if exists submissions_stage_check;

create table if not exists submission_stages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  key text not null,
  label text not null,
  sort_order integer not null default 0,
  is_open boolean not null default true,
  requires_approval boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, key)
);

create table if not exists team_stage_access (
  team_id uuid not null references teams(id) on delete cascade,
  stage_id uuid not null references submission_stages(id) on delete cascade,
  is_allowed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (team_id, stage_id)
);

create index if not exists idx_submission_stages_event_order on submission_stages(event_id, sort_order);
create index if not exists idx_team_stage_access_team on team_stage_access(team_id);

insert into submission_stages (event_id, key, label, sort_order, is_open, requires_approval)
select id, item.key, item.label, item.sort_order, item.is_open, item.requires_approval
from events
cross join (
  values
    ('awal', 'Upload Karya Awal', 1, true, false),
    ('final', 'Upload Karya Final', 2, true, true)
) as item(key, label, sort_order, is_open, requires_approval)
on conflict (event_id, key) do nothing;
