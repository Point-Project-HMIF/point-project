create table if not exists registration_payments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  order_id text not null unique,
  leader_email text not null,
  team_name text not null,
  amount integer not null check (amount > 0),
  fee integer not null default 0,
  total_payment integer not null check (total_payment > 0),
  payment_method text not null default 'qris',
  payment_number text not null default '',
  payment_url text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'expired', 'cancelled', 'failed')),
  expired_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_registration_payments_event_email
  on registration_payments (event_id, lower(leader_email), created_at desc);

create index if not exists idx_registration_payments_status
  on registration_payments (status, created_at desc);
