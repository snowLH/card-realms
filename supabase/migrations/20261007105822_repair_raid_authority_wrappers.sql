-- Restore the guards introduced by the secondary-weapon migration after the
-- realtime contribution forward migration. The versioned authority bodies
-- remain in the *_without_secondary_weapon_guard functions.
create or replace function public.start_raid_room(
  target_room_id uuid,
  submitted_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_arpg_raid_secondary_weapon_snapshot(target_room_id, submitted_state);
  return public.start_raid_room_without_secondary_weapon_guard(target_room_id, submitted_state);
end;
$$;
revoke all on function public.start_raid_room(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.start_raid_room(uuid, jsonb) to service_role;

create or replace function public.commit_raid_action_before_revive(
  target_room_id uuid,
  acting_user_id uuid,
  expected_version integer,
  target_client_action_id uuid,
  target_action_type text,
  action_payload jsonb,
  result_state jsonb,
  result_events jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_arpg_raid_secondary_weapon_snapshot(target_room_id, result_state);
  return public.commit_raid_action_without_secondary_weapon_guard(
    target_room_id,
    acting_user_id,
    expected_version,
    target_client_action_id,
    target_action_type,
    action_payload,
    result_state,
    result_events
  );
end;
$$;
revoke all on function public.commit_raid_action_before_revive(
  uuid, uuid, integer, uuid, text, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.commit_raid_action_before_revive(
  uuid, uuid, integer, uuid, text, jsonb, jsonb, jsonb
) to service_role;
