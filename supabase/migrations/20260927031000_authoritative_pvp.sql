-- Persistent, server-authoritative PVP foundation.
-- Players may create/respond to challenges through narrow RPCs. Only the
-- service role may create a battle or commit a validated state transition.

create table public.pvp_challenges (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  battle_id uuid unique references public.battles(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id),
  check (expires_at > created_at)
);
create unique index one_pending_challenge_per_pair
on public.pvp_challenges (
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
) where status = 'pending';
create index pvp_challenges_requester_idx
on public.pvp_challenges (requester_id, created_at desc);
create index pvp_challenges_addressee_idx
on public.pvp_challenges (addressee_id, created_at desc);
create trigger pvp_challenges_set_updated_at
before update on public.pvp_challenges
for each row execute function public.set_updated_at();
alter table public.pvp_challenges enable row level security;
create policy "challenge participants can read" on public.pvp_challenges
for select to authenticated
using ((select auth.uid()) in (requester_id, addressee_id));
revoke all on public.pvp_challenges from public, anon, authenticated;
grant select on public.pvp_challenges to authenticated;
grant all privileges on public.pvp_challenges to service_role;
create or replace function private.active_team_snapshot(player_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  snapshot jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'slot', members.slot,
    'playerCreatureId', owned.id,
    'catalogId', owned.creature_id
  ) order by members.slot)
  into snapshot
  from public.teams
  join public.team_members members on members.team_id = teams.id
  join public.player_creatures owned on owned.id = members.player_creature_id
  where teams.user_id = player_id
    and teams.is_active
    and owned.user_id = player_id;

  if snapshot is null or jsonb_array_length(snapshot) <> 6 then
    raise exception 'O jogador precisa de uma equipe ativa com exatamente seis criaturas'
      using errcode = '22023';
  end if;

  return snapshot;
end;
$$;
revoke all on function private.active_team_snapshot(uuid) from public, anon, authenticated;
grant execute on function private.active_team_snapshot(uuid) to service_role;
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

  perform private.active_team_snapshot(player_id);
  perform private.active_team_snapshot(target_addressee_id);

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
create or replace function public.create_pvp_challenge(target_addressee_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.create_pvp_challenge(target_addressee_id);
$$;
revoke all on function public.create_pvp_challenge(uuid) from public, anon;
grant execute on function public.create_pvp_challenge(uuid) to authenticated, service_role;
create or replace function private.close_pvp_challenge(
  target_challenge_id uuid,
  target_status text
)
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
  if target_status not in ('declined', 'cancelled') then
    raise exception 'Resposta inválida' using errcode = '22023';
  end if;

  select * into challenge
  from public.pvp_challenges
  where id = target_challenge_id
  for update;

  if challenge.id is null or challenge.status <> 'pending' or challenge.expires_at <= now() then
    raise exception 'Desafio indisponível' using errcode = 'P0002';
  end if;
  if target_status = 'declined' and challenge.addressee_id <> player_id then
    raise exception 'Somente o jogador desafiado pode recusar' using errcode = '42501';
  end if;
  if target_status = 'cancelled' and challenge.requester_id <> player_id then
    raise exception 'Somente quem enviou pode cancelar' using errcode = '42501';
  end if;

  update public.pvp_challenges
  set status = target_status, responded_at = now()
  where id = target_challenge_id;

  return jsonb_build_object('id', target_challenge_id, 'status', target_status);
end;
$$;
revoke all on function private.close_pvp_challenge(uuid, text) from public, anon;
grant execute on function private.close_pvp_challenge(uuid, text) to authenticated, service_role;
create or replace function public.decline_pvp_challenge(target_challenge_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.close_pvp_challenge(target_challenge_id, 'declined');
$$;
create or replace function public.cancel_pvp_challenge(target_challenge_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.close_pvp_challenge(target_challenge_id, 'cancelled');
$$;
revoke all on function public.decline_pvp_challenge(uuid),
  public.cancel_pvp_challenge(uuid) from public, anon;
grant execute on function public.decline_pvp_challenge(uuid),
  public.cancel_pvp_challenge(uuid) to authenticated, service_role;
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
  requester_team jsonb;
  addressee_team jsonb;
  requester_side jsonb;
  addressee_side jsonb;
  submitted_requester_ids jsonb;
  submitted_addressee_ids jsonb;
  stored_requester_ids jsonb;
  stored_addressee_ids jsonb;
  first_turn_user_id uuid;
begin
  select * into challenge
  from public.pvp_challenges
  where id = target_challenge_id
  for update;

  if challenge.id is null or challenge.status <> 'pending' or challenge.expires_at <= now() then
    raise exception 'Desafio indisponível' using errcode = 'P0002';
  end if;
  if challenge.addressee_id <> acting_user_id then
    raise exception 'Somente o jogador desafiado pode aceitar' using errcode = '42501';
  end if;
  if jsonb_typeof(submitted_state) is distinct from 'object'
    or submitted_state ->> 'id' is distinct from target_battle_id::text
    or submitted_state ->> 'mode' is distinct from 'pvp'
    or submitted_state ->> 'status' is distinct from 'active'
    or submitted_state ->> 'version' is distinct from '2'
    or jsonb_typeof(submitted_state -> 'sides') is distinct from 'array'
    or jsonb_array_length(submitted_state -> 'sides') <> 2 then
    raise exception 'Estado inicial de batalha inválido' using errcode = '22023';
  end if;

  select side into requester_side
  from jsonb_array_elements(submitted_state -> 'sides') side
  where side ->> 'id' = challenge.requester_id::text;

  select side into addressee_side
  from jsonb_array_elements(submitted_state -> 'sides') side
  where side ->> 'id' = challenge.addressee_id::text;

  if requester_side is null or addressee_side is null
    or requester_side ->> 'kind' <> 'player'
    or addressee_side ->> 'kind' <> 'player'
    or jsonb_array_length(requester_side -> 'team') <> 6
    or jsonb_array_length(addressee_side -> 'team') <> 6 then
    raise exception 'Participantes ou equipes inválidos' using errcode = '22023';
  end if;

  requester_team := private.active_team_snapshot(challenge.requester_id);
  addressee_team := private.active_team_snapshot(challenge.addressee_id);

  select jsonb_agg(member ->> 'catalogId' order by ordinal)
  into submitted_requester_ids
  from jsonb_array_elements(requester_side -> 'team') with ordinality as entries(member, ordinal);
  select jsonb_agg(member ->> 'catalogId' order by ordinal)
  into submitted_addressee_ids
  from jsonb_array_elements(addressee_side -> 'team') with ordinality as entries(member, ordinal);
  select jsonb_agg(member ->> 'catalogId' order by ordinal)
  into stored_requester_ids
  from jsonb_array_elements(requester_team) with ordinality as entries(member, ordinal);
  select jsonb_agg(member ->> 'catalogId' order by ordinal)
  into stored_addressee_ids
  from jsonb_array_elements(addressee_team) with ordinality as entries(member, ordinal);

  if submitted_requester_ids <> stored_requester_ids
    or submitted_addressee_ids <> stored_addressee_ids then
    raise exception 'A equipe mudou durante a criação do duelo' using errcode = '40001';
  end if;

  first_turn_user_id := (submitted_state #>> '{turn,sideId}')::uuid;
  if first_turn_user_id not in (challenge.requester_id, challenge.addressee_id) then
    raise exception 'Primeiro turno inválido' using errcode = '22023';
  end if;

  insert into public.battles (
    id, created_by, mode, status, turn_user_id, state, version
  ) values (
    target_battle_id, challenge.requester_id, 'pvp', 'active',
    first_turn_user_id, submitted_state, 1
  );

  insert into public.battle_participants (battle_id, user_id, seat, team_snapshot, is_ready)
  values
    (target_battle_id, challenge.requester_id, 1, requester_team, true),
    (target_battle_id, challenge.addressee_id, 2, addressee_team, true);

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
  if battle.turn_user_id <> acting_user_id then
    raise exception 'Aguarde o seu turno' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.battle_participants
    where battle_id = target_battle_id and user_id = acting_user_id
  ) then
    raise exception 'Jogador não participa desta batalha' using errcode = '42501';
  end if;
  if target_action_type is null
    or target_action_type not in ('attach_energy', 'switch', 'attack', 'pass')
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
-- Broadcast is private and contains only rows already protected by participant
-- authorization. Clients never publish authoritative actions over Realtime.
create policy "players receive own pvp broadcasts"
on realtime.messages for select to authenticated
using (
  topic = 'pvp:player:' || (select auth.uid())::text
  or (
    topic like 'pvp:battle:%'
    and private.is_battle_participant(split_part(topic, ':', 3)::uuid)
  )
);
create or replace function private.broadcast_pvp_challenge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'pvp:player:' || new.requester_id::text,
    tg_op, tg_op, tg_table_name, tg_table_schema, new, old
  );
  perform realtime.broadcast_changes(
    'pvp:player:' || new.addressee_id::text,
    tg_op, tg_op, tg_table_name, tg_table_schema, new, old
  );
  return new;
end;
$$;
create or replace function private.broadcast_pvp_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'pvp:battle:' || new.battle_id::text,
    tg_op, tg_op, tg_table_name, tg_table_schema, new, old
  );
  return new;
end;
$$;
revoke all on function private.broadcast_pvp_challenge(),
  private.broadcast_pvp_event() from public, anon, authenticated;
grant execute on function private.broadcast_pvp_challenge(),
  private.broadcast_pvp_event() to service_role;
create trigger broadcast_pvp_challenge_change
after insert or update on public.pvp_challenges
for each row execute function private.broadcast_pvp_challenge();
create trigger broadcast_pvp_battle_event
after insert on public.battle_events
for each row execute function private.broadcast_pvp_event();
