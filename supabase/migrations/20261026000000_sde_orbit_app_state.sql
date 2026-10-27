-- SDE Orbit private user state. Apply only to a dedicated SDE Orbit Supabase project.
-- Do not run this against an unrelated production project without reviewing first.
create table if not exists public.sde_orbit_app_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.sde_orbit_app_state enable row level security;

revoke all on table public.sde_orbit_app_state from anon, public;
grant select, insert, update, delete on table public.sde_orbit_app_state to authenticated;

drop policy if exists "Users can read own SDE Orbit state" on public.sde_orbit_app_state;
create policy "Users can read own SDE Orbit state"
  on public.sde_orbit_app_state for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own SDE Orbit state" on public.sde_orbit_app_state;
create policy "Users can insert own SDE Orbit state"
  on public.sde_orbit_app_state for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own SDE Orbit state" on public.sde_orbit_app_state;
create policy "Users can update own SDE Orbit state"
  on public.sde_orbit_app_state for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own SDE Orbit state" on public.sde_orbit_app_state;
create policy "Users can delete own SDE Orbit state"
  on public.sde_orbit_app_state for delete to authenticated
  using ((select auth.uid()) = user_id);
