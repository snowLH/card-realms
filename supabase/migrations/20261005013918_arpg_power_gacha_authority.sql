-- Internal-currency gacha for the Archive of Powers. The pool is fixed here
-- and the client can only provide an idempotency key; neither odds nor results
-- are accepted from the browser.

create table private.arpg_power_gacha_catalog (
  card_id text primary key check (card_id ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  tier text not null check (tier in ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  card_rarity text not null check (card_rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic')),
  duplicate_fragments integer not null check (duplicate_fragments > 0),
  enabled boolean not null default true
);

insert into private.arpg_power_gacha_catalog (card_id, tier, card_rarity, duplicate_fragments) values
  ('caipora-arrow', 'common', 'common', 5),
  ('kappa-splash', 'common', 'common', 5),
  ('saci-whirlwind', 'uncommon', 'uncommon', 8),
  ('kelpie-surge', 'uncommon', 'uncommon', 8),
  ('tengu-gust', 'uncommon', 'uncommon', 8),
  ('banshee-wail', 'rare', 'rare', 14),
  ('iara-song', 'epic', 'epic', 24),
  ('medusa-gaze', 'legendary', 'legendary', 45),
  ('kraken-grasp', 'legendary', 'legendary', 45),
  ('simurgh-renewal', 'legendary', 'legendary', 45),
  ('roc-horizon-storm', 'legendary', 'mythic', 60);

create table private.arpg_power_gacha_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  misses_since_epic integer not null default 0 check (misses_since_epic between 0 and 19),
  legend_fragments integer not null default 0 check (legend_fragments between 0 and 2147483647),
  updated_at timestamptz not null default now()
);

create table private.arpg_power_gacha_rolls (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  idempotency_key uuid not null,
  card_id text not null references private.arpg_power_gacha_catalog(card_id) on delete restrict,
  tier text not null check (tier in ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  duplicate boolean not null,
  fragments_awarded integer not null default 0 check (fragments_awarded >= 0),
  pity_before integer not null check (pity_before between 0 and 19),
  pity_after integer not null check (pity_after between 0 and 19),
  coins_after bigint not null check (coins_after >= 0),
  legend_fragments_after integer not null check (legend_fragments_after between 0 and 2147483647),
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index arpg_power_gacha_rolls_user_created_idx
  on private.arpg_power_gacha_rolls (user_id, created_at desc);

revoke all on table private.arpg_power_gacha_catalog from public, anon, authenticated;
revoke all on table private.arpg_power_gacha_state from public, anon, authenticated;
revoke all on table private.arpg_power_gacha_rolls from public, anon, authenticated;

create or replace function private.arpg_power_gacha_odds(target_misses integer)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  pity_misses integer := greatest(0, least(19, coalesce(target_misses, 0)));
  soft_steps integer;
  common_bp integer;
  uncommon_bp integer := 2800;
  rare_bp integer := 1400;
  epic_bp integer;
  legendary_bp integer;
begin
  if pity_misses >= 19 then
    common_bp := 0;
    uncommon_bp := 0;
    rare_bp := 0;
    epic_bp := 7500;
    legendary_bp := 2500;
  else
    soft_steps := greatest(0, least(10, pity_misses - 8));
    common_bp := 5000 - (400 * soft_steps);
    epic_bp := 600 + (350 * soft_steps);
    legendary_bp := 200 + (50 * soft_steps);
  end if;

  return jsonb_build_object(
    'common', common_bp / 100.0,
    'uncommon', uncommon_bp / 100.0,
    'rare', rare_bp / 100.0,
    'epic', epic_bp / 100.0,
    'legendary', legendary_bp / 100.0
  );
end;
$$;

revoke all on function private.arpg_power_gacha_odds(integer) from public, anon, authenticated;

create or replace function private.get_arpg_power_gacha_state()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  current_coins bigint;
  current_misses integer;
  current_fragments integer;
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  select profiles.coins into current_coins
  from public.profiles as profiles
  where profiles.id = player_id;
  if current_coins is null then
    raise exception 'Perfil do jogador não encontrado' using errcode = 'P0002';
  end if;

  insert into private.arpg_power_gacha_state (user_id)
  values (player_id)
  on conflict (user_id) do nothing;

  select state.misses_since_epic, state.legend_fragments
  into current_misses, current_fragments
  from private.arpg_power_gacha_state as state
  where state.user_id = player_id;

  return jsonb_build_object(
    'cost', 80,
    'coins', current_coins,
    'legendFragments', current_fragments,
    'pityMisses', current_misses,
    'softPityStartsAtMisses', 9,
    'hardPityAfterMisses', 19,
    'rollsUntilGuaranteedEpic', greatest(0, 20 - current_misses),
    'probabilities', private.arpg_power_gacha_odds(current_misses)
  );
end;
$$;

revoke all on function private.get_arpg_power_gacha_state() from public, anon, authenticated;
grant execute on function private.get_arpg_power_gacha_state() to authenticated;

create or replace function private.roll_arpg_power_gacha(target_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  existing_roll private.arpg_power_gacha_rolls%rowtype;
  current_coins bigint;
  current_misses integer;
  next_misses integer;
  current_fragments integer;
  selected_tier text;
  selected_card private.arpg_power_gacha_catalog%rowtype;
  roll_bp integer;
  available_count integer;
  selected_offset integer;
  secure_random bytea;
  random_value bigint;
  common_bp integer;
  uncommon_bp integer;
  rare_bp integer;
  epic_bp integer;
  legendary_bp integer;
  is_duplicate boolean;
  fragment_reward integer := 0;
  coins_after bigint;
  fragments_after integer;
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;
  if target_idempotency_key is null then
    raise exception 'Chave de rolagem obrigatória' using errcode = '22023';
  end if;

  -- All currency-writing ARPG purchase RPCs lock the profile first. This also
  -- serializes concurrent requests for the same account before checking the
  -- idempotency record or current inventory.
  select profiles.coins into current_coins
  from public.profiles as profiles
  where profiles.id = player_id
  for update;
  if current_coins is null then
    raise exception 'Perfil do jogador não encontrado' using errcode = 'P0002';
  end if;

  insert into private.arpg_power_gacha_state (user_id)
  values (player_id)
  on conflict (user_id) do nothing;

  select state.misses_since_epic, state.legend_fragments
  into current_misses, current_fragments
  from private.arpg_power_gacha_state as state
  where state.user_id = player_id
  for update;

  select * into existing_roll
  from private.arpg_power_gacha_rolls as rolls
  where rolls.user_id = player_id
    and rolls.idempotency_key = target_idempotency_key;
  if found then
    return jsonb_build_object(
      'coins', current_coins,
      'itemId', existing_roll.card_id,
      'rarity', (select catalog.card_rarity from private.arpg_power_gacha_catalog as catalog where catalog.card_id = existing_roll.card_id),
      'tier', existing_roll.tier,
      'duplicate', existing_roll.duplicate,
      'fragmentsAwarded', existing_roll.fragments_awarded,
      'legendFragments', current_fragments,
      'pityMisses', current_misses,
      'rollsUntilGuaranteedEpic', greatest(0, 20 - current_misses),
      'probabilities', private.arpg_power_gacha_odds(current_misses),
      'replayed', true
    );
  end if;

  if current_coins < 80 then
    raise exception 'Moedas insuficientes para a roletagem' using errcode = '22023';
  end if;

  select
    round((odds.value ->> 'common')::numeric * 100)::integer,
    round((odds.value ->> 'uncommon')::numeric * 100)::integer,
    round((odds.value ->> 'rare')::numeric * 100)::integer,
    round((odds.value ->> 'epic')::numeric * 100)::integer,
    round((odds.value ->> 'legendary')::numeric * 100)::integer
  into common_bp, uncommon_bp, rare_bp, epic_bp, legendary_bp
  from (select private.arpg_power_gacha_odds(current_misses) as value) as odds;

  secure_random := extensions.gen_random_bytes(4);
  random_value := get_byte(secure_random, 0)::bigint * 16777216
    + get_byte(secure_random, 1)::bigint * 65536
    + get_byte(secure_random, 2)::bigint * 256
    + get_byte(secure_random, 3)::bigint;
  roll_bp := (random_value % 10000)::integer;
  if roll_bp < legendary_bp then
    selected_tier := 'legendary';
  elsif roll_bp < legendary_bp + epic_bp then
    selected_tier := 'epic';
  elsif roll_bp < legendary_bp + epic_bp + rare_bp then
    selected_tier := 'rare';
  elsif roll_bp < legendary_bp + epic_bp + rare_bp + uncommon_bp then
    selected_tier := 'uncommon';
  else
    selected_tier := 'common';
  end if;

  select count(*)::integer into available_count
  from private.arpg_power_gacha_catalog as catalog
  where catalog.tier = selected_tier
    and catalog.enabled;
  if available_count = 0 then
    raise exception 'A faixa sorteada não possui poderes disponíveis' using errcode = 'P0002';
  end if;

  secure_random := extensions.gen_random_bytes(4);
  random_value := get_byte(secure_random, 0)::bigint * 16777216
    + get_byte(secure_random, 1)::bigint * 65536
    + get_byte(secure_random, 2)::bigint * 256
    + get_byte(secure_random, 3)::bigint;
  selected_offset := (random_value % available_count)::integer;

  select * into selected_card
  from private.arpg_power_gacha_catalog as catalog
  where catalog.tier = selected_tier
    and catalog.enabled
  order by catalog.card_id
  offset selected_offset
  limit 1;

  select exists (
    select 1
    from public.inventory_items as inventory
    where inventory.user_id = player_id
      and inventory.item_key = selected_card.card_id
      and inventory.quantity > 0
  ) into is_duplicate;

  if is_duplicate then
    fragment_reward := selected_card.duplicate_fragments;
    current_fragments := current_fragments + fragment_reward;
  else
    insert into public.inventory_items (user_id, item_key, quantity, metadata)
    values (
      player_id,
      selected_card.card_id,
      1,
      jsonb_build_object('source', 'arpg_power_gacha', 'acquired_at', now())
    )
    on conflict (user_id, item_key) do update
    set quantity = greatest(public.inventory_items.quantity, 1),
        metadata = public.inventory_items.metadata || excluded.metadata,
        updated_at = now();
  end if;

  if selected_tier in ('epic', 'legendary') then
    next_misses := 0;
  else
    next_misses := least(19, current_misses + 1);
  end if;

  update private.arpg_power_gacha_state
  set misses_since_epic = next_misses,
      legend_fragments = current_fragments,
      updated_at = now()
  where user_id = player_id;

  update public.profiles
  set coins = profiles.coins - 80
  where profiles.id = player_id
  returning profiles.coins into coins_after;

  fragments_after := current_fragments;

  insert into private.arpg_power_gacha_rolls (
    user_id, idempotency_key, card_id, tier, duplicate, fragments_awarded,
    pity_before, pity_after, coins_after, legend_fragments_after
  ) values (
    player_id, target_idempotency_key, selected_card.card_id, selected_tier,
    is_duplicate, fragment_reward, current_misses, next_misses, coins_after,
    fragments_after
  );

  return jsonb_build_object(
    'coins', coins_after,
    'itemId', selected_card.card_id,
    'rarity', selected_card.card_rarity,
    'tier', selected_tier,
    'duplicate', is_duplicate,
    'fragmentsAwarded', fragment_reward,
    'legendFragments', fragments_after,
    'pityMisses', next_misses,
    'rollsUntilGuaranteedEpic', greatest(0, 20 - next_misses),
    'probabilities', private.arpg_power_gacha_odds(next_misses),
    'replayed', false
  );
end;
$$;

revoke all on function private.roll_arpg_power_gacha(uuid) from public, anon, authenticated;
grant execute on function private.roll_arpg_power_gacha(uuid) to authenticated;

create or replace function public.get_arpg_power_gacha_state()
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.get_arpg_power_gacha_state(); $$;

create or replace function public.roll_arpg_power_gacha(target_idempotency_key uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.roll_arpg_power_gacha(target_idempotency_key); $$;

revoke all on function public.get_arpg_power_gacha_state() from public, anon;
revoke all on function public.roll_arpg_power_gacha(uuid) from public, anon;
grant execute on function public.get_arpg_power_gacha_state() to authenticated;
grant execute on function public.roll_arpg_power_gacha(uuid) to authenticated;
