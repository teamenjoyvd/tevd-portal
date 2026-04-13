-- SEQ383: Add updated_at to trip_registrations and event_role_requests
-- Both tables expose only created_at; updated_at is required for admin hub UI (gated on separate ticket).

-- Enable moddatetime extension if not already present
create extension if not exists moddatetime schema extensions;

-- trip_registrations
alter table trip_registrations
  add column if not exists updated_at timestamptz not null default now();

create trigger trip_registrations_updated_at
  before update on trip_registrations
  for each row execute function extensions.moddatetime(updated_at);

-- event_role_requests
alter table event_role_requests
  add column if not exists updated_at timestamptz not null default now();

create trigger event_role_requests_updated_at
  before update on event_role_requests
  for each row execute function extensions.moddatetime(updated_at);
