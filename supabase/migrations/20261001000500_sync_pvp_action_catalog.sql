-- Keep database validation aligned with the authoritative battle engine.
-- Adds power/evolution commands and permits a participant to concede off-turn.

create or replace function public.commit_pvp_action(
  target_battle_id uuid,
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
  battle public.battles;
  previous_result jsonb;
  previous_action_type text;
  previous_payload jsonb;
  committed_result jsonb;
  next_version integer;
  next_turn_user_id uuid;
  result_winner_id uuid;
  event_sequence integer;
begin
  select * into battle
  from public.battles
  where id = target_battle_id
  for update;

  if battle.id is null then
    raise exception 'Batalha não encontrada' using errcode = 'P0002';
  end if;

  select action_type, payload, result
  into previous_action_type, previous_payload, previous_result
  from public.battle_actions
  where battle_id = target_battle_id
    and client_action_id = target_client_action_id
    and user_id = acting_user_id;

  if previous_result is not null then
    if previous_action_type is distinct from target_action_type
      or previous_payload is distinct from action_payload then
      raise exception 'O identificador da ação já foi usado com outro comando'
        using errcode = '23505';
    end if;
    return previous_result;
  end if;

  if battle.mode <> 'pvp' or battle.status <> 'active' then
    raise exception 'A batalha PVP não está ativa' using errcode = '22023';
  end if;
  if battle.version <> expected_version then
    raise exception 'Versão de batalha desatualizada' using errcode = '40001';
  end if;
  if not exists (
    select 1 from public.battle_participants
    where battle_id = target_battle_id and user_id = acting_user_id
  ) then
    raise exception 'Jogador não participa desta batalha' using errcode = '42501';
  end if;
  if target_action_type <> 'concede' and battle.turn_user_id <> acting_user_id then
    raise exception 'Aguarde o seu turno' using errcode = '42501';
  end if;
  if target_action_type is null
    or target_action_type not in (
      'attach_energy',
      'switch',
      'draw_power',
      'equip_power',
      'attack',
      'evolve',
      'pass',
      'concede'
    )
    or jsonb_typeof(action_payload) is distinct from 'object'
    or jsonb_typeof(result_state) is distinct from 'object'
    or jsonb_typeof(result_events) is distinct from 'array'
    or result_state ->> 'id' is distinct from target_battle_id::text
    or result_state ->> 'version' is distinct from '2'
    or result_state ->> 'mode' is distinct from 'pvp'
    or result_state ->> 'status' is null
    or result_state ->> 'status' not in ('active', 'finished')
    or jsonb_typeof(result_state -> 'sides') is distinct from 'array'
    or jsonb_array_length(result_state -> 'sides') <> 2 then
    raise exception 'Transição de batalha inválida' using errcode = '22023';
  end if;

  next_turn_user_id := (result_state #>> '{turn,sideId}')::uuid;
  if not exists (
    select 1 from public.battle_participants
    where battle_id = target_battle_id and user_id = next_turn_user_id
  ) then
    raise exception 'Próximo turno inválido' using errcode = '22023';
  end if;

  if result_state ->> 'status' = 'finished' then
    result_winner_id := nullif(result_state ->> 'winnerId', '')::uuid;
    if result_winner_id is not null and not exists (
      select 1 from public.battle_participants
      where battle_id = target_battle_id and user_id = result_winner_id
    ) then
      raise exception 'Vencedor inválido' using errcode = '22023';
    end if;
  end if;

  next_version := battle.version + 1;
  committed_result := jsonb_build_object(
    'state', result_state,
    'events', result_events,
    'version', next_version,
    'authority', 'server'
  );

  insert into public.battle_actions (
    battle_id, user_id, client_action_id, action_type, payload, result
  ) values (
    target_battle_id, acting_user_id, target_client_action_id,
    target_action_type, action_payload, committed_result
  );

  update public.battles
  set state = result_state,
      version = next_version,
      turn_user_id = case
        when result_state ->> 'status' = 'active' then next_turn_user_id
        else null
      end,
      winner_id = result_winner_id,
      status = case
        when result_state ->> 'status' = 'finished' then 'finished'::public.battle_status
        else 'active'::public.battle_status
      end,
      finished_at = case
        when result_state ->> 'status' = 'finished' then now()
        else null
      end
  where id = target_battle_id;

  select coalesce(max(sequence), 0) into event_sequence
  from public.battle_events
  where battle_id = target_battle_id;

  insert into public.battle_events (battle_id, event_type, payload, sequence)
  select
    target_battle_id,
    coalesce(event ->> 'kind', 'battle_event'),
    event,
    event_sequence + ordinal::integer
  from jsonb_array_elements(result_events) with ordinality as entries(event, ordinal);

  if result_state ->> 'status' = 'finished' then
    insert into public.battle_results (
      battle_id, user_id, opponent_id, mode, outcome, summary, finished_at
    )
    select
      target_battle_id,
      participants.user_id,
      opponents.user_id,
      'pvp',
      case
        when result_winner_id is null then 'draw'
        when participants.user_id = result_winner_id then 'victory'
        else 'defeat'
      end,
      jsonb_build_object('turns', (result_state #>> '{turn,number}')::integer),
      now()
    from public.battle_participants participants
    join public.battle_participants opponents
      on opponents.battle_id = participants.battle_id
      and opponents.user_id <> participants.user_id
    where participants.battle_id = target_battle_id
    on conflict (battle_id, user_id) do nothing;
  end if;

  return committed_result;
end;
$$;
revoke all on function public.commit_pvp_action(
  uuid, uuid, integer, uuid, text, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.commit_pvp_action(
  uuid, uuid, integer, uuid, text, jsonb, jsonb, jsonb
) to service_role;
