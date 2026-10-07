-- Collectible ARPG supports with exactly two equipped slots.
-- Unlocks reuse inventory_items and a separate idempotent reward ledger.

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
  existing_reward jsonb;
  reward jsonb;
  reward_items text[];
  new_items text[] := array[]::text[];
  target_support_id text;
  reward_coins integer;
  reward_xp integer;
begin
  if target_player_id is null or target_run_id is null then
    raise exception 'Jogador e run são obrigatórios' using errcode = '22023';
  end if;

  if target_expedition_id not in ('mata-encantada', 'arquipelago-das-mares') then
    raise exception 'Expedição ARPG inválida' using errcode = '22023';
  end if;

  perform 1
  from public.profiles
  where id = target_player_id
  for update;

  if not found then
    raise exception 'Perfil do jogador não encontrado' using errcode = 'P0002';
  end if;

  if not target_victory then
    return jsonb_build_object(
      'coins', 0,
      'xp', 0,
      'victory', false,
      'items', '[]'::jsonb,
      'newItems', '[]'::jsonb,
      'replayed', false
    );
  end if;

  target_support_id := case target_expedition_id
    when 'mata-encantada' then 'support-saci'
    when 'arquipelago-das-mares' then 'support-iara'
    else null
  end;

  if target_support_id is not null then
    insert into public.reward_ledger (user_id, source_type, source_id, reward)
    values (
      target_player_id,
      'arpg_support_first_clear',
      target_expedition_id,
      jsonb_build_object(
        'supportId', target_support_id,
        'runId', target_run_id,
        'expeditionId', target_expedition_id
      )
    )
    on conflict (user_id, source_type, source_id) do nothing;

    if found then
      insert into public.inventory_items (user_id, item_key, quantity, metadata)
      values (
        target_player_id,
        target_support_id,
        1,
        jsonb_build_object(
          'source', 'arpg_support_first_clear',
          'expeditionId', target_expedition_id,
          'runId', target_run_id
        )
      )
      on conflict (user_id, item_key) do update
      set quantity = greatest(public.inventory_items.quantity, 1),
          metadata = public.inventory_items.metadata || excluded.metadata,
          updated_at = now();
      new_items := array[target_support_id]::text[];
    end if;
  end if;

  select ledger.reward into existing_reward
  from public.reward_ledger ledger
  where ledger.user_id = target_player_id
    and ledger.source_type = 'arpg_expedition_first_clear'
    and ledger.source_id = target_expedition_id;

  if existing_reward is not null then
    return existing_reward || jsonb_build_object(
      'replayed', true,
      'newItems', to_jsonb(new_items)
    );
  end if;

  if target_expedition_id = 'mata-encantada' then
    reward_coins := 60;
    reward_xp := 120;
    reward_items := array[
      'ritual-staff', 'ritual-cloak', 'iron-sword', 'caipora-arrow'
    ]::text[];
  else
    reward_coins := 90;
    reward_xp := 180;
    reward_items := array[
      'tide-blade', 'river-shell-armor', 'river-bow',
      'kappa-splash', 'kelpie-surge'
    ]::text[];
  end if;

  reward := jsonb_build_object(
    'coins', reward_coins,
    'xp', reward_xp,
    'victory', true,
    'runId', target_run_id,
    'expeditionId', target_expedition_id,
    'items', to_jsonb(reward_items)
  );

  insert into public.reward_ledger (user_id, source_type, source_id, reward)
  values (
    target_player_id,
    'arpg_expedition_first_clear',
    target_expedition_id,
    reward
  );

  update public.profiles
  set coins = coins + reward_coins,
      xp = xp + reward_xp
  where id = target_player_id;

  insert into public.inventory_items (user_id, item_key, quantity, metadata)
  select
    target_player_id,
    reward_item,
    1,
    jsonb_build_object(
      'source', 'arpg_expedition_first_clear',
      'expeditionId', target_expedition_id
    )
  from unnest(reward_items) as reward_item
  on conflict (user_id, item_key) do update
  set quantity = greatest(public.inventory_items.quantity, 1),
      metadata = public.inventory_items.metadata || excluded.metadata,
      updated_at = now();

  return reward || jsonb_build_object(
    'replayed', false,
    'newItems', to_jsonb(new_items)
  );
end;
$$;
revoke all on function private.claim_arpg_expedition_reward(uuid, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function private.claim_arpg_expedition_reward(uuid, uuid, text, boolean)
  to service_role;
create or replace function private.save_arpg_loadout(
  target_player_id uuid,
  target_weapon_id text,
  target_armor_id text,
  target_support_ids text[],
  target_ability_ids text[]
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  distinct_supports integer;
  distinct_abilities integer;
  result_row public.player_arpg_loadouts%rowtype;
begin
  if target_player_id is null then
    raise exception 'Jogador obrigatório' using errcode = '22023';
  end if;

  if target_weapon_id not in (
    'iron-sword','forest-bow','ritual-staff',
    'tide-blade','river-bow','iara-song-staff'
  ) then
    raise exception 'Arma ARPG inválida' using errcode = '22023';
  end if;

  if target_armor_id not in (
    'leather-armor','forest-guardian-armor','ritual-cloak',
    'river-shell-armor','kelpie-mist-cloak','ahuizotl-guard-armor'
  ) then
    raise exception 'Armadura ARPG inválida' using errcode = '22023';
  end if;

  if cardinality(target_support_ids) <> 2
    or not (target_support_ids <@ array[
      'support-curupira','support-boitata','support-saci','support-iara'
    ]::text[]) then
    raise exception 'Os dois suportes ARPG são inválidos' using errcode = '22023';
  end if;

  select count(distinct value) into distinct_supports
  from unnest(target_support_ids) as values_list(value);
  if distinct_supports <> 2 then
    raise exception 'Os suportes ARPG não podem se repetir' using errcode = '22023';
  end if;

  if cardinality(target_ability_ids) <> 4
    or not (target_ability_ids <@ array[
      'ancestral-roots','boitata-flame','saci-whirlwind','iara-song',
      'caipora-arrow','kappa-splash','kelpie-surge','tengu-gust',
      'banshee-wail','medusa-gaze','kraken-grasp','simurgh-renewal',
      'roc-horizon-storm'
    ]::text[]) then
    raise exception 'As cartas-habilidade ARPG são inválidas' using errcode = '22023';
  end if;

  select count(distinct value) into distinct_abilities
  from unnest(target_ability_ids) as values_list(value);
  if distinct_abilities <> 4 then
    raise exception 'As cartas-habilidade ARPG não podem se repetir' using errcode = '22023';
  end if;

  perform 1 from public.profiles where id = target_player_id;
  if not found then
    raise exception 'Perfil do jogador não encontrado' using errcode = 'P0002';
  end if;

  if target_weapon_id <> 'forest-bow' and not exists (
    select 1 from public.inventory_items
    where user_id = target_player_id
      and item_key = target_weapon_id
      and quantity > 0
  ) then
    raise exception 'A conta não possui esta arma' using errcode = '42501';
  end if;

  if target_armor_id <> 'leather-armor' and not exists (
    select 1 from public.inventory_items
    where user_id = target_player_id
      and item_key = target_armor_id
      and quantity > 0
  ) then
    raise exception 'A conta não possui esta armadura' using errcode = '42501';
  end if;

  if exists (
    select 1
    from unnest(target_support_ids) as selected(support_id)
    where selected.support_id not in ('support-curupira','support-boitata')
      and not exists (
        select 1
        from public.inventory_items inventory
        where inventory.user_id = target_player_id
          and inventory.item_key = selected.support_id
          and inventory.quantity > 0
      )
  ) then
    raise exception 'A conta não possui um ou mais suportes'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from unnest(target_ability_ids) as selected(card_id)
    where selected.card_id not in (
      'ancestral-roots','boitata-flame','saci-whirlwind','iara-song'
    )
      and not exists (
        select 1
        from public.inventory_items inventory
        where inventory.user_id = target_player_id
          and inventory.item_key = selected.card_id
          and inventory.quantity > 0
      )
  ) then
    raise exception 'A conta não possui uma ou mais cartas-habilidade'
      using errcode = '42501';
  end if;

  insert into public.player_arpg_loadouts (
    user_id, weapon_id, armor_id, support_ids, ability_ids, updated_at
  ) values (
    target_player_id,
    target_weapon_id,
    target_armor_id,
    target_support_ids,
    target_ability_ids,
    now()
  )
  on conflict (user_id) do update set
    weapon_id = excluded.weapon_id,
    armor_id = excluded.armor_id,
    support_ids = excluded.support_ids,
    ability_ids = excluded.ability_ids,
    updated_at = excluded.updated_at
  returning * into result_row;

  return jsonb_build_object(
    'weaponId', result_row.weapon_id,
    'armorId', result_row.armor_id,
    'supportIds', to_jsonb(result_row.support_ids),
    'abilityIds', to_jsonb(result_row.ability_ids),
    'updatedAt', result_row.updated_at
  );
end;
$$;
revoke all on function private.save_arpg_loadout(uuid, text, text, text[], text[])
  from public, anon, authenticated;
grant execute on function private.save_arpg_loadout(uuid, text, text, text[], text[])
  to service_role;
