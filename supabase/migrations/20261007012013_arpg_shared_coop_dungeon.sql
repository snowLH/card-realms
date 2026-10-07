-- Preserve the expired card raid and publish a separate, currently active
-- ARPG co-op dungeon event with a four-player cap.
insert into public.raid_events (
  slug, title, boss_creature_id, starts_at, ends_at, presentation_timezone,
  min_players, max_players, recommended_level, boss_config, rewards, is_published
) values (
  'arpg-coop-dungeon-2026-10',
  'Expedição cooperativa — O Céu Desaparece',
  'roc',
  now() - interval '1 minute',
  now() + interval '365 days',
  'America/Sao_Paulo',
  2,
  4,
  30,
  '{"gameplayMode":"arpg","regionId":"mata-encantada","maxHp":10000,"speed":92,"maxDurationMs":360000}'::jsonb,
  '{"coins":250,"xp":100}'::jsonb,
  true
)
on conflict (slug) do update
set title = excluded.title,
    boss_creature_id = excluded.boss_creature_id,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    presentation_timezone = excluded.presentation_timezone,
    min_players = excluded.min_players,
    max_players = excluded.max_players,
    recommended_level = excluded.recommended_level,
    boss_config = excluded.boss_config,
    rewards = excluded.rewards,
    is_published = excluded.is_published;

do $$
begin
  if not exists (
    select 1
    from public.raid_events
    where slug = 'arpg-coop-dungeon-2026-10'
      and is_published
      and starts_at <= now()
      and ends_at > now()
      and min_players = 2
      and max_players = 4
      and boss_config ->> 'gameplayMode' = 'arpg'
      and rewards ->> 'coins' = '250'
      and rewards ->> 'xp' = '100'
      and not (rewards ? 'mythicalCreatureId')
  ) then
    raise exception 'ARPG co-op event did not retain its active, four-player, coins/XP contract';
  end if;
end;
$$;

-- Add a dedicated, idempotent revive action while retaining the existing
-- server-side state validation and secondary-weapon snapshot guard.
alter function public.commit_raid_action(uuid, uuid, integer, uuid, text, jsonb, jsonb, jsonb)
  rename to commit_raid_action_before_revive;
revoke all on function public.commit_raid_action_before_revive(
  uuid, uuid, integer, uuid, text, jsonb, jsonb, jsonb
) from public, anon, authenticated, service_role;

create or replace function public.commit_raid_action(
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
declare
  previous_action public.raid_actions;
  normalized_payload jsonb;
  committed_result jsonb;
begin
  if target_action_type is distinct from 'revive' then
    return public.commit_raid_action_before_revive(
      target_room_id, acting_user_id, expected_version, target_client_action_id,
      target_action_type, action_payload, result_state, result_events
    );
  end if;

  -- Serialize retry lookups with all other actions on this room. The wrapped
  -- action handler locks the same room before applying and recording state.
  perform 1 from public.raid_rooms where id = target_room_id for update;
  if not found then
    raise exception 'Sala de Raid não encontrada' using errcode = 'P0002';
  end if;

  if jsonb_typeof(action_payload) is distinct from 'object'
    or action_payload ->> 'action' is distinct from 'revive'
    or nullif(action_payload ->> 'targetPlayerId', '') is null
    or lower(action_payload ->> 'roomId') is distinct from lower(target_room_id::text)
    or lower(action_payload ->> 'actionId') is distinct from lower(target_client_action_id::text)
    or action_payload ->> 'expectedVersion' is distinct from expected_version::text then
    raise exception 'Ação de reanimação inválida' using errcode = '22023';
  end if;

  select * into previous_action
  from public.raid_actions
  where room_id = target_room_id
    and user_id = acting_user_id
    and client_action_id = target_client_action_id;
  if previous_action.id is not null then
    if previous_action.action_type is distinct from 'revive'
      or previous_action.payload is distinct from action_payload
      or previous_action.result is null then
      raise exception 'ID de ação reutilizado com conteúdo diferente' using errcode = '22023';
    end if;
    return previous_action.result;
  end if;

  -- Reuse the established authoritative commit path for version, membership,
  -- loadout, state-shape, persistence, and event-sequence checks.
  normalized_payload := action_payload || jsonb_build_object(
    'action', 'ability',
    'slot', 0,
    'effect', 'revive'
  );
  committed_result := public.commit_raid_action_before_revive(
    target_room_id,
    acting_user_id,
    expected_version,
    target_client_action_id,
    'ability',
    normalized_payload,
    result_state,
    result_events
  );

  update public.raid_actions
  set action_type = 'revive', payload = action_payload
  where room_id = target_room_id
    and user_id = acting_user_id
    and client_action_id = target_client_action_id;

  return committed_result;
end;
$$;
revoke all on function public.commit_raid_action(
  uuid, uuid, integer, uuid, text, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.commit_raid_action(
  uuid, uuid, integer, uuid, text, jsonb, jsonb, jsonb
) to service_role;

