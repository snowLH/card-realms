-- Independent account preferences. No economy/entitlement mutation or backfill.
create table if not exists public.player_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  sound_enabled boolean not null default true,
  revision bigint not null default 0 check (revision between 0 and 9007199254740991),
  updated_at timestamptz not null default now()
);
alter table public.player_preferences enable row level security;
revoke all on public.player_preferences from public, anon, authenticated;
grant select on public.player_preferences to authenticated;
grant select, insert, update, delete on public.player_preferences to service_role;
drop policy if exists player_preferences_owner_read on public.player_preferences;
create policy player_preferences_owner_read on public.player_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists player_preferences_authority on public.player_preferences;
create policy player_preferences_authority on public.player_preferences for all to service_role
  using (true) with check (true);

-- Service-only, invoker rights: the HTTP boundary verifies claims and supplies the owner.
-- SELECT FOR UPDATE serializes concurrent devices. Repeated identical requests do
-- not increment revision, while a stale conflicting request receives the cloud state.
create or replace function public.update_player_preferences(
  target_user_id uuid, expected_revision bigint, target_sound_enabled boolean
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  current_preferences public.player_preferences%rowtype;
  confirmed boolean;
begin
  if target_user_id is null or expected_revision is null or expected_revision < 0
    or expected_revision > 9007199254740991 or target_sound_enabled is null then
    raise exception 'Invalid preference request' using errcode = '22023';
  end if;
  insert into public.player_preferences(user_id) values (target_user_id) on conflict (user_id) do nothing;
  select * into strict current_preferences from public.player_preferences
    where user_id = target_user_id for update;
  confirmed := current_preferences.sound_enabled = target_sound_enabled
    or current_preferences.revision = expected_revision;
  if confirmed and current_preferences.sound_enabled <> target_sound_enabled then
    update public.player_preferences set sound_enabled = target_sound_enabled,
      revision = revision + 1, updated_at = now() where user_id = target_user_id
      returning * into current_preferences;
  end if;
  return jsonb_build_object('confirmed', confirmed, 'snapshot', jsonb_build_object(
    'soundEnabled', current_preferences.sound_enabled, 'revision', current_preferences.revision,
    'updatedAt', current_preferences.updated_at
  ));
end;
$$;
revoke all on function public.update_player_preferences(uuid,bigint,boolean) from public, anon, authenticated;
grant execute on function public.update_player_preferences(uuid,bigint,boolean) to service_role;
