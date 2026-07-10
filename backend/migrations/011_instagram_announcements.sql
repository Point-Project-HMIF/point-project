alter table announcements
  add column if not exists source text not null default 'manual',
  add column if not exists source_id text not null default '',
  add column if not exists source_url text not null default '',
  add column if not exists image_url text not null default '',
  add column if not exists media_type text not null default '',
  add column if not exists synced_at timestamptz;

create unique index if not exists idx_announcements_source_id
  on announcements (source, source_id)
  where source_id <> '';

create index if not exists idx_announcements_source_event
  on announcements (source, event_id, published_at desc);
