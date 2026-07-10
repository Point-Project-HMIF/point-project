alter table registration_otps
  add column if not exists request_ip text not null default '',
  add column if not exists user_agent text not null default '';

create index if not exists idx_registration_otps_ip_created
  on registration_otps (request_ip, created_at desc)
  where request_ip <> '';

create index if not exists idx_teams_event_leader_email
  on teams (event_id, lower(leader_email));
