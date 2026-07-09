update faqs
set question = 'Jumlah minimal dan maksimal peserta per tim',
    answer = 'Minimal 2 peserta dan maksimal 3 peserta dalam satu tim. Ketua tim menjadi kontak utama panitia.',
    sort_order = 1,
    updated_at = now()
where lower(question) = lower('Berapa jumlah anggota dalam satu tim?');

insert into faqs (event_id, question, answer, sort_order, is_published)
select id, item.question, item.answer, item.sort_order, true
from events
cross join (
  values
    (
      'Jumlah minimal peserta per tim',
      'Minimal 2 peserta dalam satu tim.',
      2
    ),
    (
      'Jumlah maksimal peserta per tim',
      'Maksimal 3 peserta dalam satu tim.',
      3
    ),
    (
      'Template aturan tambahan',
      'Admin atau panitia dapat menambahkan aturan lain sesuai kebutuhan event aktif.',
      4
    )
) as item(question, answer, sort_order)
where events.status = 'aktif'
  and not exists (
    select 1
    from faqs
    where faqs.event_id = events.id
      and lower(faqs.question) = lower(item.question)
  );
