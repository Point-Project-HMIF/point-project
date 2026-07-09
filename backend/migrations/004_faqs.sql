create table if not exists faqs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  question text not null,
  answer text not null default '',
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_faqs_event_order on faqs(event_id, sort_order, created_at);
create index if not exists idx_faqs_event_published on faqs(event_id, is_published);

insert into faqs (event_id, question, answer, sort_order, is_published)
select id, item.question, item.answer, item.sort_order, true
from events
cross join (
  values
    (
      'Berapa jumlah anggota dalam satu tim?',
      'Satu tim berisi 2-3 peserta. Data anggota dapat diperbarui saat pendaftaran sebelum dikirim.',
      1
    ),
    (
      'Apa saja berkas yang perlu disiapkan?',
      'Peserta menyiapkan proposal awal dan tautan prototype. Finalis akan mengunggah PPT, laporan akhir, poster, dan prototype final.',
      2
    )
) as item(question, answer, sort_order)
where events.year = 2026
  and not exists (
    select 1
    from faqs
    where faqs.event_id = events.id
      and lower(faqs.question) = lower(item.question)
  );
