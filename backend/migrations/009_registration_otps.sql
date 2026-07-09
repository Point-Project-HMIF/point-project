create table if not exists registration_otps (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_registration_otps_email_created on registration_otps (lower(email), created_at desc);
create index if not exists idx_registration_otps_expires on registration_otps (expires_at);
