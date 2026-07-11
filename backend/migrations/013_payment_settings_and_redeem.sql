alter table admin_users drop constraint if exists admin_users_role_check;

alter table admin_users
  add constraint admin_users_role_check
  check (role in ('admin', 'super_admin', 'juri', 'panitia'));

create table if not exists event_payment_settings (
  event_id uuid primary key references events(id) on delete cascade,
  amount integer not null default 0 check (amount >= 0),
  is_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into event_payment_settings (event_id, amount, is_enabled)
select id, 0, true
from events
on conflict (event_id) do nothing;

create table if not exists admin_redeem_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_by uuid references admin_users(id) on delete set null,
  role text not null default 'panitia' check (role in ('panitia', 'admin', 'juri')),
  division text not null default '',
  max_claims integer not null default 1 check (max_claims > 0),
  claimed_count integer not null default 0 check (claimed_count >= 0),
  status text not null default 'active' check (status in ('active', 'claimed', 'expired', 'disabled')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_redeem_claims (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references admin_redeem_codes(id) on delete cascade,
  admin_user_id uuid not null references admin_users(id) on delete cascade,
  name text not null,
  email text not null,
  claimed_at timestamptz not null default now(),
  unique (code_id, email)
);

create index if not exists idx_admin_redeem_codes_status on admin_redeem_codes(status, created_at desc);
create index if not exists idx_admin_redeem_claims_email on admin_redeem_claims(lower(email));
