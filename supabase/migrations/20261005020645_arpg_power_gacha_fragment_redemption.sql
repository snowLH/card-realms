-- Fixed, fragment-only prices: five duplicate rewards buy one card of the
-- same rarity. Mythic cards remain part of the legendary draw tier.
create or replace function private.arpg_power_gacha_fragment_cost(target_rarity text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case target_rarity
    when 'common' then 25
    when 'uncommon' then 40
    when 'rare' then 70
    when 'epic' then 120
    when 'legendary' then 225
    when 'mythic' then 300
    else null
  end;
$$;
revoke all on function private.arpg_power_gacha_fragment_cost(text) from public, anon, authenticated;
create table private.arpg_power_gacha_redemptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  idempotency_key uuid not null,
  card_id text not null references private.arpg_power_gacha_catalog(card_id) on delete restrict,
  fragments_spent integer not null check (fragments_spent > 0),
  fragments_after integer not null check (fragments_after >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index arpg_power_gacha_redemptions_user_created_idx
  on private.arpg_power_gacha_redemptions (user_id, created_at desc);
revoke all on table private.arpg_power_gacha_redemptions from public, anon, authenticated;
grant usage on schema private to authenticated;
-- Include the authenticated account, current owned pool cards, and the fixed
-- prices in the same state response used by the client panel.
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
  owned_cards jsonb;
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

  select coalesce(jsonb_agg(inventory.item_key order by inventory.item_key), '[]'::jsonb)
  into owned_cards
  from public.inventory_items as inventory
  join private.arpg_power_gacha_catalog as catalog
    on catalog.card_id = inventory.item_key
  where inventory.user_id = player_id
    and inventory.quantity > 0
    and catalog.enabled;

  return jsonb_build_object(
    'accountId', player_id,
    'cost', 80,
    'coins', current_coins,
    'legendFragments', current_fragments,
    'ownedCardIds', owned_cards,
    'fragmentCosts', jsonb_build_object(
      'common', private.arpg_power_gacha_fragment_cost('common'),
      'uncommon', private.arpg_power_gacha_fragment_cost('uncommon'),
      'rare', private.arpg_power_gacha_fragment_cost('rare'),
      'epic', private.arpg_power_gacha_fragment_cost('epic'),
      'legendary', private.arpg_power_gacha_fragment_cost('legendary'),
      'mythic', private.arpg_power_gacha_fragment_cost('mythic')
    ),
    'pityMisses', current_misses,
    'softPityStartsAtMisses', 9,
    'hardPityAfterMisses', 19,
    'rollsUntilGuaranteedEpic', greatest(0, 20 - current_misses),
    'probabilities', private.arpg_power_gacha_odds(current_misses)
  );
end;
$$;
-- Keep the legacy implementation private, but require the client to bind its
-- idempotency key to the expected authenticated account before invoking it.
drop function if exists public.roll_arpg_power_gacha(uuid);
revoke all on function private.roll_arpg_power_gacha(uuid) from public, anon, authenticated;
create or replace function private.roll_arpg_power_gacha(
  target_idempotency_key uuid,
  target_user_id uuid
)
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
  if target_user_id is distinct from player_id then
    raise exception 'A chave desta rolagem pertence a outra conta' using errcode = '42501';
  end if;
  return private.roll_arpg_power_gacha(target_idempotency_key);
end;
$$;
revoke all on function private.roll_arpg_power_gacha(uuid, uuid) from public, anon, authenticated;
grant execute on function private.roll_arpg_power_gacha(uuid, uuid) to authenticated;
create or replace function public.roll_arpg_power_gacha(
  target_idempotency_key uuid,
  target_user_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.roll_arpg_power_gacha(target_idempotency_key, target_user_id);
$$;
revoke all on function public.roll_arpg_power_gacha(uuid, uuid) from public, anon;
grant execute on function public.roll_arpg_power_gacha(uuid, uuid) to authenticated;
create or replace function private.redeem_arpg_power_gacha_card(
  target_user_id uuid,
  target_card_id text,
  target_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  current_coins bigint;
  current_fragments integer;
  fragment_cost integer;
  owned_cards jsonb;
  selected_card private.arpg_power_gacha_catalog%rowtype;
  existing_redemption private.arpg_power_gacha_redemptions%rowtype;
  acquired_card_id text;
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;
  if target_user_id is distinct from player_id then
    raise exception 'O resgate pertence a outra conta' using errcode = '42501';
  end if;
  if target_idempotency_key is null then
    raise exception 'Chave de resgate obrigatória' using errcode = '22023';
  end if;

  -- Match the roll and direct shop lock order so coins, pity, and fragment
  -- operations for one account serialize consistently.
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

  select state.legend_fragments
  into current_fragments
  from private.arpg_power_gacha_state as state
  where state.user_id = player_id
  for update;

  select * into existing_redemption
  from private.arpg_power_gacha_redemptions as redemptions
  where redemptions.user_id = player_id
    and redemptions.idempotency_key = target_idempotency_key;
  if found then
    if existing_redemption.card_id <> target_card_id then
      raise exception 'A chave de resgate já foi usada para outro poder' using errcode = '22023';
    end if;

    select * into selected_card
    from private.arpg_power_gacha_catalog as catalog
    where catalog.card_id = existing_redemption.card_id;

    select coalesce(jsonb_agg(inventory.item_key order by inventory.item_key), '[]'::jsonb)
    into owned_cards
    from public.inventory_items as inventory
    join private.arpg_power_gacha_catalog as catalog
      on catalog.card_id = inventory.item_key
    where inventory.user_id = player_id
      and inventory.quantity > 0
      and catalog.enabled;

    return jsonb_build_object(
      'itemId', existing_redemption.card_id,
      'rarity', selected_card.card_rarity,
      'tier', selected_card.tier,
      'fragmentsSpent', existing_redemption.fragments_spent,
      'legendFragments', current_fragments,
      'ownedCardIds', owned_cards,
      'replayed', true
    );
  end if;

  select * into selected_card
  from private.arpg_power_gacha_catalog as catalog
  where catalog.card_id = target_card_id
    and catalog.enabled;
  if not found then
    raise exception 'Poder fora do catálogo de resgate' using errcode = 'P0002';
  end if;

  fragment_cost := private.arpg_power_gacha_fragment_cost(selected_card.card_rarity);
  if fragment_cost is null then
    raise exception 'Raridade sem custo de resgate' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.inventory_items as inventory
    where inventory.user_id = player_id
      and inventory.item_key = selected_card.card_id
      and inventory.quantity > 0
  ) then
    raise exception 'Poder já adquirido' using errcode = '23505';
  end if;
  if current_fragments < fragment_cost then
    raise exception 'Fragmentos insuficientes para este poder' using errcode = '22023';
  end if;

  -- Claim the unique inventory key before debiting fragments. If a concurrent
  -- grant won the race, the conditional upsert returns no row and this whole
  -- transaction exits without charging the player.
  insert into public.inventory_items (user_id, item_key, quantity, metadata)
  values (
    player_id,
    selected_card.card_id,
    1,
    jsonb_build_object('source', 'arpg_power_gacha_fragments', 'acquired_at', now())
  )
  on conflict (user_id, item_key) do update
  set quantity = 1,
      metadata = public.inventory_items.metadata || excluded.metadata,
      updated_at = now()
  where public.inventory_items.quantity <= 0
  returning item_key into acquired_card_id;

  if acquired_card_id is null then
    raise exception 'Poder já adquirido' using errcode = '23505';
  end if;

  update private.arpg_power_gacha_state
  set legend_fragments = current_fragments - fragment_cost,
      updated_at = now()
  where user_id = player_id
  returning legend_fragments into current_fragments;

  insert into private.arpg_power_gacha_redemptions (
    user_id, idempotency_key, card_id, fragments_spent, fragments_after
  ) values (
    player_id, target_idempotency_key, selected_card.card_id, fragment_cost, current_fragments
  );

  select coalesce(jsonb_agg(inventory.item_key order by inventory.item_key), '[]'::jsonb)
  into owned_cards
  from public.inventory_items as inventory
  join private.arpg_power_gacha_catalog as catalog
    on catalog.card_id = inventory.item_key
  where inventory.user_id = player_id
    and inventory.quantity > 0
    and catalog.enabled;

  return jsonb_build_object(
    'itemId', selected_card.card_id,
    'rarity', selected_card.card_rarity,
    'tier', selected_card.tier,
    'fragmentsSpent', fragment_cost,
    'legendFragments', current_fragments,
    'ownedCardIds', owned_cards,
    'replayed', false
  );
end;
$$;
revoke all on function private.redeem_arpg_power_gacha_card(uuid, text, uuid) from public, anon, authenticated;
grant execute on function private.redeem_arpg_power_gacha_card(uuid, text, uuid) to authenticated;
create or replace function public.redeem_arpg_power_gacha_card(
  target_user_id uuid,
  target_card_id text,
  target_idempotency_key uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.redeem_arpg_power_gacha_card(
    target_user_id, target_card_id, target_idempotency_key
  );
$$;
revoke all on function public.redeem_arpg_power_gacha_card(uuid, text, uuid) from public, anon;
grant execute on function public.redeem_arpg_power_gacha_card(uuid, text, uuid) to authenticated;
