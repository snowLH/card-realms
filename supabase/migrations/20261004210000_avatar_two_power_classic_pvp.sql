-- New classic PVP battles use the saved avatar and exactly two permanent
-- powers. Existing six-creature snapshots and actions remain archival rows.

alter table public.battle_participants
  drop constraint if exists battle_participants_team_snapshot_check;
alter table public.battle_participants
  alter column team_snapshot drop not null;
alter table public.battle_participants
  add constraint battle_participants_team_snapshot_check
  check (
    team_snapshot is null
    or (
      jsonb_typeof(team_snapshot) = 'array'
      and jsonb_array_length(team_snapshot) = 6
    )
  );
alter table public.battle_participants
  add column if not exists combat_snapshot jsonb;
alter table public.battle_actions
  drop constraint if exists battle_actions_action_type_check;
alter table public.battle_actions
  add constraint battle_actions_action_type_check
  check (action_type in (
    'acquire_energy', 'attach_energy', 'switch', 'attack', 'pass', 'surrender',
    'draw_power', 'equip_power', 'evolve', 'ability', 'concede'
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
  ability_ids text[];
begin
  select coalesce(profiles.avatar_config, jsonb_build_object(
    'skin', 'copper', 'hair', 'braids', 'outfit', 'traveler',
    'armor', 'none', 'accent', 'gold'
  ))
  into avatar
  from public.profiles
  where profiles.id = player_id;

  if avatar is null then
    raise exception 'Perfil do jogador não encontrado' using errcode = 'P0002';
  end if;
  if jsonb_typeof(avatar) is distinct from 'object'
    or (select count(*) from jsonb_object_keys(avatar)) <> 5
    or avatar ->> 'skin' is null or avatar ->> 'skin' not in ('amber', 'copper', 'umber', 'rose')
    or avatar ->> 'hair' is null or avatar ->> 'hair' not in ('braids', 'short', 'waves', 'mohawk')
    or avatar ->> 'outfit' is null or avatar ->> 'outfit' not in ('traveler', 'scholar', 'ranger', 'merchant')
    or avatar ->> 'armor' is null or avatar ->> 'armor' not in ('none', 'leather', 'runic', 'guardian')
    or avatar ->> 'accent' is null or avatar ->> 'accent' not in ('gold', 'emerald', 'azure', 'crimson') then
    raise exception 'A aparência salva do jogador é inválida' using errcode = '22023';
  end if;

  select loadout.ability_ids
  into ability_ids
  from public.player_arpg_loadouts as loadout
  where loadout.user_id = player_id;

  if not found then
    raise exception 'O jogador precisa salvar dois poderes no Arquivo' using errcode = '22023';
  end if;
  if cardinality(ability_ids) is distinct from 2
    or array_position(ability_ids, null) is not null
    or ability_ids[1] = ability_ids[2]
    or not (ability_ids <@ array[
      'ancestral-roots', 'boitata-flame', 'saci-whirlwind', 'iara-song',
      'caipora-arrow', 'kappa-splash', 'kelpie-surge', 'tengu-gust',
      'banshee-wail', 'medusa-gaze', 'kraken-grasp', 'simurgh-renewal',
      'roc-horizon-storm'
    ]::text[]) then
    raise exception 'O loadout precisa ter dois poderes conhecidos e diferentes' using errcode = '22023';
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
    raise exception 'O jogador não possui um dos poderes equipados' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'avatarConfig', avatar,
    'abilityIds', to_jsonb(ability_ids)
  );
end;
$$;
revoke all on function private.active_avatar_power_snapshot(uuid) from public, anon, authenticated;
grant execute on function private.active_avatar_power_snapshot(uuid) to service_role;
create or replace function private.create_pvp_challenge(target_addressee_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  challenge public.pvp_challenges;
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;
  if player_id = target_addressee_id then
    raise exception 'Escolha outro jogador' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.friendships
    where status = 'accepted'
      and (
        (requester_id = player_id and addressee_id = target_addressee_id)
        or (requester_id = target_addressee_id and addressee_id = player_id)
      )
  ) then
    raise exception 'O desafio só pode ser enviado a um amigo aceito' using errcode = '42501';
  end if;

  perform private.active_avatar_power_snapshot(player_id);
  perform private.active_avatar_power_snapshot(target_addressee_id);

  update public.pvp_challenges
  set status = 'expired', responded_at = now()
  where status = 'pending'
    and expires_at <= now()
    and player_id in (requester_id, addressee_id);

  insert into public.pvp_challenges (requester_id, addressee_id)
  values (player_id, target_addressee_id)
  returning * into challenge;

  return jsonb_build_object(
    'id', challenge.id,
    'requesterId', challenge.requester_id,
    'addresseeId', challenge.addressee_id,
    'status', challenge.status,
    'expiresAt', challenge.expires_at
  );
end;
$$;
revoke all on function private.create_pvp_challenge(uuid) from public, anon;
grant execute on function private.create_pvp_challenge(uuid) to authenticated, service_role;
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
  requester_side jsonb;
  addressee_side jsonb;
  first_turn_user_id uuid;
begin
  select * into challenge
  from public.pvp_challenges
  where id = target_challenge_id
  for update;

  if challenge.id is null or challenge.status <> 'pending' or challenge.expires_at <= now() then
    raise exception 'Desafio indisponível' using errcode = 'P0002';
  end if;
  if acting_user_id is null
    or challenge.addressee_id is distinct from acting_user_id then
    raise exception 'Somente o jogador desafiado pode aceitar' using errcode = '42501';
  end if;
  if jsonb_typeof(submitted_state) is distinct from 'object'
    or submitted_state ->> 'id' is distinct from target_battle_id::text
    or submitted_state ->> 'mode' is distinct from 'pvp'
    or submitted_state ->> 'status' is distinct from 'active'
    or submitted_state ->> 'version' is distinct from '3'
    or jsonb_typeof(submitted_state -> 'sides') is distinct from 'array'
    or jsonb_array_length(submitted_state -> 'sides') <> 2 then
    raise exception 'Estado inicial de batalha inválido' using errcode = '22023';
  end if;

  select side into requester_side
  from jsonb_array_elements(submitted_state -> 'sides') as sides(side)
  where side ->> 'id' = challenge.requester_id::text;
  select side into addressee_side
  from jsonb_array_elements(submitted_state -> 'sides') as sides(side)
  where side ->> 'id' = challenge.addressee_id::text;

  if requester_side is null or addressee_side is null
    or requester_side ->> 'kind' <> 'player'
    or addressee_side ->> 'kind' <> 'player'
    or requester_side ? 'team'
    or addressee_side ? 'team'
    or requester_side ? 'creatures'
    or addressee_side ? 'creatures' then
    raise exception 'Participantes inválidos' using errcode = '22023';
  end if;

  requester_snapshot := private.active_avatar_power_snapshot(challenge.requester_id);
  addressee_snapshot := private.active_avatar_power_snapshot(challenge.addressee_id);
  if requester_side -> 'avatarConfig' is distinct from requester_snapshot -> 'avatarConfig'
    or requester_side -> 'abilityIds' is distinct from requester_snapshot -> 'abilityIds'
    or addressee_side -> 'avatarConfig' is distinct from addressee_snapshot -> 'avatarConfig'
    or addressee_side -> 'abilityIds' is distinct from addressee_snapshot -> 'abilityIds' then
    raise exception 'O personagem ou os poderes mudaram durante a criação do duelo' using errcode = '40001';
  end if;

  first_turn_user_id := (submitted_state #>> '{turn,sideId}')::uuid;
  if first_turn_user_id is null
    or first_turn_user_id not in (challenge.requester_id, challenge.addressee_id) then
    raise exception 'Primeiro turno inválido' using errcode = '22023';
  end if;

  insert into public.battles (
    id, created_by, mode, status, turn_user_id, state, version
  ) values (
    target_battle_id, challenge.requester_id, 'pvp', 'active',
    first_turn_user_id, submitted_state, 1
  );

  insert into public.battle_participants (
    battle_id, user_id, seat, team_snapshot, combat_snapshot, is_ready
  ) values
    (target_battle_id, challenge.requester_id, 1, null, requester_snapshot, true),
    (target_battle_id, challenge.addressee_id, 2, null, addressee_snapshot, true);

  insert into public.battle_events (battle_id, event_type, payload, sequence)
  values (target_battle_id, 'battle_start', submitted_state -> 'log' -> 0, 1);

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
  next_side jsonb;
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
    or battle.state ->> 'version' is distinct from '3' then
    raise exception 'A batalha PVP não está ativa no formato atual' using errcode = '22023';
  end if;
  if battle.version <> expected_version then
    raise exception 'Versão de batalha desatualizada' using errcode = '40001';
  end if;
  if target_action_type <> 'concede' and battle.turn_user_id <> acting_user_id then
    raise exception 'Aguarde o seu turno' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.battle_participants
    where battle_id = target_battle_id and user_id = acting_user_id
  ) then
    raise exception 'Jogador não participa desta batalha' using errcode = '42501';
  end if;
  if target_action_type is null
    or target_action_type not in ('attach_energy', 'ability', 'pass', 'concede')
    or jsonb_typeof(action_payload) is distinct from 'object'
    or jsonb_typeof(result_state) is distinct from 'object'
    or jsonb_typeof(result_events) is distinct from 'array'
    or result_state ->> 'id' is distinct from target_battle_id::text
    or result_state ->> 'version' is distinct from '3'
    or result_state ->> 'mode' is distinct from 'pvp'
    or result_state ->> 'status' is null
    or result_state ->> 'status' not in ('active', 'finished')
    or jsonb_typeof(result_state -> 'sides') is distinct from 'array'
    or jsonb_array_length(result_state -> 'sides') <> 2 then
    raise exception 'Transição de batalha inválida' using errcode = '22023';
  end if;

  if action_payload ->> 'battleId' is distinct from target_battle_id::text
    or action_payload ->> 'actionId' is distinct from target_client_action_id::text
    or action_payload ->> 'expectedVersion' is distinct from expected_version::text
    or (target_action_type = 'attach_energy'
        and action_payload ->> 'action' is distinct from 'attach')
    or (target_action_type <> 'attach_energy'
        and action_payload ->> 'action' is distinct from target_action_type)
    or (target_action_type = 'ability'
        and (not (action_payload ? 'slot')
          or action_payload ->> 'slot' not in ('0', '1')))
    or (target_action_type = 'attach_energy'
        and (action_payload ->> 'cardId' is null
          or length(action_payload ->> 'cardId') not between 8 and 120))
    or (target_action_type in ('pass', 'concede')
        and (select count(*) from jsonb_object_keys(action_payload)) <> 4) then
    raise exception 'Comando de batalha inválido' using errcode = '22023';
  end if;

  if (select count(*) from jsonb_array_elements(result_state -> 'sides') as sides(side)
      where side ->> 'kind' is distinct from 'player'
        or side ? 'team'
        or side ? 'creatures') <> 0
    or (select count(distinct side ->> 'id')
        from jsonb_array_elements(result_state -> 'sides') as sides(side)) <> 2
    or (select count(*) from public.battle_participants
        where battle_id = target_battle_id) <> 2 then
    raise exception 'O estado PVP não pode conter equipes de criaturas' using errcode = '22023';
  end if;
  for next_side in
    select side from jsonb_array_elements(result_state -> 'sides') as sides(side)
  loop
    select participant.combat_snapshot
    into expected_snapshot
    from public.battle_participants as participant
    where participant.battle_id = target_battle_id
      and participant.user_id = (next_side ->> 'id')::uuid;

    if expected_snapshot is null
      or next_side -> 'avatarConfig' is distinct from expected_snapshot -> 'avatarConfig'
      or next_side -> 'abilityIds' is distinct from expected_snapshot -> 'abilityIds' then
      raise exception 'Aparência e poderes precisam corresponder ao snapshot da sala'
        using errcode = '22023';
    end if;
  end loop;

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
