-- Durable authenticated ARPG runs. The Data API never receives table access;
-- server routes call the narrowly granted RPC wrappers with the service role.

create table private.arpg_runs (
  run_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expedition_id text not null check (
    expedition_id in ('mata-encantada', 'arquipelago-das-mares', 'montanhas-runicas')
  ),
  dungeon_seed text not null,
  start_room_id text not null,
  boss_room_id text not null,
  loot_item_ids text[] not null check (cardinality(loot_item_ids) = 4),
  signed_token text not null,
  checkpoint jsonb not null check (jsonb_typeof(checkpoint) = 'object'),
  revision integer not null default 0 check (revision >= 0),
  status text not null default 'active' check (
    status in ('active', 'extracted', 'defeated', 'abandoned', 'expired')
  ),
  result jsonb,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  finished_at timestamptz,
  constraint arpg_runs_finished_state check (
    (status = 'active' and finished_at is null)
    or (status <> 'active' and finished_at is not null)
  )
);

create unique index arpg_runs_one_active_per_user
  on private.arpg_runs (user_id)
  where status = 'active';

create index arpg_runs_user_recent
  on private.arpg_runs (user_id, updated_at desc);

alter table private.arpg_runs enable row level security;
revoke all on table private.arpg_runs from public, anon, authenticated;
grant select, insert, update, delete on table private.arpg_runs to service_role;
grant usage on schema private to service_role;

create or replace function private.begin_or_resume_arpg_run(
  target_player_id uuid,
  target_run_id uuid,
  target_expedition_id text,
  target_dungeon_seed text,
  target_start_room_id text,
  target_boss_room_id text,
  target_loot_item_ids text[],
  target_signed_token text,
  target_checkpoint jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_run private.arpg_runs%rowtype;
begin
  if target_player_id is null
    or target_run_id is null
    or target_expedition_id not in ('mata-encantada', 'arquipelago-das-mares', 'montanhas-runicas')
    or target_expedition_id is null
    or target_dungeon_seed is null
    or target_start_room_id is null
    or target_boss_room_id is null
    or coalesce(cardinality(target_loot_item_ids), 0) <> 4
    or target_signed_token is null
    or target_checkpoint is null
    or jsonb_typeof(target_checkpoint) is distinct from 'object' then
    raise exception 'Dados iniciais da run inválidos' using errcode = '22023';
  end if;

  perform 1
  from public.profiles
  where id = target_player_id
  for update;

  if not found then
    raise exception 'Perfil do jogador não encontrado' using errcode = 'P0002';
  end if;

  update private.arpg_runs
  set status = 'expired',
      updated_at = now(),
      finished_at = now()
  where user_id = target_player_id
    and status = 'active'
    and expires_at <= now();

  select * into active_run
  from private.arpg_runs
  where user_id = target_player_id
    and status = 'active'
  order by started_at desc
  limit 1
  for update;

  if found then
    return jsonb_build_object(
      'runId', active_run.run_id,
      'expeditionId', active_run.expedition_id,
      'dungeonSeed', active_run.dungeon_seed,
      'startRoomId', active_run.start_room_id,
      'bossRoomId', active_run.boss_room_id,
      'lootItemIds', to_jsonb(active_run.loot_item_ids),
      'token', active_run.signed_token,
      'checkpoint', active_run.checkpoint,
      'revision', active_run.revision,
      'startedAt', active_run.started_at,
      'updatedAt', active_run.updated_at,
      'expiresAt', active_run.expires_at,
      'resumed', true
    );
  end if;

  insert into private.arpg_runs (
    run_id,
    user_id,
    expedition_id,
    dungeon_seed,
    start_room_id,
    boss_room_id,
    loot_item_ids,
    signed_token,
    checkpoint,
    expires_at
  ) values (
    target_run_id,
    target_player_id,
    target_expedition_id,
    target_dungeon_seed,
    target_start_room_id,
    target_boss_room_id,
    target_loot_item_ids,
    target_signed_token,
    target_checkpoint,
    now() + interval '7 days'
  ) returning * into active_run;

  return jsonb_build_object(
    'runId', active_run.run_id,
    'expeditionId', active_run.expedition_id,
    'dungeonSeed', active_run.dungeon_seed,
    'startRoomId', active_run.start_room_id,
    'bossRoomId', active_run.boss_room_id,
    'lootItemIds', to_jsonb(active_run.loot_item_ids),
    'token', active_run.signed_token,
    'checkpoint', active_run.checkpoint,
    'revision', active_run.revision,
    'startedAt', active_run.started_at,
    'updatedAt', active_run.updated_at,
    'expiresAt', active_run.expires_at,
    'resumed', false
  );
end;
$$;

create or replace function private.get_active_arpg_run(target_player_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'runId', run.run_id,
    'expeditionId', run.expedition_id,
    'dungeonSeed', run.dungeon_seed,
    'checkpoint', run.checkpoint,
    'updatedAt', run.updated_at,
    'expiresAt', run.expires_at
  )
  from private.arpg_runs as run
  where run.user_id = target_player_id
    and run.status = 'active'
    and run.expires_at > now()
  order by run.started_at desc
  limit 1;
$$;

create or replace function private.save_arpg_run_checkpoint(
  target_player_id uuid,
  target_run_id uuid,
  target_expected_revision integer,
  target_checkpoint jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_run private.arpg_runs%rowtype;
begin
  if target_player_id is null
    or target_run_id is null
    or target_expected_revision is null
    or target_expected_revision < 0
    or target_checkpoint is null
    or jsonb_typeof(target_checkpoint) is distinct from 'object'
    or target_checkpoint ->> 'version' is distinct from '1'
    or jsonb_typeof(target_checkpoint -> 'currentRoomId') is distinct from 'string'
    or jsonb_typeof(target_checkpoint -> 'clearedRoomIds') is distinct from 'array'
    or jsonb_typeof(target_checkpoint -> 'playerHp') is distinct from 'number'
    or jsonb_typeof(target_checkpoint -> 'maxHp') is distinct from 'number'
    or jsonb_typeof(target_checkpoint -> 'runLoot') is distinct from 'array' then
    raise exception 'Checkpoint da run inválido' using errcode = '22023';
  end if;

  if jsonb_array_length(target_checkpoint -> 'clearedRoomIds') > 12
    or jsonb_array_length(target_checkpoint -> 'runLoot') > 16 then
    raise exception 'Checkpoint da run excede os limites de salas ou loot' using errcode = '22023';
  end if;

  select * into active_run
  from private.arpg_runs
  where run_id = target_run_id
    and user_id = target_player_id
  for update;

  if not found or active_run.status <> 'active' or active_run.expires_at <= now() then
    raise exception 'Run ativa não encontrada' using errcode = 'P0002';
  end if;

  if active_run.revision <> target_expected_revision then
    return jsonb_build_object(
      'conflict', true,
      'revision', active_run.revision,
      'checkpoint', active_run.checkpoint
    );
  end if;

  update private.arpg_runs
  set checkpoint = target_checkpoint,
      revision = revision + 1,
      updated_at = now()
  where run_id = target_run_id
  returning * into active_run;

  return jsonb_build_object(
    'conflict', false,
    'revision', active_run.revision,
    'checkpoint', active_run.checkpoint,
    'updatedAt', active_run.updated_at
  );
end;
$$;

create or replace function private.finish_arpg_run(
  target_player_id uuid,
  target_run_id uuid,
  target_expedition_id text,
  target_victory boolean,
  target_loot_item_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_run private.arpg_runs%rowtype;
  reward jsonb;
begin
  select * into active_run
  from private.arpg_runs
  where run_id = target_run_id
    and user_id = target_player_id
  for update;

  if not found then
    raise exception 'Run não encontrada' using errcode = 'P0002';
  end if;

  if active_run.status in ('extracted', 'defeated') then
    if active_run.result ->> 'victory' = target_victory::text
      and active_run.expedition_id = target_expedition_id
      and active_run.loot_item_ids = target_loot_item_ids then
      return active_run.result || jsonb_build_object('replayed', true);
    end if;
    raise exception 'A run já foi finalizada com outro resultado' using errcode = '23505';
  end if;

  if active_run.status <> 'active' or active_run.expires_at <= now() then
    raise exception 'Run não está mais ativa' using errcode = 'P0002';
  end if;

  if active_run.expedition_id <> target_expedition_id
    or active_run.loot_item_ids <> target_loot_item_ids then
    raise exception 'Dados de extração diferentes dos dados assinados da run' using errcode = '22023';
  end if;

  if target_victory and (
    active_run.checkpoint ->> 'currentRoomId' <> active_run.boss_room_id
    or not ((active_run.checkpoint -> 'clearedRoomIds') ? active_run.boss_room_id)
    or active_run.checkpoint ->> 'exitPortalAvailable' <> 'true'
    or coalesce((active_run.checkpoint ->> 'playerHp')::integer, 0) <= 0
  ) then
    raise exception 'O checkpoint ainda não valida derrota do boss e portal de extração' using errcode = '22023';
  end if;

  if not target_victory and coalesce((active_run.checkpoint ->> 'playerHp')::integer, 1) > 0 then
    raise exception 'Derrota só pode ser registrada após a morte do jogador' using errcode = '22023';
  end if;

  reward := private.claim_arpg_expedition_result(
    target_player_id,
    target_run_id,
    target_expedition_id,
    target_victory,
    target_loot_item_ids
  ) || jsonb_build_object('persisted', true, 'replayed', false);

  update private.arpg_runs
  set status = case when target_victory then 'extracted' else 'defeated' end,
      result = reward,
      updated_at = now(),
      finished_at = now()
  where run_id = target_run_id
  returning * into active_run;

  return reward;
end;
$$;

revoke all on function private.begin_or_resume_arpg_run(uuid, uuid, text, text, text, text, text[], text, jsonb)
  from public, anon, authenticated;
revoke all on function private.get_active_arpg_run(uuid)
  from public, anon, authenticated;
revoke all on function private.save_arpg_run_checkpoint(uuid, uuid, integer, jsonb)
  from public, anon, authenticated;
revoke all on function private.finish_arpg_run(uuid, uuid, text, boolean, text[])
  from public, anon, authenticated;
grant execute on function private.begin_or_resume_arpg_run(uuid, uuid, text, text, text, text, text[], text, jsonb)
  to service_role;
grant execute on function private.get_active_arpg_run(uuid)
  to service_role;
grant execute on function private.save_arpg_run_checkpoint(uuid, uuid, integer, jsonb)
  to service_role;
grant execute on function private.finish_arpg_run(uuid, uuid, text, boolean, text[])
  to service_role;

create or replace function public.begin_or_resume_arpg_run(
  target_player_id uuid,
  target_run_id uuid,
  target_expedition_id text,
  target_dungeon_seed text,
  target_start_room_id text,
  target_boss_room_id text,
  target_loot_item_ids text[],
  target_signed_token text,
  target_checkpoint jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.begin_or_resume_arpg_run(
    target_player_id, target_run_id, target_expedition_id, target_dungeon_seed,
    target_start_room_id, target_boss_room_id, target_loot_item_ids,
    target_signed_token, target_checkpoint
  );
$$;

create or replace function public.get_active_arpg_run(target_player_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.get_active_arpg_run(target_player_id);
$$;

create or replace function public.save_arpg_run_checkpoint(
  target_player_id uuid,
  target_run_id uuid,
  target_expected_revision integer,
  target_checkpoint jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.save_arpg_run_checkpoint(
    target_player_id, target_run_id, target_expected_revision, target_checkpoint
  );
$$;

create or replace function public.finish_arpg_run(
  target_player_id uuid,
  target_run_id uuid,
  target_expedition_id text,
  target_victory boolean,
  target_loot_item_ids text[]
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.finish_arpg_run(
    target_player_id, target_run_id, target_expedition_id,
    target_victory, target_loot_item_ids
  );
$$;

revoke all on function public.begin_or_resume_arpg_run(uuid, uuid, text, text, text, text, text[], text, jsonb)
  from public, anon, authenticated;
revoke all on function public.get_active_arpg_run(uuid)
  from public, anon, authenticated;
revoke all on function public.save_arpg_run_checkpoint(uuid, uuid, integer, jsonb)
  from public, anon, authenticated;
revoke all on function public.finish_arpg_run(uuid, uuid, text, boolean, text[])
  from public, anon, authenticated;
grant execute on function public.begin_or_resume_arpg_run(uuid, uuid, text, text, text, text, text[], text, jsonb)
  to service_role;
grant execute on function public.get_active_arpg_run(uuid)
  to service_role;
grant execute on function public.save_arpg_run_checkpoint(uuid, uuid, integer, jsonb)
  to service_role;
grant execute on function public.finish_arpg_run(uuid, uuid, text, boolean, text[])
  to service_role;
