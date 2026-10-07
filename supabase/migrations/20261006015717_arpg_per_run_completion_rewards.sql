-- Every validated extraction grants currency once per run. First-clear equipment
-- and relics keep their own ledgers; historical balances are not recalculated.
-- All reward entrypoints acquire locks in profile -> run order, matching start.

-- Completion retries look up the signed run itself, even if it was finalized
-- or the player has already started another run. This RPC never changes data.
create or replace function private.get_arpg_run_for_completion(
  target_player_id uuid,
  target_run_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'runId', run.run_id,
    'expeditionId', run.expedition_id,
    'dungeonSeed', run.dungeon_seed,
    'checkpoint', run.checkpoint,
    'status', run.status,
    'updatedAt', run.updated_at,
    'expiresAt', run.expires_at
  )
  from private.arpg_runs as run
  where run.user_id = target_player_id
    and run.run_id = target_run_id
    and run.status in ('active', 'extracted', 'defeated');
$$;

create or replace function public.get_arpg_run_for_completion(
  target_player_id uuid,
  target_run_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_arpg_run_for_completion(target_player_id, target_run_id);
$$;

create or replace function private.lock_arpg_completion_run(
  target_player_id uuid,
  target_run_id uuid,
  target_expedition_id text,
  target_victory boolean
)
returns private.arpg_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_run private.arpg_runs%rowtype;
begin
  if target_player_id is null or target_run_id is null
    or target_expedition_id is null or target_victory is null
    or target_expedition_id not in (
      'mata-encantada', 'arquipelago-das-mares', 'montanhas-runicas'
    ) then
    raise exception 'Jogador, run e resultado da expedição são obrigatórios'
      using errcode = '22023';
  end if;

  perform 1 from public.profiles where id = target_player_id for update;
  if not found then
    raise exception 'Perfil do jogador não encontrado' using errcode = 'P0002';
  end if;

  select * into active_run
  from private.arpg_runs
  where run_id = target_run_id and user_id = target_player_id
  for update;
  if not found then
    raise exception 'Run não encontrada' using errcode = 'P0002';
  end if;
  if active_run.expedition_id is distinct from target_expedition_id then
    raise exception 'Expedição diferente dos dados assinados da run'
      using errcode = '22023';
  end if;

  if active_run.status in ('extracted', 'defeated') then
    if active_run.result ->> 'victory' is distinct from target_victory::text then
      raise exception 'A run já foi finalizada com outro resultado'
        using errcode = '23505';
    end if;
    return active_run;
  end if;
  if active_run.status <> 'active' or active_run.expires_at <= now() then
    raise exception 'Run não está mais ativa' using errcode = 'P0002';
  end if;

  if target_victory and (
    active_run.checkpoint ->> 'currentRoomId' is distinct from active_run.boss_room_id
    or jsonb_typeof(active_run.checkpoint -> 'clearedRoomIds') is distinct from 'array'
    or not coalesce((active_run.checkpoint -> 'clearedRoomIds') ? active_run.boss_room_id, false)
    or active_run.checkpoint ->> 'exitPortalAvailable' is distinct from 'true'
    or coalesce((active_run.checkpoint ->> 'playerHp')::integer, 0) <= 0
    or active_run.checkpoint -> 'serverCombatState' ->> 'roomId' is distinct from active_run.boss_room_id
    or active_run.checkpoint -> 'serverCombatState' ->> 'status' is distinct from 'victory'
  ) then
    raise exception 'O checkpoint ainda não comprova a vitória e a extração'
      using errcode = '22023';
  end if;
  if not target_victory and (
    coalesce((active_run.checkpoint ->> 'playerHp')::integer, 1) > 0
    or active_run.checkpoint -> 'serverCombatState' ->> 'status' is distinct from 'defeat'
    or coalesce((active_run.checkpoint -> 'serverCombatState' ->> 'playerHp')::integer, 1) > 0
  ) then
    raise exception 'Derrota só pode ser registrada após a morte validada do jogador'
      using errcode = '22023';
  end if;
  return active_run;
end;
$$;

create or replace function private.claim_arpg_expedition_reward(
  target_player_id uuid,
  target_run_id uuid,
  target_expedition_id text,
  target_victory boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_run private.arpg_runs%rowtype;
  existing_reward jsonb;
  legacy_run_reward jsonb;
  reward jsonb;
  reward_items text[];
  reward_coins integer;
  reward_xp integer;
begin
  active_run := private.lock_arpg_completion_run(
    target_player_id, target_run_id, target_expedition_id, target_victory
  );
  if active_run.status in ('extracted', 'defeated') then
    return active_run.result || jsonb_build_object('replayed', true, 'newItems', '[]'::jsonb);
  end if;
  if not target_victory then
    return jsonb_build_object(
      'coins', 0, 'xp', 0, 'victory', false, 'runId', target_run_id,
      'expeditionId', target_expedition_id, 'items', '[]'::jsonb,
      'newItems', '[]'::jsonb, 'replayed', false
    );
  end if;

  select ledger.reward into existing_reward
  from public.reward_ledger as ledger
  where ledger.user_id = target_player_id
    and ledger.source_type = 'arpg_expedition_completion'
    and ledger.source_id = target_run_id::text;
  if existing_reward is not null then
    return existing_reward || jsonb_build_object('replayed', true, 'newItems', '[]'::jsonb);
  end if;

  -- Both old claim APIs could have credited this run before its final result
  -- was persisted. Match the original run ID, never just the expedition.
  select ledger.reward into legacy_run_reward
  from public.reward_ledger as ledger
  where ledger.user_id = target_player_id
    and ledger.source_type in ('arpg_expedition_first_clear', 'arpg_mvp_first_clear')
    and ledger.source_id = target_expedition_id
    and ledger.reward ->> 'runId' = target_run_id::text
    and (coalesce((ledger.reward ->> 'coins')::integer, 0) > 0
      or coalesce((ledger.reward ->> 'xp')::integer, 0) > 0)
  order by ledger.id
  limit 1;

  -- A pre-migration claim could have paid an active run before finish persisted
  -- its result. Record that payment under the new key without paying it again.
  if legacy_run_reward is not null then
    insert into public.reward_ledger (user_id, source_type, source_id, reward)
    values (target_player_id, 'arpg_expedition_completion', target_run_id::text, legacy_run_reward)
    on conflict (user_id, source_type, source_id) do nothing;
    return legacy_run_reward || jsonb_build_object(
      'expeditionId', target_expedition_id, 'replayed', true, 'newItems', '[]'::jsonb
    );
  end if;

  if target_expedition_id = 'mata-encantada' then
    reward_coins := 60;
    reward_xp := 120;
    reward_items := array['ritual-staff', 'iron-sword']::text[];
  elsif target_expedition_id = 'arquipelago-das-mares' then
    reward_coins := 90;
    reward_xp := 180;
    reward_items := array['tide-blade', 'river-bow']::text[];
  else
    reward_coins := 120;
    reward_xp := 240;
    reward_items := array['runic-sabre', 'raiju-staff']::text[];
  end if;

  insert into public.reward_ledger (user_id, source_type, source_id, reward)
  values (
    target_player_id, 'arpg_expedition_first_clear', target_expedition_id,
    jsonb_build_object(
      'coins', 0, 'xp', 0, 'victory', true, 'runId', target_run_id,
      'expeditionId', target_expedition_id, 'items', to_jsonb(reward_items)
    )
  )
  on conflict (user_id, source_type, source_id) do nothing;
  if found then
    insert into public.inventory_items (user_id, item_key, quantity, metadata)
    select target_player_id, reward_item, 1, jsonb_build_object(
      'source', 'arpg_expedition_first_clear', 'expeditionId', target_expedition_id,
      'runId', target_run_id
    )
    from unnest(reward_items) as reward_item
    on conflict (user_id, item_key) do update
    set quantity = greatest(public.inventory_items.quantity, 1),
        metadata = public.inventory_items.metadata || excluded.metadata,
        updated_at = now();
  else
    reward_items := array[]::text[];
  end if;

  reward := jsonb_build_object(
    'coins', reward_coins, 'xp', reward_xp, 'victory', true,
    'runId', target_run_id, 'expeditionId', target_expedition_id,
    'items', to_jsonb(reward_items), 'newItems', '[]'::jsonb, 'replayed', false
  );
  insert into public.reward_ledger (user_id, source_type, source_id, reward)
  values (target_player_id, 'arpg_expedition_completion', target_run_id::text, reward)
  on conflict (user_id, source_type, source_id) do nothing;
  if not found then
    select ledger.reward into existing_reward
    from public.reward_ledger as ledger
    where ledger.user_id = target_player_id
      and ledger.source_type = 'arpg_expedition_completion'
      and ledger.source_id = target_run_id::text;
    return existing_reward || jsonb_build_object('replayed', true, 'newItems', '[]'::jsonb);
  end if;

  update public.profiles
  set coins = profiles.coins + reward_coins, xp = profiles.xp + reward_xp
  where id = target_player_id;
  return reward;
end;
$$;

-- Keep every public currency claim on the same validated, per-run ledger.
create or replace function public.claim_arpg_expedition_reward(
  target_player_id uuid,
  target_run_id uuid,
  target_expedition_id text,
  target_victory boolean
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.claim_arpg_expedition_reward(
    target_player_id, target_run_id, target_expedition_id, target_victory
  );
$$;

-- The original MVP endpoint remains compatible, but cannot pay through its
-- retired first-clear ledger or mint an armor reward alongside the new API.
create or replace function private.claim_arpg_mvp_run_reward(
  target_player_id uuid,
  target_run_id uuid,
  target_victory boolean
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.claim_arpg_expedition_reward(
    target_player_id, target_run_id, 'mata-encantada', target_victory
  );
$$;

create or replace function public.claim_arpg_mvp_run_reward(
  target_player_id uuid,
  target_run_id uuid,
  target_victory boolean
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.claim_arpg_mvp_run_reward(
    target_player_id, target_run_id, target_victory
  );
$$;

create or replace function private.claim_arpg_expedition_result(
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
  base_reward jsonb;
  existing_run_loot jsonb;
  run_loot_reward jsonb;
  allowed_items text[];
  weapon_items text[];
  active_loot_items text[];
  relic_items jsonb;
  loot_replayed boolean := false;
begin
  active_run := private.lock_arpg_completion_run(
    target_player_id, target_run_id, target_expedition_id, target_victory
  );
  if active_run.loot_item_ids is distinct from target_loot_item_ids then
    raise exception 'Plano de loot diferente dos dados assinados da run'
      using errcode = '22023';
  end if;
  if active_run.status in ('extracted', 'defeated') then
    return active_run.result || jsonb_build_object(
      'replayed', true, 'runLootReplayed', true, 'newItems', '[]'::jsonb
    );
  end if;

  weapon_items := case target_expedition_id
    when 'mata-encantada' then array['ritual-staff', 'iron-sword', 'forest-bow']::text[]
    when 'arquipelago-das-mares' then array['tide-blade', 'river-bow', 'iara-song-staff']::text[]
    when 'montanhas-runicas' then array['runic-sabre', 'alicanto-bow', 'raiju-staff']::text[]
  end;
  -- Retired armor IDs are accepted only to finish existing signed loot plans.
  allowed_items := weapon_items || case target_expedition_id
    when 'mata-encantada' then array['ritual-cloak', 'forest-guardian-armor']::text[]
    when 'arquipelago-das-mares' then array['river-shell-armor', 'kelpie-mist-cloak', 'ahuizotl-guard-armor']::text[]
    when 'montanhas-runicas' then array['highland-coat', 'amarok-hunter-armor', 'carbunclo-mantle']::text[]
  end;
  if coalesce(cardinality(target_loot_item_ids), 0) <> 4
    or exists (
      select 1 from unnest(target_loot_item_ids) as loot(item_id)
      where loot.item_id is null or not (loot.item_id = any(allowed_items))
    ) then
    raise exception 'O plano de loot contém equipamento inválido para esta expedição'
      using errcode = '22023';
  end if;

  base_reward := private.claim_arpg_expedition_reward(
    target_player_id, target_run_id, target_expedition_id, target_victory
  );
  if not target_victory then
    return base_reward || jsonb_build_object('runLootItems', '[]'::jsonb, 'runLootReplayed', false);
  end if;

  select coalesce(array_agg(loot.item_id order by loot.position), array[]::text[])
  into active_loot_items
  from unnest(target_loot_item_ids) with ordinality as loot(item_id, position)
  where loot.item_id = any(weapon_items);
  run_loot_reward := jsonb_build_object(
    'runId', target_run_id, 'expeditionId', target_expedition_id,
    'items', to_jsonb(active_loot_items)
  );
  insert into public.reward_ledger (user_id, source_type, source_id, reward)
  values (target_player_id, 'arpg_run_loot', target_run_id::text, run_loot_reward)
  on conflict (user_id, source_type, source_id) do nothing;
  if found then
    insert into public.inventory_items (user_id, item_key, quantity, metadata)
    select target_player_id, loot.item_id, 1, jsonb_build_object(
      'source', 'arpg_run_loot', 'expeditionId', target_expedition_id, 'runId', target_run_id
    )
    from (select distinct item_id from unnest(active_loot_items) as items(item_id)) as loot
    on conflict (user_id, item_key) do update
    set quantity = greatest(public.inventory_items.quantity, 1),
        metadata = public.inventory_items.metadata || excluded.metadata,
        updated_at = now();
  else
    loot_replayed := true;
    select ledger.reward into existing_run_loot
    from public.reward_ledger as ledger
    where ledger.user_id = target_player_id
      and ledger.source_type = 'arpg_run_loot'
      and ledger.source_id = target_run_id::text;
    select coalesce(array_agg(items.item_id order by items.position), array[]::text[])
    into active_loot_items
    from jsonb_array_elements_text(coalesce(existing_run_loot -> 'items', '[]'::jsonb))
      with ordinality as items(item_id, position)
    where items.item_id = any(weapon_items);
  end if;

  relic_items := private.claim_arpg_relic_unlock(
    target_player_id, target_run_id, target_expedition_id, target_victory
  );
  return base_reward || jsonb_build_object(
    'runLootItems', to_jsonb(active_loot_items), 'runLootReplayed', loot_replayed,
    'newItems', coalesce(base_reward -> 'newItems', '[]'::jsonb) || relic_items
  );
end;
$$;

-- Relic grants are now part of the private claim used by finish as well.
create or replace function public.claim_arpg_expedition_result(
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
  select private.claim_arpg_expedition_result(
    target_player_id, target_run_id, target_expedition_id, target_victory, target_loot_item_ids
  );
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
  active_run := private.lock_arpg_completion_run(
    target_player_id, target_run_id, target_expedition_id, target_victory
  );
  if active_run.loot_item_ids is distinct from target_loot_item_ids then
    raise exception 'Dados de extração diferentes dos dados assinados da run'
      using errcode = '22023';
  end if;
  if active_run.status in ('extracted', 'defeated') then
    return active_run.result || jsonb_build_object(
      'replayed', true, 'runLootReplayed', true, 'newItems', '[]'::jsonb
    );
  end if;

  reward := private.claim_arpg_expedition_result(
    target_player_id, target_run_id, target_expedition_id, target_victory, target_loot_item_ids
  ) || jsonb_build_object('persisted', true);
  -- Preserve the claim's replay marker; a pre-existing payment must not appear
  -- as a new credit simply because the run is being finalized now.
  update private.arpg_runs
  set status = case when target_victory then 'extracted' else 'defeated' end,
      result = reward, updated_at = now(), finished_at = now()
  where run_id = target_run_id;
  return reward;
end;
$$;

revoke all on function private.get_arpg_run_for_completion(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.get_arpg_run_for_completion(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.lock_arpg_completion_run(uuid, uuid, text, boolean)
  from public, anon, authenticated;
revoke all on function private.claim_arpg_expedition_reward(uuid, uuid, text, boolean)
  from public, anon, authenticated;
revoke all on function private.claim_arpg_expedition_result(uuid, uuid, text, boolean, text[])
  from public, anon, authenticated;
revoke all on function private.finish_arpg_run(uuid, uuid, text, boolean, text[])
  from public, anon, authenticated;
revoke all on function public.claim_arpg_expedition_reward(uuid, uuid, text, boolean)
  from public, anon, authenticated;
revoke all on function private.claim_arpg_mvp_run_reward(uuid, uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.claim_arpg_mvp_run_reward(uuid, uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.claim_arpg_expedition_result(uuid, uuid, text, boolean, text[])
  from public, anon, authenticated;
revoke all on function public.finish_arpg_run(uuid, uuid, text, boolean, text[])
  from public, anon, authenticated;

grant execute on function private.get_arpg_run_for_completion(uuid, uuid) to service_role;
grant execute on function public.get_arpg_run_for_completion(uuid, uuid) to service_role;
grant execute on function private.lock_arpg_completion_run(uuid, uuid, text, boolean) to service_role;
grant execute on function private.claim_arpg_expedition_reward(uuid, uuid, text, boolean) to service_role;
grant execute on function private.claim_arpg_expedition_result(uuid, uuid, text, boolean, text[]) to service_role;
grant execute on function private.finish_arpg_run(uuid, uuid, text, boolean, text[]) to service_role;
grant execute on function public.claim_arpg_expedition_reward(uuid, uuid, text, boolean) to service_role;
grant execute on function private.claim_arpg_mvp_run_reward(uuid, uuid, boolean) to service_role;
grant execute on function public.claim_arpg_mvp_run_reward(uuid, uuid, boolean) to service_role;
grant execute on function public.claim_arpg_expedition_result(uuid, uuid, text, boolean, text[]) to service_role;
grant execute on function public.finish_arpg_run(uuid, uuid, text, boolean, text[]) to service_role;
