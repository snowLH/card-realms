-- Freeze the Raid ruleset on each room. New classic Raid rooms use the saved
-- avatar and its two lobby powers; ARPG Raid remains its own mode and also
-- carries only two powers. Existing in-progress rooms remain archival.

alter table public.raid_rooms
  add column if not exists gameplay_mode text,
  add column if not exists gameplay_version smallint;
alter table public.raid_participants
  add column if not exists combat_snapshot jsonb;
alter table public.raid_reward_ledger
  add column if not exists coins_awarded integer not null default 0,
  add column if not exists xp_awarded bigint not null default 0;
update public.raid_rooms as room
set gameplay_mode = case
      when room.status is distinct from 'lobby' then 'legacy'
      when event.boss_config ->> 'gameplayMode' = 'arpg' then 'arpg'
      else 'avatar'
    end,
    gameplay_version = case when room.status is distinct from 'lobby' then 1 else 2 end
from public.raid_events as event
where event.id = room.event_id
  and (room.gameplay_mode is null or room.gameplay_version is null);
update public.raid_rooms
set gameplay_mode = 'legacy', gameplay_version = 1
where gameplay_mode is null or gameplay_version is null;
alter table public.raid_rooms
  alter column gameplay_mode set not null,
  alter column gameplay_version set not null;
alter table public.raid_rooms
  drop constraint if exists raid_rooms_gameplay_mode_check,
  drop constraint if exists raid_rooms_gameplay_version_check;
alter table public.raid_rooms
  add constraint raid_rooms_gameplay_mode_check
    check (gameplay_mode in ('avatar', 'arpg', 'legacy')),
  add constraint raid_rooms_gameplay_version_check
    check (
      (gameplay_mode = 'legacy' and gameplay_version = 1)
      or (gameplay_mode in ('avatar', 'arpg') and gameplay_version = 2)
    );
-- A lobby that cannot be snapshotted under the new contract is archived as a
-- whole. This preserves its old JSON without letting it enter the new engine.
do $$
declare
  room_row record;
  participant_row record;
  snapshot jsonb;
begin
  for room_row in
    select id, gameplay_mode
    from public.raid_rooms
    where status = 'lobby' and gameplay_mode in ('avatar', 'arpg')
  loop
    begin
      for participant_row in
        select user_id
        from public.raid_participants
        where room_id = room_row.id
      loop
        if room_row.gameplay_mode = 'avatar' then
          snapshot := private.active_avatar_power_snapshot(participant_row.user_id);
          update public.raid_participants
          set combat_snapshot = snapshot,
              team_snapshot = 'null'::jsonb
          where room_id = room_row.id and user_id = participant_row.user_id;
        else
          snapshot := private.arpg_raid_loadout_snapshot(participant_row.user_id);
          update public.raid_participants
          set team_snapshot = snapshot,
              combat_snapshot = null
          where room_id = room_row.id and user_id = participant_row.user_id;
        end if;
      end loop;
    exception when others then
      update public.raid_rooms
      set gameplay_mode = 'legacy', gameplay_version = 1
      where id = room_row.id;
    end;
  end loop;
end;
$$;
create or replace function private.freeze_raid_gameplay_contract()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.gameplay_mode is distinct from new.gameplay_mode
    or old.gameplay_version is distinct from new.gameplay_version then
    raise exception 'O modo de jogo da sala não pode ser alterado' using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists raid_rooms_freeze_gameplay_contract on public.raid_rooms;
create trigger raid_rooms_freeze_gameplay_contract
before update of gameplay_mode, gameplay_version on public.raid_rooms
for each row execute function private.freeze_raid_gameplay_contract();
revoke all on function private.freeze_raid_gameplay_contract() from public, anon, authenticated;
grant execute on function private.freeze_raid_gameplay_contract() to service_role;
-- Existing ledger rows stay intact. Only the event's future reward contract
-- changes: Raid currency and XP are event rewards, not combat progression.
update public.raid_events
set rewards = (coalesce(rewards, '{}'::jsonb)
    - 'mythicalCreatureId'
    - 'guaranteedCopies'
    - 'limitPerAccountPerEvent'
    - 'mythicAbilityCardId'
    - 'guaranteedAbilityCopies'
    - 'mythicSupportId')
  || jsonb_build_object(
    'coins', case
      when coalesce(rewards ->> 'coins', '') ~ '^[0-9]+$'
        then least((rewards ->> 'coins')::numeric, 10000::numeric)::integer
      else 250
    end,
    'xp', case
      when coalesce(rewards ->> 'xp', '') ~ '^[0-9]+$'
        then least((rewards ->> 'xp')::numeric, 10000::numeric)::integer
      else 100
    end
  );
create or replace function public.create_raid_room(target_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  event public.raid_events;
  room public.raid_rooms;
  gameplay_mode text;
  team jsonb;
  combat jsonb;
  code text;
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  select * into event
  from public.raid_events
  where id = target_event_id and is_published
  for share;

  if event.id is null or now() < event.starts_at or now() >= event.ends_at then
    raise exception 'A Raid não está ativa' using errcode = '22023';
  end if;

  gameplay_mode := case
    when event.boss_config ->> 'gameplayMode' = 'arpg' then 'arpg'
    else 'avatar'
  end;
  if gameplay_mode = 'arpg' then
    team := private.arpg_raid_loadout_snapshot(player_id);
    combat := null;
  else
    combat := private.active_avatar_power_snapshot(player_id);
    team := 'null'::jsonb;
  end if;

  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.raid_rooms (
    event_id, host_id, invite_code, gameplay_mode, gameplay_version
  ) values (
    event.id, player_id, code, gameplay_mode, 2
  ) returning * into room;

  insert into public.raid_participants (
    room_id, user_id, seat, team_snapshot, combat_snapshot
  ) values (
    room.id, player_id, 1, team, combat
  );

  return jsonb_build_object(
    'roomId', room.id,
    'eventId', room.event_id,
    'inviteCode', room.invite_code,
    'status', room.status,
    'seat', 1,
    'gameplayMode', room.gameplay_mode,
    'gameplayVersion', room.gameplay_version
  );
end;
$$;
revoke all on function public.create_raid_room(uuid) from public, anon;
grant execute on function public.create_raid_room(uuid) to authenticated, service_role;
create or replace function public.join_raid_room(target_invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  room public.raid_rooms;
  event public.raid_events;
  team jsonb;
  combat jsonb;
  next_seat integer;
  participant_count integer;
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  select * into room
  from public.raid_rooms
  where invite_code = upper(trim(target_invite_code))
  for update;

  if room.id is null
    or room.status is distinct from 'lobby'
    or room.gameplay_mode is null
    or room.gameplay_mode not in ('avatar', 'arpg') then
    raise exception 'Sala de Raid indisponível' using errcode = 'P0002';
  end if;

  select * into event from public.raid_events where id = room.event_id;
  if event.id is null or now() < event.starts_at or now() >= event.ends_at then
    raise exception 'O evento não está ativo' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.raid_participants
    where room_id = room.id and user_id = player_id
  ) then
    select seat into next_seat
    from public.raid_participants
    where room_id = room.id and user_id = player_id;
    return jsonb_build_object(
      'roomId', room.id,
      'seat', next_seat,
      'alreadyJoined', true,
      'gameplayMode', room.gameplay_mode,
      'gameplayVersion', room.gameplay_version
    );
  end if;

  select count(*) into participant_count
  from public.raid_participants where room_id = room.id;
  if participant_count >= event.max_players then
    raise exception 'A sala está cheia' using errcode = '22023';
  end if;

  if room.gameplay_mode = 'arpg' then
    team := private.arpg_raid_loadout_snapshot(player_id);
    combat := null;
  else
    combat := private.active_avatar_power_snapshot(player_id);
    team := 'null'::jsonb;
  end if;

  select candidate into next_seat
  from generate_series(1, event.max_players) candidate
  where not exists (
    select 1 from public.raid_participants p
    where p.room_id = room.id and p.seat = candidate
  )
  order by candidate
  limit 1;

  insert into public.raid_participants (
    room_id, user_id, seat, team_snapshot, combat_snapshot
  ) values (
    room.id, player_id, next_seat, team, combat
  );

  return jsonb_build_object(
    'roomId', room.id,
    'seat', next_seat,
    'alreadyJoined', false,
    'gameplayMode', room.gameplay_mode,
    'gameplayVersion', room.gameplay_version
  );
end;
$$;
revoke all on function public.join_raid_room(text) from public, anon;
grant execute on function public.join_raid_room(text) to authenticated, service_role;
create or replace function public.set_raid_ready(target_room_id uuid, ready boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;
  if not private.is_raid_participant(target_room_id) then
    raise exception 'Você não participa desta sala' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.raid_rooms
    where id = target_room_id and status = 'lobby' and gameplay_mode <> 'legacy'
  ) then
    raise exception 'A sala já iniciou ou usa regras arquivadas' using errcode = '22023';
  end if;

  update public.raid_participants
  set is_ready = ready,
      presence_status = case when ready then 'ready' else 'online' end,
      last_seen_at = now()
  where room_id = target_room_id and user_id = player_id;

  return jsonb_build_object('roomId', target_room_id, 'ready', ready);
end;
$$;
revoke all on function public.set_raid_ready(uuid, boolean) from public, anon;
grant execute on function public.set_raid_ready(uuid, boolean) to authenticated, service_role;
create or replace function public.start_raid_room(
  target_room_id uuid,
  submitted_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  room public.raid_rooms;
  event public.raid_events;
  participant_count integer;
  ready_count integer;
  state_player_count integer;
begin
  select * into room from public.raid_rooms where id = target_room_id for update;
  if room.id is null
    or room.status is distinct from 'lobby'
    or room.gameplay_mode is null
    or room.gameplay_mode not in ('avatar', 'arpg') then
    raise exception 'Sala indisponível' using errcode = 'P0002';
  end if;
  if room.gameplay_version is distinct from 2 then
    raise exception 'Versão da Raid indisponível' using errcode = '22023';
  end if;
  select * into event from public.raid_events where id = room.event_id for share;
  if event.id is null or not event.is_published or now() < event.starts_at or now() >= event.ends_at then
    raise exception 'O evento da Raid não está ativo' using errcode = '22023';
  end if;

  select count(*), count(*) filter (where is_ready)
  into participant_count, ready_count
  from public.raid_participants where room_id = room.id;
  if participant_count < event.min_players or participant_count > event.max_players then
    raise exception 'Quantidade de jogadores inválida' using errcode = '22023';
  end if;
  if ready_count <> participant_count then
    raise exception 'Todos os jogadores precisam estar prontos' using errcode = '22023';
  end if;

  if jsonb_typeof(submitted_state) is distinct from 'object'
    or submitted_state ->> 'version' is distinct from '2'
    or lower(submitted_state ->> 'roomId') is distinct from lower(target_room_id::text)
    or lower(submitted_state ->> 'eventId') is distinct from lower(event.id::text)
    or submitted_state ->> 'status' is distinct from 'active'
    or submitted_state ?| array[
      'team', 'teams', 'creatures', 'support', 'supports', 'supporter', 'supporters',
      'supportId', 'supportIds', 'supporterId', 'supporterIds', 'activeSupportIndex',
      'nextSupportAtMs', 'nextSupportSwapAtMs'
    ]
    or jsonb_typeof(submitted_state -> 'log') is distinct from 'array' then
    raise exception 'Estado inicial de Raid inválido' using errcode = '22023';
  end if;
  if jsonb_typeof(submitted_state -> 'players') is distinct from 'array' then
    raise exception 'Participantes do estado inicial inválidos' using errcode = '22023';
  end if;

  select count(*) into state_player_count
  from jsonb_array_elements(submitted_state -> 'players');
  if state_player_count <> participant_count
    or exists (
      select 1
      from public.raid_participants participant
      left join lateral jsonb_array_elements(submitted_state -> 'players') player(value)
        on lower(player.value ->> 'id') = participant.user_id::text
      where participant.room_id = room.id and player.value is null
    )
    or exists (
      select 1 from (
        select lower(player.value ->> 'id') as player_id, count(*) as copies
        from jsonb_array_elements(submitted_state -> 'players') player(value)
        group by lower(player.value ->> 'id')
      ) duplicate_players where copies <> 1
    ) then
    raise exception 'Participantes do estado inicial não correspondem à sala' using errcode = '22023';
  end if;

  if room.gameplay_mode = 'avatar' then
    if submitted_state ->> 'bossCreatureId' is distinct from event.boss_creature_id
      or submitted_state -> 'boss' ->> 'catalogId' is distinct from event.boss_creature_id
      or exists (
        select 1
        from jsonb_array_elements(submitted_state -> 'players') player(value)
        join public.raid_participants participant
          on participant.room_id = room.id
         and participant.user_id::text = lower(player.value ->> 'id')
        where participant.combat_snapshot is null
          or player.value ? 'team'
          or (player.value -> 'side') ? 'team'
          or player.value ?| array[
            'creatures', 'support', 'supports', 'supporter', 'supportId', 'supportIds', 'supporterId',
            'supporterIds', 'supporters', 'activeSupportIndex', 'nextSupportAtMs',
            'nextSupportSwapAtMs'
          ]
          or (player.value -> 'side') ?| array[
            'creatures', 'support', 'supports', 'supporter', 'supportId', 'supportIds', 'supporterId',
            'supporterIds', 'supporters', 'activeSupportIndex', 'nextSupportAtMs',
            'nextSupportSwapAtMs'
          ]
          or player.value -> 'side' ->> 'id' is distinct from player.value ->> 'id'
          or player.value -> 'side' ->> 'kind' is distinct from 'player'
          or case when coalesce(player.value ->> 'seat', '') ~ '^[0-9]+$'
            then (player.value ->> 'seat')::integer else null end is distinct from participant.seat
          or coalesce(jsonb_array_length(case
            when jsonb_typeof(player.value -> 'side' -> 'abilityIds') = 'array'
              then player.value -> 'side' -> 'abilityIds'
            else '[]'::jsonb end), 0) <> 2
          or player.value -> 'side' -> 'abilityIds' -> 0 = player.value -> 'side' -> 'abilityIds' -> 1
          or player.value -> 'side' -> 'avatarConfig' is distinct from participant.combat_snapshot -> 'avatarConfig'
          or player.value -> 'side' -> 'abilityIds' is distinct from participant.combat_snapshot -> 'abilityIds'
      ) then
      raise exception 'Avatar ou poderes da Raid não correspondem ao snapshot salvo' using errcode = '22023';
    end if;
  elsif room.gameplay_mode = 'arpg' then
    if submitted_state -> 'boss' ->> 'catalogId' is distinct from event.boss_creature_id
      or exists (
        select 1
        from jsonb_array_elements(submitted_state -> 'players') player(value)
        join public.raid_participants participant
          on participant.room_id = room.id
         and participant.user_id::text = lower(player.value ->> 'id')
        where jsonb_typeof(participant.team_snapshot) is distinct from 'object'
          or player.value ?| array[
            'team', 'creatures', 'support', 'supports', 'supporter', 'supportId', 'supportIds', 'supporterId',
            'supporterIds', 'supporters', 'activeSupportIndex', 'nextSupportAtMs',
            'nextSupportSwapAtMs'
          ]
          or (player.value -> 'loadout') ?| array[
            'support', 'supports', 'supportId', 'supportIds', 'supporter', 'supporterId',
            'supporterIds', 'supporters', 'activeSupportIndex', 'nextSupportAtMs',
            'nextSupportSwapAtMs'
          ]
          or coalesce(jsonb_array_length(case
            when jsonb_typeof(player.value -> 'loadout' -> 'abilityIds') = 'array'
              then player.value -> 'loadout' -> 'abilityIds'
            else '[]'::jsonb end), 0) <> 2
          or player.value -> 'loadout' -> 'abilityIds' -> 0 = player.value -> 'loadout' -> 'abilityIds' -> 1
          or player.value -> 'loadout' -> 'weaponId' is distinct from participant.team_snapshot -> 'weaponId'
          or player.value -> 'loadout' -> 'armorId' is distinct from participant.team_snapshot -> 'armorId'
          or player.value -> 'loadout' -> 'relicId' is distinct from participant.team_snapshot -> 'relicId'
          or player.value -> 'loadout' -> 'abilityIds' is distinct from participant.team_snapshot -> 'abilityIds'
      ) then
      raise exception 'Loadout ARPG da Raid não corresponde ao snapshot salvo' using errcode = '22023';
    end if;
  else
    raise exception 'Modo de Raid desconhecido' using errcode = '22023';
  end if;

  update public.raid_rooms
  set status = 'active', state = submitted_state, version = 1, started_at = now()
  where id = room.id;

  insert into public.raid_room_events (room_id, sequence, event_type, payload)
  select
    room.id,
    ordinal::integer,
    coalesce(event_payload ->> 'kind', 'raid_event'),
    event_payload
  from jsonb_array_elements(coalesce(submitted_state -> 'log', '[]'::jsonb))
    with ordinality as entries(event_payload, ordinal);

  return jsonb_build_object(
    'roomId', room.id,
    'state', submitted_state,
    'version', 1,
    'gameplayMode', room.gameplay_mode,
    'gameplayVersion', room.gameplay_version
  );
end;
$$;
revoke all on function public.start_raid_room(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.start_raid_room(uuid, jsonb) to service_role;
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
  room public.raid_rooms;
  event public.raid_events;
  previous_action public.raid_actions;
  next_version integer;
  event_sequence integer;
  committed_result jsonb;
  actor_state jsonb;
  expected_action_type text;
begin
  select * into room from public.raid_rooms where id = target_room_id for update;
  if room.id is null then
    raise exception 'Sala de Raid não encontrada' using errcode = 'P0002';
  end if;

  select * into previous_action
  from public.raid_actions
  where room_id = target_room_id
    and user_id = acting_user_id
    and client_action_id = target_client_action_id;
  if previous_action.id is not null then
    if previous_action.action_type is distinct from target_action_type
      or previous_action.payload is distinct from action_payload
      or previous_action.result is null then
      raise exception 'ID de ação reutilizado com conteúdo diferente' using errcode = '22023';
    end if;
    return previous_action.result;
  end if;

  if room.status is distinct from 'active'
    or room.gameplay_mode is null
    or room.gameplay_mode not in ('avatar', 'arpg')
    or room.gameplay_version is distinct from 2 then
    raise exception 'A Raid não está ativa nesta versão' using errcode = '22023';
  end if;
  if room.version <> expected_version then
    raise exception 'Versão de Raid desatualizada' using errcode = '40001';
  end if;
  select * into event from public.raid_events where id = room.event_id;
  if not exists (
    select 1 from public.raid_participants
    where room_id = target_room_id and user_id = acting_user_id
  ) then
    raise exception 'Jogador não participa desta Raid' using errcode = '42501';
  end if;

  expected_action_type := case
    when action_payload ->> 'action' = 'attach' then 'attach_energy'
    else action_payload ->> 'action'
  end;
  if target_room_id is null
    or acting_user_id is null
    or expected_version is null
    or target_client_action_id is null
    or target_action_type is null
    or jsonb_typeof(action_payload) is distinct from 'object'
    or lower(action_payload ->> 'roomId') is distinct from lower(target_room_id::text)
    or action_payload ->> 'expectedVersion' is distinct from expected_version::text
    or lower(action_payload ->> 'actionId') is distinct from lower(target_client_action_id::text)
    or expected_action_type is distinct from target_action_type
    or jsonb_typeof(result_state) is distinct from 'object'
    or jsonb_typeof(result_events) is distinct from 'array'
    or lower(result_state ->> 'roomId') is distinct from lower(target_room_id::text)
    or lower(result_state ->> 'eventId') is distinct from lower(room.event_id::text)
    or result_state ->> 'version' is distinct from '2'
    or result_state ->> 'status' is null
    or result_state ?| array[
      'team', 'teams', 'creatures', 'support', 'supports', 'supporter', 'supporters',
      'supportId', 'supportIds', 'supporterId', 'supporterIds', 'activeSupportIndex',
      'nextSupportAtMs', 'nextSupportSwapAtMs'
    ]
    or result_state ->> 'status' not in ('active', 'victory', 'defeat') then
    raise exception 'Transição de Raid inválida' using errcode = '22023';
  end if;

  if (room.gameplay_mode = 'avatar' and target_action_type not in ('attach_energy', 'ability', 'pass'))
    or (room.gameplay_mode = 'arpg' and target_action_type not in ('input', 'attack', 'dash', 'ability')) then
    raise exception 'Ação incompatível com o modo congelado da Raid' using errcode = '22023';
  end if;
  if target_action_type = 'ability'
    and (action_payload ->> 'slot') not in ('0', '1') then
    raise exception 'Slot de poder inválido' using errcode = '22023';
  end if;
  if room.gameplay_mode = 'avatar' and target_action_type = 'attach_energy'
    and nullif(action_payload ->> 'cardId', '') is null then
    raise exception 'Energia inválida' using errcode = '22023';
  end if;

  if jsonb_typeof(result_state -> 'players') is distinct from 'array' then
    raise exception 'Participantes da transição inválidos' using errcode = '22023';
  end if;
  if jsonb_array_length(result_state -> 'players') <> (
      select count(*) from public.raid_participants where room_id = room.id
    )
    or exists (
      select 1
      from public.raid_participants participant
      left join lateral jsonb_array_elements(result_state -> 'players') player(value)
        on lower(player.value ->> 'id') = participant.user_id::text
      where participant.room_id = room.id and player.value is null
    ) then
    raise exception 'Participantes da transição não correspondem à sala' using errcode = '22023';
  end if;

  if room.gameplay_mode = 'avatar' then
    if result_state ->> 'bossCreatureId' is distinct from event.boss_creature_id
      or result_state -> 'boss' ->> 'catalogId' is distinct from event.boss_creature_id
      or exists (
        select 1
        from jsonb_array_elements(result_state -> 'players') player(value)
        join public.raid_participants participant
          on participant.room_id = room.id
         and participant.user_id::text = lower(player.value ->> 'id')
        where player.value ? 'team'
          or (player.value -> 'side') ? 'team'
          or player.value ?| array[
            'creatures', 'support', 'supports', 'supporter', 'supportId', 'supportIds', 'supporterId',
            'supporterIds', 'supporters', 'activeSupportIndex', 'nextSupportAtMs',
            'nextSupportSwapAtMs'
          ]
          or (player.value -> 'side') ?| array[
            'creatures', 'support', 'supports', 'supporter', 'supportId', 'supportIds', 'supporterId',
            'supporterIds', 'supporters', 'activeSupportIndex', 'nextSupportAtMs',
            'nextSupportSwapAtMs'
          ]
          or player.value -> 'side' ->> 'id' is distinct from player.value ->> 'id'
          or player.value -> 'side' ->> 'kind' is distinct from 'player'
          or case when coalesce(player.value ->> 'seat', '') ~ '^[0-9]+$'
            then (player.value ->> 'seat')::integer else null end is distinct from participant.seat
          or coalesce(jsonb_array_length(case
            when jsonb_typeof(player.value -> 'side' -> 'abilityIds') = 'array'
              then player.value -> 'side' -> 'abilityIds'
            else '[]'::jsonb end), 0) <> 2
          or player.value -> 'side' -> 'abilityIds' -> 0 = player.value -> 'side' -> 'abilityIds' -> 1
          or player.value -> 'side' -> 'avatarConfig' is distinct from participant.combat_snapshot -> 'avatarConfig'
          or player.value -> 'side' -> 'abilityIds' is distinct from participant.combat_snapshot -> 'abilityIds'
      ) then
      raise exception 'O estado do avatar ou dos poderes diverge do snapshot' using errcode = '22023';
    end if;
  else
    if result_state -> 'boss' ->> 'catalogId' is distinct from event.boss_creature_id
      or exists (
        select 1
        from jsonb_array_elements(result_state -> 'players') player(value)
        join public.raid_participants participant
          on participant.room_id = room.id
         and participant.user_id::text = lower(player.value ->> 'id')
        where player.value ?| array[
            'team', 'creatures', 'support', 'supports', 'supporter', 'supportId', 'supportIds', 'supporterId',
            'supporterIds', 'supporters', 'activeSupportIndex', 'nextSupportAtMs',
            'nextSupportSwapAtMs'
          ]
          or (player.value -> 'loadout') ?| array[
            'support', 'supports', 'supportId', 'supportIds', 'supporter', 'supporterId',
            'supporterIds', 'supporters', 'activeSupportIndex', 'nextSupportAtMs',
            'nextSupportSwapAtMs'
          ]
          or coalesce(jsonb_array_length(case
            when jsonb_typeof(player.value -> 'loadout' -> 'abilityIds') = 'array'
              then player.value -> 'loadout' -> 'abilityIds'
            else '[]'::jsonb end), 0) <> 2
          or player.value -> 'loadout' -> 'abilityIds' -> 0 = player.value -> 'loadout' -> 'abilityIds' -> 1
          or player.value -> 'loadout' -> 'weaponId' is distinct from participant.team_snapshot -> 'weaponId'
          or player.value -> 'loadout' -> 'armorId' is distinct from participant.team_snapshot -> 'armorId'
          or player.value -> 'loadout' -> 'relicId' is distinct from participant.team_snapshot -> 'relicId'
          or player.value -> 'loadout' -> 'abilityIds' is distinct from participant.team_snapshot -> 'abilityIds'
      ) then
      raise exception 'O estado do loadout ARPG diverge do snapshot' using errcode = '22023';
    end if;
  end if;

  next_version := room.version + 1;
  committed_result := jsonb_build_object(
    'state', result_state,
    'events', result_events,
    'version', next_version,
    'authority', 'server',
    'gameplayMode', room.gameplay_mode,
    'gameplayVersion', room.gameplay_version
  );

  insert into public.raid_actions (
    room_id, user_id, client_action_id, action_type, payload, result
  ) values (
    target_room_id, acting_user_id, target_client_action_id,
    target_action_type, action_payload, committed_result
  );

  update public.raid_rooms
  set state = result_state,
      version = next_version,
      status = case
        when result_state ->> 'status' = 'victory' then 'victory'
        when result_state ->> 'status' = 'defeat' then 'defeat'
        else 'active'
      end,
      finished_at = case when result_state ->> 'status' in ('victory','defeat') then now() else null end
  where id = target_room_id;

  select player.value into actor_state
  from jsonb_array_elements(result_state -> 'players') player(value)
  where lower(player.value ->> 'id') = acting_user_id::text
  limit 1;
  update public.raid_participants
  set contribution = coalesce(actor_state -> 'contribution', contribution),
      last_seen_at = now()
  where room_id = target_room_id and user_id = acting_user_id;

  select coalesce(max(sequence), 0) into event_sequence
  from public.raid_room_events where room_id = target_room_id;
  insert into public.raid_room_events (room_id, sequence, event_type, payload)
  select target_room_id,
         event_sequence + ordinal::integer,
         coalesce(event_payload ->> 'kind', 'raid_event'),
         event_payload
  from jsonb_array_elements(result_events) with ordinality entries(event_payload, ordinal);

  return committed_result;
end;
$$;
revoke all on function public.commit_raid_action(
  uuid, uuid, integer, uuid, text, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.commit_raid_action(
  uuid, uuid, integer, uuid, text, jsonb, jsonb, jsonb
) to service_role;
create or replace function public.grant_raid_mythic_rewards(target_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  room public.raid_rooms;
  event public.raid_events;
  participant record;
  reward_row_id uuid;
  reward_coins integer;
  reward_xp integer;
  granted_count integer := 0;
  coins_granted bigint := 0;
  xp_granted bigint := 0;
begin
  select * into room from public.raid_rooms where id = target_room_id for update;
  if room.id is null
    or room.status is distinct from 'victory'
    or room.gameplay_mode is null
    or room.gameplay_mode not in ('avatar', 'arpg')
    or room.gameplay_version is distinct from 2 then
    raise exception 'A Raid ainda não foi vencida nesta versão' using errcode = '22023';
  end if;
  select * into event from public.raid_events where id = room.event_id;

  reward_coins := case
    when coalesce(event.rewards ->> 'coins', '') ~ '^[0-9]+$'
      then least((event.rewards ->> 'coins')::numeric, 10000::numeric)::integer
    else 250
  end;
  reward_xp := case
    when coalesce(event.rewards ->> 'xp', '') ~ '^[0-9]+$'
      then least((event.rewards ->> 'xp')::numeric, 10000::numeric)::integer
    else 100
  end;

  for participant in
    select * from public.raid_participants where room_id = room.id
  loop
    if coalesce((participant.contribution ->> 'actions')::integer, 0) > 0 then
      reward_row_id := null;
      insert into public.raid_reward_ledger (
        event_id, room_id, player_id, reward_id, reward_type,
        coins_awarded, xp_awarded
      ) values (
        event.id, room.id, participant.user_id,
        event.slug || ':currency', 'currency_reward', reward_coins, reward_xp
      )
      on conflict (event_id, player_id, reward_type) do nothing
      returning id into reward_row_id;

      if reward_row_id is not null then
        update public.profiles
        set coins = public.profiles.coins + reward_coins,
            xp = public.profiles.xp + reward_xp,
            updated_at = now()
        where id = participant.user_id;
        granted_count := granted_count + 1;
        coins_granted := coins_granted + reward_coins;
        xp_granted := xp_granted + reward_xp;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'grantedCount', granted_count,
    'coinsGranted', coins_granted,
    'xpGranted', xp_granted
  );
end;
$$;
revoke all on function public.grant_raid_mythic_rewards(uuid) from public, anon, authenticated;
grant execute on function public.grant_raid_mythic_rewards(uuid) to service_role;
-- Roc's former weekly-Raid power remains available as a one-time lobby-shop
-- purchase. Existing inventory is untouched and Raid completion never grants it.
create or replace function private.purchase_roc_horizon_storm()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  current_coins bigint;
  current_quantity integer;
  owned_card_ids text[];
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  select profiles.coins into current_coins
  from public.profiles
  where profiles.id = player_id
  for update;
  if current_coins is null then
    raise exception 'Perfil não encontrado' using errcode = 'P0002';
  end if;

  insert into public.inventory_items (user_id, item_key, quantity, metadata)
  values
    (player_id, 'ancestral-roots', 1, jsonb_build_object('source', 'arpg_power_starter')),
    (player_id, 'boitata-flame', 1, jsonb_build_object('source', 'arpg_power_starter'))
  on conflict (user_id, item_key) do update
  set quantity = greatest(public.inventory_items.quantity, excluded.quantity),
      metadata = public.inventory_items.metadata || excluded.metadata,
      updated_at = now();

  select inventory_items.quantity into current_quantity
  from public.inventory_items
  where inventory_items.user_id = player_id
    and inventory_items.item_key = 'roc-horizon-storm'
  for update;
  if coalesce(current_quantity, 0) > 0 then
    raise exception 'Carta já adquirida' using errcode = '23505';
  end if;
  if current_coins < 500 then
    raise exception 'Moedas insuficientes' using errcode = '22023';
  end if;

  update public.profiles
  set coins = profiles.coins - 500
  where profiles.id = player_id
  returning profiles.coins into current_coins;

  insert into public.inventory_items (user_id, item_key, quantity, metadata)
  values (
    player_id,
    'roc-horizon-storm',
    1,
    jsonb_build_object('source', 'arpg_power_shop', 'acquired_at', now())
  );

  select array_agg(owned.card_id order by owned.card_id)
  into owned_card_ids
  from (
    select distinct inventory.item_key as card_id
    from public.inventory_items as inventory
    where inventory.user_id = player_id
      and inventory.quantity > 0
      and inventory.item_key = any(array[
        'ancestral-roots', 'boitata-flame', 'saci-whirlwind', 'iara-song',
        'caipora-arrow', 'kappa-splash', 'kelpie-surge', 'tengu-gust',
        'banshee-wail', 'medusa-gaze', 'kraken-grasp', 'simurgh-renewal',
        'roc-horizon-storm'
      ]::text[])
  ) as owned;

  return jsonb_build_object(
    'coins', current_coins,
    'ownedAbilityIds', to_jsonb(coalesce(owned_card_ids, array[]::text[]))
  );
end;
$$;
revoke all on function private.purchase_roc_horizon_storm() from public, anon;
grant execute on function private.purchase_roc_horizon_storm() to authenticated;
create or replace function public.purchase_arpg_power_card(target_card_id text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if target_card_id = 'roc-horizon-storm' then
    return private.purchase_roc_horizon_storm();
  end if;
  return private.purchase_arpg_power_card(target_card_id);
end;
$$;
revoke all on function public.purchase_arpg_power_card(text) from public, anon;
grant execute on function public.purchase_arpg_power_card(text) to authenticated;
