alter table admin_users
  add column if not exists nim text not null default '';

alter table admin_users
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_admin_users_nim on admin_users(nim);

delete from announcements
where title in ('Finalis Point Project 4.0', 'Pemenang Point Project 4.0')
  and (
    body ilike '%akan diperbarui%'
    or body ilike '%akan dipublikasikan%'
  );

