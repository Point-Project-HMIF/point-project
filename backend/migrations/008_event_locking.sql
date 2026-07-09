alter table events
  add column if not exists locked_at timestamptz;

create index if not exists idx_events_status_year on events(status, year desc);
