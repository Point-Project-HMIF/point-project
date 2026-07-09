insert into events (name, theme, year, starts_at, ends_at, status)
values (
  'Point Project 4.0',
  'Merancang Ekosistem Masa Depan yang Cerdas, Inklusif, dan Berkelanjutan',
  2026,
  '2026-07-10',
  '2026-10-31',
  'aktif'
)
on conflict (year) do update
set name = excluded.name,
    theme = excluded.theme,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    status = excluded.status;

insert into categories (event_id, name, description, requirements)
select id, 'Siswa SMA/SMK', 'Kategori nasional untuk peserta tingkat SMA/SMK sederajat.',
       '[
         "Tim berisi 2-3 peserta dari institusi yang sama.",
         "Melampirkan proposal awal dan link prototype.",
         "Ketua tim menjadi kontak utama panitia."
       ]'::jsonb
from events
where year = 2026
on conflict (event_id, name) do update
set description = excluded.description,
    requirements = excluded.requirements;

insert into categories (event_id, name, description, requirements)
select id, 'Mahasiswa', 'Kategori nasional untuk mahasiswa aktif D3/D4/S1.',
       '[
         "Tim berisi 2-3 mahasiswa aktif.",
         "Solusi wajib relevan dengan tema smart, inklusif, dan berkelanjutan.",
         "Finalis mengunggah PPT, laporan akhir, poster, dan prototype final."
       ]'::jsonb
from events
where year = 2026
on conflict (event_id, name) do update
set description = excluded.description,
    requirements = excluded.requirements;

insert into timeline_items (event_id, label, starts_at, ends_at, description, sort_order)
select id, item.label, item.starts_at::date, item.ends_at::date, item.description, item.sort_order
from events
cross join (
  values
    ('Registrasi Batch 1', '2026-07-10', '2026-08-10', 'Pendaftaran dan pengumpulan proposal awal.', 1),
    ('Registrasi Batch 2', '2026-08-11', '2026-09-05', 'Pendaftaran lanjutan untuk kategori siswa dan mahasiswa.', 2),
    ('Penilaian Karya', '2026-09-06', '2026-09-25', 'Kurasi proposal dan prototype oleh panitia dan juri.', 3),
    ('Technical Meeting Finalis', '2026-09-28', '2026-09-28', 'Briefing final dan kebutuhan berkas final.', 4),
    ('Final & Awarding', '2026-10-12', '2026-10-12', 'Presentasi finalis dan pengumuman juara.', 5)
) as item(label, starts_at, ends_at, description, sort_order)
where events.year = 2026
on conflict do nothing;

insert into committee_members (event_id, name, identity, position, division)
select id, member.name, 'HMIF ITERA', member.position, member.division
from events
cross join (
  values
    ('Divisi Acara', 'Koordinator Alur Kompetisi', 'Acara'),
    ('Divisi Operator', 'Pengelola Data & Sistem', 'Operator'),
    ('Divisi Publikasi', 'Publikasi & Dokumentasi', 'PDD')
) as member(name, position, division)
where events.year = 2026
on conflict do nothing;

insert into admin_users (name, email, password_hash, role, division)
values (
  'Super Admin Point Project',
  'admin@pointproject.id',
  crypt('admin12345', gen_salt('bf')),
  'super_admin',
  'Operator'
)
on conflict (email) do nothing;

