-- Migration: 20261030000000_harden_app_state.sql
-- Description: Enforce JSONB payload type constraint, 5MB size limit, and automated updated_at trigger.

-- 1. Ensure data is always a JSON object
alter table public.sde_orbit_app_state
  drop constraint if exists sde_orbit_app_state_data_is_object,
  add constraint sde_orbit_app_state_data_is_object
  check (jsonb_typeof(data) = 'object');

-- 2. Prevent accidental multi-megabyte payload denial-of-service / storage exhaustion (5 MB limit)
alter table public.sde_orbit_app_state
  drop constraint if exists sde_orbit_app_state_data_size_limit,
  add constraint sde_orbit_app_state_data_size_limit
  check (octet_length(data::text) <= 5242880);

-- 3. Automatic updated_at trigger
create or replace function public.set_sde_orbit_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sde_orbit_app_state_updated_at on public.sde_orbit_app_state;

create trigger trg_sde_orbit_app_state_updated_at
  before update on public.sde_orbit_app_state
  for each row
  execute function public.set_sde_orbit_updated_at();

