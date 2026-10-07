-- Server-priced purchases for ARPG equipment and Refuge cosmetics.
-- Existing Refuge decorations become owned inventory before the shop gate is enabled.
insert into public.inventory_items (user_id, item_key, quantity, metadata)
select distinct
  houses.user_id,
  case furniture.value ->> 'itemKey'
    when 'books' then 'refuge-furniture-books'
    when 'chest' then 'refuge-furniture-chest'
    when 'map-stand' then 'refuge-furniture-map-stand'
  end,
  1,
  jsonb_build_object('source', 'legacy_refuge_layout')
from public.houses
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(houses.layout -> 'furniture') = 'array' then houses.layout -> 'furniture'
    else '[]'::jsonb
  end
) as furniture(value)
where furniture.value ->> 'itemKey' in ('books', 'chest', 'map-stand')
on conflict (user_id, item_key) do update
set quantity = greatest(public.inventory_items.quantity, excluded.quantity),
    metadata = public.inventory_items.metadata || excluded.metadata;
create or replace function private.purchase_arpg_merchant_item(target_item_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  item_price bigint;
  current_coins bigint;
  current_quantity integer;
begin
  if player_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  item_price := case target_item_key
    when 'forest-bow' then 180
    when 'ritual-cloak' then 140
    when 'refuge-furniture-books' then 45
    when 'refuge-furniture-chest' then 60
    when 'refuge-furniture-map-stand' then 75
    else null
  end;
  if item_price is null then
    raise exception 'Item indisponível no Mercador' using errcode = '22023';
  end if;

  select profiles.coins
  into current_coins
  from public.profiles
  where profiles.id = player_id
  for update;
  if current_coins is null then
    raise exception 'Perfil não encontrado' using errcode = 'P0002';
  end if;

  select inventory_items.quantity
  into current_quantity
  from public.inventory_items
  where inventory_items.user_id = player_id
    and inventory_items.item_key = target_item_key
  for update;
  if coalesce(current_quantity, 0) > 0 then
    raise exception 'Item já adquirido' using errcode = '23505';
  end if;
  if current_coins < item_price then
    raise exception 'Moedas insuficientes' using errcode = '22023';
  end if;

  update public.profiles
  set coins = profiles.coins - item_price
  where profiles.id = player_id
  returning profiles.coins into current_coins;

  insert into public.inventory_items (user_id, item_key, quantity, metadata)
  values (
    player_id,
    target_item_key,
    1,
    jsonb_build_object('source', 'arpg_merchant', 'acquired_at', now())
  )
  on conflict (user_id, item_key) do update
  set quantity = greatest(public.inventory_items.quantity, 1),
      metadata = public.inventory_items.metadata || excluded.metadata,
      updated_at = now();

  return jsonb_build_object(
    'coins', current_coins,
    'itemKey', target_item_key,
    'quantity', 1
  );
end;
$$;
revoke all on function private.purchase_arpg_merchant_item(text) from public, anon;
grant execute on function private.purchase_arpg_merchant_item(text) to authenticated, service_role;
create or replace function public.purchase_arpg_merchant_item(target_item_key text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.purchase_arpg_merchant_item(target_item_key); $$;
revoke all on function public.purchase_arpg_merchant_item(text) from public, anon;
grant execute on function public.purchase_arpg_merchant_item(text) to authenticated, service_role;
