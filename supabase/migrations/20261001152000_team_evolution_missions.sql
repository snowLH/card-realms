-- Complete the remaining player-facing progression systems:
-- editable active team, persistent collection mastery/evolution, and server-driven missions.

alter table public.player_creatures
  add column if not exists evolution_stage smallint not null default 0
    check (evolution_stage between 0 and 2),
  add column if not exists evolved_at timestamptz;
create table if not exists public.mission_event_ledger (
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id text not null,
  event_kind text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
alter table public.mission_event_ledger enable row level security;
revoke all on public.mission_event_ledger from public, anon, authenticated;
grant all privileges on public.mission_event_ledger to service_role;
insert into public.missions (id, title, description, objective, rewards, repeatable, enabled)
values
  (
    'roots-guardian',
    'Vozes da mata',
    'Vença uma batalha de guardião na Floresta das Raízes Antigas.',
    '{"type":"battle_victory","region":"roots","count":1}'::jsonb,
    '{"coins":120,"xp":80}'::jsonb,
    'once',
    true
  ),
  (
    'energy-flow',
    'Fluxo das cinco rotas',
    'Anexe 5 cartas de Energia durante batalhas.',
    '{"type":"energy_attached","count":5}'::jsonb,
    '{"coins":70,"xp":35}'::jsonb,
    'once',
    true
  ),
  (
    'tactical-switch',
    'Passo calculado',
    'Faça 2 trocas voluntárias de criatura em batalha.',
    '{"type":"creature_switched","count":2}'::jsonb,
    '{"coins":80,"xp":40}'::jsonb,
    'once',
    true
  ),
  (
    'steady-hand',
    'Mão firme',
    'Acerte 3 ataques em batalhas.',
    '{"type":"attack_hit","count":3}'::jsonb,
    '{"coins":90,"xp":45}'::jsonb,
    'once',
    true
  )
on conflict (id) do update
set title = excluded.title,
    description = excluded.description,
    objective = excluded.objective,
    rewards = excluded.rewards,
    repeatable = excluded.repeatable,
    enabled = excluded.enabled;
-- The older daily/weekly placeholders did not have reset semantics implemented.
-- Keep them out of the active mission UI until a proper season/reset system exists.
update public.missions
set enabled = false
where id in ('daily-explore', 'weekly-bonds');
insert into public.player_missions (user_id, mission_id)
select profiles.id, missions.id
from public.profiles profiles
cross join public.missions missions
where missions.enabled
on conflict (user_id, mission_id) do nothing;
create or replace function private.seed_player_missions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $mission$
begin
  insert into public.player_missions (user_id, mission_id)
  select new.id, missions.id
  from public.missions missions
  where missions.enabled
  on conflict (user_id, mission_id) do nothing;
  return new;
end;
$mission$;
drop trigger if exists seed_player_missions_after_profile on public.profiles;
create trigger seed_player_missions_after_profile
after insert on public.profiles
for each row execute function private.seed_player_missions();
revoke all on function private.seed_player_missions() from public, anon, authenticated;
grant execute on function private.seed_player_missions() to service_role;
create or replace function public.save_active_team(
  target_member_ids uuid[],
  target_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $team$
declare
  player_id uuid := auth.uid();
  target_team_id uuid;
  member_count integer;
  owned_count integer;
  unique_count integer;
  resolved_name text;
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  member_count := coalesce(cardinality(target_member_ids), 0);
  if member_count < 1 or member_count > 6 then
    raise exception 'A equipe precisa ter entre uma e seis criaturas' using errcode = '22023';
  end if;

  select count(distinct member_id)
  into unique_count
  from unnest(target_member_ids) as member_id;

  if unique_count <> member_count then
    raise exception 'A mesma carta não pode ocupar dois espaços da equipe' using errcode = '22023';
  end if;

  select count(*)
  into owned_count
  from public.player_creatures owned
  where owned.user_id = player_id
    and owned.id = any(target_member_ids);

  if owned_count <> member_count then
    raise exception 'A equipe contém uma carta que não pertence à sua coleção' using errcode = '42501';
  end if;

  select teams.id, teams.name
  into target_team_id, resolved_name
  from public.teams
  where teams.user_id = player_id and teams.is_active
  order by teams.created_at
  limit 1
  for update;

  if target_team_id is null then
    insert into public.teams (user_id, name, is_active)
    values (
      player_id,
      coalesce(nullif(trim(target_name), ''), 'Equipe principal'),
      true
    )
    returning id, name into target_team_id, resolved_name;
  end if;

  update public.teams
  set is_active = (id = target_team_id)
  where user_id = player_id;

  if nullif(trim(target_name), '') is not null then
    resolved_name := left(trim(target_name), 60);
    update public.teams
    set name = resolved_name
    where id = target_team_id;
  end if;

  delete from public.team_members where team_id = target_team_id;

  insert into public.team_members (team_id, slot, player_creature_id)
  select target_team_id, ordinal::smallint, member_id
  from unnest(target_member_ids) with ordinality as chosen(member_id, ordinal)
  order by ordinal;

  return jsonb_build_object(
    'activeTeamId', target_team_id,
    'name', resolved_name,
    'memberCount', member_count
  );
end;
$team$;
revoke all on function public.save_active_team(uuid[], text) from public, anon;
grant execute on function public.save_active_team(uuid[], text) to authenticated, service_role;
create or replace function public.evolve_owned_creature(target_instance_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $evolve$
declare
  player_id uuid := auth.uid();
  owned public.player_creatures;
  current_coins bigint;
  next_stage smallint;
  coin_cost integer;
  duplicates uuid[];
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  select *
  into owned
  from public.player_creatures
  where id = target_instance_id and user_id = player_id
  for update;

  if owned.id is null then
    raise exception 'Carta não encontrada na sua coleção' using errcode = 'P0002';
  end if;

  if owned.evolution_stage >= 2 then
    raise exception 'Esta carta já alcançou o Vínculo máximo' using errcode = '22023';
  end if;

  next_stage := (owned.evolution_stage + 1)::smallint;
  coin_cost := case when next_stage = 1 then 150 else 300 end;

  select coins into current_coins
  from public.profiles
  where id = player_id
  for update;

  if current_coins < coin_cost then
    raise exception 'Moedas insuficientes para evoluir esta carta' using errcode = '22023';
  end if;

  select array_agg(candidate.id order by candidate.acquired_at)
  into duplicates
  from (
    select extra.id, extra.acquired_at
    from public.player_creatures extra
    where extra.user_id = player_id
      and extra.creature_id = owned.creature_id
      and extra.id <> owned.id
      and not exists (
        select 1
        from public.team_members member
        where member.player_creature_id = extra.id
      )
    order by extra.acquired_at
    limit 2
  ) candidate;

  if coalesce(cardinality(duplicates), 0) < 2 then
    raise exception 'São necessárias duas cópias extras livres desta carta para evoluir'
      using errcode = '22023';
  end if;

  delete from public.player_creatures
  where id = any(duplicates);

  update public.profiles
  set coins = coins - coin_cost
  where id = player_id
  returning coins into current_coins;

  update public.player_creatures
  set evolution_stage = next_stage,
      evolved_at = now()
  where id = owned.id;

  return jsonb_build_object(
    'instanceId', owned.id,
    'catalogId', owned.creature_id,
    'evolutionStage', next_stage,
    'copiesConsumed', 2,
    'coinsSpent', coin_cost,
    'coins', current_coins
  );
end;
$evolve$;
revoke all on function public.evolve_owned_creature(uuid) from public, anon;
grant execute on function public.evolve_owned_creature(uuid) to authenticated, service_role;
create or replace function public.record_mission_events(
  target_player_id uuid,
  target_events jsonb,
  target_context jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $missions$
declare
  entry jsonb;
  event_id text;
  event_kind text;
  mission_id text;
  target_count integer;
  inserted_event boolean;
  affected integer := 0;
begin
  if target_player_id is null
    or jsonb_typeof(target_events) is distinct from 'array'
    or jsonb_typeof(target_context) is distinct from 'object' then
    raise exception 'Eventos de missão inválidos' using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles where id = target_player_id) then
    raise exception 'Jogador não encontrado' using errcode = 'P0002';
  end if;

  insert into public.player_missions (user_id, mission_id)
  select target_player_id, missions.id
  from public.missions missions
  where missions.enabled
  on conflict (user_id, mission_id) do nothing;

  for entry in select value from jsonb_array_elements(target_events)
  loop
    event_id := nullif(entry ->> 'id', '');
    event_kind := nullif(entry ->> 'kind', '');
    if event_id is null or event_kind is null then
      continue;
    end if;

    insert into public.mission_event_ledger (user_id, event_id, event_kind)
    values (target_player_id, event_id, event_kind)
    on conflict do nothing;
    get diagnostics affected = row_count;
    inserted_event := affected = 1;
    if not inserted_event then
      continue;
    end if;

    mission_id := case
      when event_kind = 'energy_attached' then 'energy-flow'
      when event_kind = 'creature_switched' then 'tactical-switch'
      when event_kind in ('attack_hit', 'critical') then 'steady-hand'
      when event_kind = 'battle_victory'
        and coalesce(target_context ->> 'regionId', '') = 'roots'
        then 'roots-guardian'
      else null
    end;

    if mission_id is null then
      continue;
    end if;

    select greatest(1, coalesce((missions.objective ->> 'count')::integer, 1))
    into target_count
    from public.missions missions
    where missions.id = mission_id and missions.enabled;

    if target_count is null then
      continue;
    end if;

    update public.player_missions progress
    set progress = least(target_count, progress.progress + 1),
        completed_at = case
          when progress.progress + 1 >= target_count
            then coalesce(progress.completed_at, now())
          else progress.completed_at
        end
    where progress.user_id = target_player_id
      and progress.mission_id = mission_id
      and progress.claimed_at is null;
  end loop;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', missions.id,
      'progress', progress.progress,
      'target', greatest(1, coalesce((missions.objective ->> 'count')::integer, 1)),
      'completed', progress.completed_at is not null,
      'claimed', progress.claimed_at is not null
    ) order by missions.id), '[]'::jsonb)
    from public.player_missions progress
    join public.missions missions on missions.id = progress.mission_id
    where progress.user_id = target_player_id and missions.enabled
  );
end;
$missions$;
revoke all on function public.record_mission_events(uuid, jsonb, jsonb)
from public, anon, authenticated;
grant execute on function public.record_mission_events(uuid, jsonb, jsonb)
to service_role;
create or replace function public.claim_mission_reward(target_mission_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $claim$
declare
  player_id uuid := auth.uid();
  mission public.missions;
  progress public.player_missions;
  reward_coins integer;
  reward_xp integer;
  current_coins bigint;
  current_xp bigint;
  target_count integer;
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  select * into mission
  from public.missions
  where id = target_mission_id and enabled;

  if mission.id is null then
    raise exception 'Missão não encontrada' using errcode = 'P0002';
  end if;

  select * into progress
  from public.player_missions
  where user_id = player_id and mission_id = mission.id
  for update;

  target_count := greatest(1, coalesce((mission.objective ->> 'count')::integer, 1));

  if progress.user_id is null or progress.progress < target_count or progress.completed_at is null then
    raise exception 'A missão ainda não foi concluída' using errcode = '22023';
  end if;

  if progress.claimed_at is not null then
    raise exception 'A recompensa desta missão já foi resgatada' using errcode = '22023';
  end if;

  reward_coins := greatest(0, coalesce((mission.rewards ->> 'coins')::integer, 0));
  reward_xp := greatest(0, coalesce((mission.rewards ->> 'xp')::integer, 0));

  update public.profiles
  set coins = coins + reward_coins,
      xp = xp + reward_xp,
      level = greatest(level, 1 + ((xp + reward_xp) / 600)::integer)
  where id = player_id
  returning coins, xp into current_coins, current_xp;

  update public.player_missions
  set claimed_at = now()
  where user_id = player_id and mission_id = mission.id;

  return jsonb_build_object(
    'missionId', mission.id,
    'coinsAwarded', reward_coins,
    'xpAwarded', reward_xp,
    'coins', current_coins,
    'xp', current_xp
  );
end;
$claim$;
revoke all on function public.claim_mission_reward(text) from public, anon;
grant execute on function public.claim_mission_reward(text) to authenticated, service_role;
create index if not exists player_creatures_user_catalog_idx
  on public.player_creatures (user_id, creature_id, acquired_at);
create index if not exists mission_event_ledger_user_created_idx
  on public.mission_event_ledger (user_id, created_at desc);
