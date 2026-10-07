-- Move new friend duels to a server-authoritative real-time avatar contract.
-- Historical rows stay readable, while new starts/actions use the v1 duel JSON.

alter table public.battle_actions
  drop constraint if exists battle_actions_action_type_check;
alter table public.battle_actions
  add constraint battle_actions_action_type_check
  check (action_type in (
    'acquire_energy', 'attach_energy', 'switch', 'attack', 'pass', 'surrender',
    'draw_power', 'equip_power', 'evolve', 'ability', 'concede', 'input', 'dash'
  ));

create or replace function private.active_avatar_power_snapshot(player_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  avatar jsonb;
  active_legend_id text;
  favorite_legend_id text;
  ability_ids text[];
  signature_ability_ids text[];
begin
  select profile.avatar_config
  into avatar
  from public.profiles as profile
  where profile.id = player_id;

  if avatar is null then
    raise exception 'Perfil do jogador não encontrado' using errcode = 'P0002';
  end if;
  if jsonb_typeof(avatar) is distinct from 'object' then
    raise exception 'A aparência salva do jogador é inválida' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_object_keys(avatar)) <> 7
    or not (avatar ?& array[
      'legendId', 'favoriteLegendId', 'skin', 'hair', 'outfit', 'armor', 'accent'
    ]::text[])
    or not coalesce(avatar ->> 'legendId' = any(array[
      'curupira', 'iara', 'boto', 'kappa', 'raiju', 'amarok', 'kelpie',
      'mapinguari', 'ahuizotl', 'ratatoskr', 'carbunclo', 'alicanto', 'yeti'
    ]::text[]), false)
    or not (
      avatar -> 'favoriteLegendId' = 'null'::jsonb
      or coalesce(avatar ->> 'favoriteLegendId' = any(array[
        'curupira', 'iara', 'boto', 'kappa', 'raiju', 'amarok', 'kelpie',
        'mapinguari', 'ahuizotl', 'ratatoskr', 'carbunclo', 'alicanto', 'yeti'
      ]::text[]), false)
    )
    or not coalesce(avatar ->> 'skin' = any(array['amber', 'copper', 'umber', 'rose']::text[]), false)
    or not coalesce(avatar ->> 'hair' = any(array['braids', 'short', 'waves', 'mohawk']::text[]), false)
    or not coalesce(avatar ->> 'outfit' = any(array['traveler', 'scholar', 'ranger', 'merchant']::text[]), false)
    or not coalesce(avatar ->> 'armor' = any(array['none', 'leather', 'runic', 'guardian']::text[]), false)
    or not coalesce(avatar ->> 'accent' = any(array['gold', 'emerald', 'azure', 'crimson']::text[]), false) then
    raise exception 'A aparência salva do jogador é inválida' using errcode = '22023';
  end if;

  active_legend_id := avatar ->> 'legendId';
  favorite_legend_id := avatar ->> 'favoriteLegendId';
  signature_ability_ids := private.legend_signature_ability_ids(active_legend_id);
  if signature_ability_ids is null then
    raise exception 'A Lenda ativa é inválida' using errcode = '22023';
  end if;
  if active_legend_id <> 'curupira' and not exists (
    select 1
    from public.inventory_items as inventory
    where inventory.user_id = player_id
      and inventory.item_key = 'legend-' || active_legend_id
      and inventory.quantity > 0
  ) then
    raise exception 'O jogador não possui a Lenda ativa' using errcode = '42501';
  end if;
  if favorite_legend_id is not null
    and favorite_legend_id <> 'curupira'
    and not exists (
      select 1
      from public.inventory_items as inventory
      where inventory.user_id = player_id
        and inventory.item_key = 'legend-' || favorite_legend_id
        and inventory.quantity > 0
    ) then
    raise exception 'O jogador não possui a Lenda favorita' using errcode = '42501';
  end if;

  select loadout.ability_ids
  into ability_ids
  from public.player_arpg_loadouts as loadout
  where loadout.user_id = player_id;
  if ability_ids is null
    or cardinality(ability_ids) <> 2
    or not (ability_ids <@ signature_ability_ids and signature_ability_ids <@ ability_ids) then
    raise exception 'Os dois poderes equipados não correspondem à Lenda ativa' using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(ability_ids) as selected(card_id)
    where not exists (
      select 1
      from public.inventory_items as inventory
      where inventory.user_id = player_id
        and inventory.item_key = selected.card_id
        and inventory.quantity > 0
    )
  ) then
    raise exception 'O jogador não possui os dois poderes equipados' using errcode = '42501';
  end if;

  return jsonb_build_object('avatarConfig', avatar, 'abilityIds', to_jsonb(ability_ids));
end;
$$;
revoke all on function private.active_avatar_power_snapshot(uuid) from public, anon, authenticated;
grant execute on function private.active_avatar_power_snapshot(uuid) to service_role;

create or replace function public.start_pvp_challenge(
  target_challenge_id uuid,
  acting_user_id uuid,
  target_battle_id uuid,
  submitted_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  challenge public.pvp_challenges;
  requester_snapshot jsonb;
  addressee_snapshot jsonb;
  requester_player jsonb;
  addressee_player jsonb;
begin
  select * into challenge
  from public.pvp_challenges
  where id = target_challenge_id
  for update;

  if challenge.id is null or challenge.status <> 'pending' or challenge.expires_at <= now() then
    raise exception 'Desafio indisponível' using errcode = 'P0002';
  end if;
  if acting_user_id is null or challenge.addressee_id is distinct from acting_user_id then
    raise exception 'Somente o jogador desafiado pode aceitar' using errcode = '42501';
  end if;
  if jsonb_typeof(submitted_state) is distinct from 'object' then
    raise exception 'Estado inicial do duelo inválido' using errcode = '22023';
  end if;
  if submitted_state ->> 'kind' is distinct from 'pvp_realtime'
    or submitted_state ->> 'id' is distinct from target_battle_id::text
    or submitted_state ->> 'version' is distinct from '1'
    or submitted_state ->> 'status' is distinct from 'active'
    or submitted_state -> 'winnerId' is distinct from 'null'::jsonb
    or submitted_state -> 'finishReason' is distinct from 'null'::jsonb then
    raise exception 'Estado inicial do duelo inválido' using errcode = '22023';
  end if;
  if jsonb_typeof(submitted_state -> 'players') is distinct from 'array' then
    raise exception 'Estado inicial do duelo inválido' using errcode = '22023';
  end if;
  if jsonb_array_length(submitted_state -> 'players') <> 2 then
    raise exception 'Estado inicial do duelo inválido' using errcode = '22023';
  end if;

  select player into requester_player
  from jsonb_array_elements(submitted_state -> 'players') as entries(player)
  where player ->> 'id' = challenge.requester_id::text;
  select player into addressee_player
  from jsonb_array_elements(submitted_state -> 'players') as entries(player)
  where player ->> 'id' = challenge.addressee_id::text;

  if requester_player is null or addressee_player is null
    or requester_player ?| array['team', 'creatures', 'energyDeck', 'energyHand', 'energyDiscard']::text[]
    or addressee_player ?| array['team', 'creatures', 'energyDeck', 'energyHand', 'energyDiscard']::text[]
    or (select count(distinct player ->> 'id')
        from jsonb_array_elements(submitted_state -> 'players') as entries(player)) <> 2 then
    raise exception 'Participantes do duelo inválidos' using errcode = '22023';
  end if;

  requester_snapshot := private.active_avatar_power_snapshot(challenge.requester_id);
  addressee_snapshot := private.active_avatar_power_snapshot(challenge.addressee_id);
  if requester_player -> 'avatarConfig' is distinct from requester_snapshot -> 'avatarConfig'
    or requester_player -> 'abilityIds' is distinct from requester_snapshot -> 'abilityIds'
    or addressee_player -> 'avatarConfig' is distinct from addressee_snapshot -> 'avatarConfig'
    or addressee_player -> 'abilityIds' is distinct from addressee_snapshot -> 'abilityIds' then
    raise exception 'A Lenda ou os poderes mudaram durante a criação do duelo' using errcode = '40001';
  end if;

  insert into public.battles (
    id, created_by, mode, status, turn_user_id, state, version
  ) values (
    target_battle_id, challenge.requester_id, 'pvp', 'active',
    null, submitted_state, 1
  );

  insert into public.battle_participants (
    battle_id, user_id, seat, team_snapshot, combat_snapshot, is_ready
  ) values
    (target_battle_id, challenge.requester_id, 1, null, requester_snapshot, true),
    (target_battle_id, challenge.addressee_id, 2, null, addressee_snapshot, true);

  insert into public.battle_events (battle_id, event_type, payload, sequence)
  values (target_battle_id, 'duel_started', submitted_state -> 'log' -> 0, 1);

  update public.pvp_challenges
  set status = 'accepted', battle_id = target_battle_id, responded_at = now()
  where id = target_challenge_id;

  return jsonb_build_object(
    'challengeId', target_challenge_id,
    'battleId', target_battle_id,
    'state', submitted_state,
    'version', 1
  );
end;
$$;
revoke all on function public.start_pvp_challenge(uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.start_pvp_challenge(uuid, uuid, uuid, jsonb)
  to service_role;

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
  previous_user_id uuid;
  committed_result jsonb;
  expected_snapshot jsonb;
  next_player jsonb;
  next_version integer;
  result_winner_id uuid;
  event_sequence integer;
  axis_key text;
  axis_value numeric;
begin
  select * into battle
  from public.battles
  where id = target_battle_id
  for update;
  if battle.id is null then
    raise exception 'Duelo não encontrado' using errcode = 'P0002';
  end if;

  select user_id, action_type, payload, result
  into previous_user_id, previous_action_type, previous_payload, previous_result
  from public.battle_actions
  where battle_id = target_battle_id
    and client_action_id = target_client_action_id;
  if previous_result is not null then
    if previous_user_id is distinct from acting_user_id
      or previous_action_type is distinct from target_action_type
      or previous_payload is distinct from action_payload then
      raise exception 'O identificador da ação já foi usado com outro comando'
        using errcode = '23505';
    end if;
    return previous_result;
  end if;

  if battle.mode <> 'pvp' or battle.status <> 'active'
    or battle.state ->> 'kind' is distinct from 'pvp_realtime'
    or battle.state ->> 'version' is distinct from '1' then
    raise exception 'O duelo não está ativo no formato atual' using errcode = '22023';
  end if;
  if battle.version <> expected_version then
    raise exception 'Versão do duelo desatualizada' using errcode = '40001';
  end if;
  if not exists (
    select 1 from public.battle_participants
    where battle_id = target_battle_id and user_id = acting_user_id
  ) then
    raise exception 'Jogador não participa deste duelo' using errcode = '42501';
  end if;

  if target_action_type is null
    or target_action_type not in ('input', 'attack', 'dash', 'ability', 'concede') then
    raise exception 'Transição do duelo inválida' using errcode = '22023';
  end if;
  if jsonb_typeof(action_payload) is distinct from 'object'
    or jsonb_typeof(result_state) is distinct from 'object'
    or jsonb_typeof(result_events) is distinct from 'array' then
    raise exception 'Transição do duelo inválida' using errcode = '22023';
  end if;
  if result_state ->> 'kind' is distinct from 'pvp_realtime'
    or result_state ->> 'version' is distinct from '1'
    or result_state ->> 'id' is distinct from target_battle_id::text
    or result_state ->> 'status' is null
    or result_state ->> 'status' not in ('active', 'finished') then
    raise exception 'Transição do duelo inválida' using errcode = '22023';
  end if;
  if jsonb_typeof(result_state -> 'players') is distinct from 'array' then
    raise exception 'Transição do duelo inválida' using errcode = '22023';
  end if;
  if jsonb_array_length(result_state -> 'players') <> 2 then
    raise exception 'Transição do duelo inválida' using errcode = '22023';
  end if;

  if action_payload ->> 'battleId' is distinct from target_battle_id::text
    or action_payload ->> 'actionId' is distinct from target_client_action_id::text
    or action_payload ->> 'expectedVersion' is distinct from expected_version::text
    or action_payload ->> 'action' is distinct from target_action_type then
    raise exception 'Comando do duelo inválido' using errcode = '22023';
  end if;
  if target_action_type = 'input' then
    if (select count(*) from jsonb_object_keys(action_payload)) <> 8 then
      raise exception 'Entrada de movimento inválida' using errcode = '22023';
    end if;
    foreach axis_key in array array['moveX', 'moveY', 'aimX', 'aimY']::text[] loop
      if jsonb_typeof(action_payload -> axis_key) is distinct from 'number' then
        raise exception 'Eixo de movimento inválido' using errcode = '22023';
      end if;
      axis_value := (action_payload ->> axis_key)::numeric;
      if axis_value < -1 or axis_value > 1 then
        raise exception 'Eixo de movimento fora do limite' using errcode = '22023';
      end if;
    end loop;
  elsif target_action_type = 'ability' then
    if (select count(*) from jsonb_object_keys(action_payload)) <> 5
      or jsonb_typeof(action_payload -> 'slot') is distinct from 'number'
      or action_payload ->> 'slot' not in ('0', '1') then
      raise exception 'Poder de duelo inválido' using errcode = '22023';
    end if;
  elsif (select count(*) from jsonb_object_keys(action_payload)) <> 4 then
    raise exception 'Comando de duelo inválido' using errcode = '22023';
  end if;

  if (select count(*) from public.battle_participants
      where battle_id = target_battle_id) <> 2
    or (select count(distinct player ->> 'id')
        from jsonb_array_elements(result_state -> 'players') as entries(player)) <> 2
    or exists (
      select 1
      from jsonb_array_elements(result_state -> 'players') as entries(player)
      where player ->> 'id' is null
        or not exists (
          select 1 from public.battle_participants as participant
          where participant.battle_id = target_battle_id
            and participant.user_id = (player ->> 'id')::uuid
        )
        or player ?| array['team', 'creatures', 'energyDeck', 'energyHand', 'energyDiscard']::text[]
    ) then
    raise exception 'O estado deve conter os dois avatares participantes' using errcode = '22023';
  end if;

  for next_player in
    select player from jsonb_array_elements(result_state -> 'players') as entries(player)
  loop
    select participant.combat_snapshot
    into expected_snapshot
    from public.battle_participants as participant
    where participant.battle_id = target_battle_id
      and participant.user_id = (next_player ->> 'id')::uuid;
    if expected_snapshot is null
      or next_player -> 'avatarConfig' is distinct from expected_snapshot -> 'avatarConfig'
      or next_player -> 'abilityIds' is distinct from expected_snapshot -> 'abilityIds' then
      raise exception 'A Lenda e os poderes devem corresponder ao snapshot do duelo'
        using errcode = '22023';
    end if;
  end loop;

  if result_state ->> 'status' = 'active'
    and (result_state -> 'winnerId' is distinct from 'null'::jsonb
      or result_state -> 'finishReason' is distinct from 'null'::jsonb) then
    raise exception 'Duelo ativo contém resultado' using errcode = '22023';
  end if;
  if result_state ->> 'status' = 'finished' then
    if not (result_state ? 'finishReason')
      or jsonb_typeof(result_state -> 'finishReason') is distinct from 'string'
      or result_state ->> 'finishReason' not in ('knockout', 'concede', 'timeout')
      or not (result_state ? 'winnerId')
      or jsonb_typeof(result_state -> 'winnerId') not in ('null', 'string') then
      raise exception 'Motivo de encerramento inválido' using errcode = '22023';
    end if;
    result_winner_id := case
      when jsonb_typeof(result_state -> 'winnerId') = 'null' then null
      else (result_state ->> 'winnerId')::uuid
    end;
    if result_winner_id is not null and not exists (
      select 1 from public.battle_participants
      where battle_id = target_battle_id and user_id = result_winner_id
    ) then
      raise exception 'Vencedor inválido' using errcode = '22023';
    end if;
    if result_state ->> 'finishReason' in ('knockout', 'concede')
      and result_winner_id is null then
      raise exception 'Este encerramento exige um vencedor' using errcode = '22023';
    end if;
    if result_state ->> 'finishReason' = 'concede'
      and (target_action_type <> 'concede' or result_winner_id = acting_user_id) then
      raise exception 'Resultado de desistência inválido' using errcode = '22023';
    end if;
    if result_state ->> 'finishReason' = 'timeout'
      and ((result_state ->> 'serverTimeMs')::numeric - (result_state ->> 'startedAtMs')::numeric) < 180000 then
      raise exception 'O tempo do duelo ainda não terminou' using errcode = '22023';
    end if;
  else
    result_winner_id := null;
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
      turn_user_id = null,
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
    coalesce(event ->> 'kind', 'duel_event'),
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
      jsonb_build_object(
        'durationMs', (result_state ->> 'serverTimeMs')::numeric - (result_state ->> 'startedAtMs')::numeric,
        'finishReason', result_state ->> 'finishReason'
      ),
      now()
    from public.battle_participants as participants
    join public.battle_participants as opponents
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
