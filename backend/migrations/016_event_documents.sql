create table if not exists event_documents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  label text not null,
  url text not null,
  type text not null default 'link',
  required_for text not null default 'archive',
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_event_documents_event_id on event_documents(event_id);

insert into events (name, theme, year, starts_at, ends_at, status)
values (
  'Point Project 3.0',
  'Arsip kebutuhan dokumen Point Project 3.0',
  2025,
  '2025-01-01',
  '2025-12-31',
  'arsip'
)
on conflict (year) do nothing;

with target_event as (
  select id
  from events
  where year = 2025
  order by created_at asc
  limit 1
),
docs(label, url, required_for, sort_order) as (
  values
    ('Proposal', 'https://docs.google.com/document/d/1dXog_lpjdSnTIlguWBHHuQKLuAbeStQqkRc2VXgZh5k/edit?tab=t.0', 'create', 1),
    ('KAK acara puncak', 'https://docs.google.com/document/d/1dLTc3iA0uvHCR_OXJf-s1sOZ-_9xAnIu/edit?usp=sharing&ouid=114449552050959345878&rtpof=true&sd=true', 'lock', 2),
    ('KAK final-pp', 'https://docs.google.com/document/d/18rP--oRpYxOPHswo14rZCqaTwESKaBuG/edit?usp=sharing&ouid=114449552050959345878&rtpof=true&sd=true', 'lock', 3),
    ('KAK & SU', 'https://docs.google.com/document/d/1d7pvHX-22zMolo4_ntLXOrHSqndRFv7X/edit?usp=sharing&ouid=114449552050959345878&rtpof=true&sd=true', 'lock', 4),
    ('LPJ', 'https://docs.google.com/document/d/17Rc_dqM0-5D-XhwsFO4Vs1rI0I6xTGx9/edit?usp=sharing&ouid=114449552050959345878&rtpof=true&sd=true', 'lock', 5),
    ('BA', 'https://docs.google.com/document/d/1RtJuiM0T0OgwowTt2QEzMhZn5gI47JLF/edit?usp=sharing&ouid=114449552050959345878&rtpof=true&sd=true', 'lock', 6),
    ('Surat Media Partner', 'https://docs.google.com/document/d/19MLkS1NkuWqGF1FtIXx5G7QK9FK7tHj5/edit?usp=sharing&ouid=114449552050959345878&rtpof=true&sd=true', 'lock', 7),
    ('TOR', 'https://docs.google.com/document/d/1TUzyG1xykhI3nq5EWujkbvFXnr-31ML8eHe3eUrNIcI/edit?usp=sharing', 'lock', 8),
    ('Surat Permohonan Juri', 'https://docs.google.com/document/d/1jyTFOd0e_FWtrQj-ZYlUof16gltVtxva/edit?usp=sharing&ouid=114449552050959345878&rtpof=true&sd=true', 'lock', 9)
)
insert into event_documents (event_id, label, url, type, required_for, sort_order)
select target_event.id, docs.label, docs.url, 'link', docs.required_for, docs.sort_order
from target_event, docs
where not exists (
  select 1
  from event_documents existing
  where existing.event_id = target_event.id
    and lower(existing.label) = lower(docs.label)
);
