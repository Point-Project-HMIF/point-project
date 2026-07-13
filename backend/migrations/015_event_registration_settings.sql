create table if not exists event_registration_settings (
  event_id uuid primary key references events(id) on delete cascade,
  current_batch integer not null default 1 check (current_batch in (1, 2)),
  updated_at timestamptz not null default now()
);

insert into event_registration_settings (event_id, current_batch)
select id, 1
from events
on conflict (event_id) do nothing;
