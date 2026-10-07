-- Give profiles created after deployment the same avatar-mode starter contract
-- as the accounts that were reconciled when Legend combat was introduced.
-- Existing profiles and their saved state are intentionally untouched.

alter table public.profiles
  alter column avatar_config set default
    '{"legendId":"curupira","favoriteLegendId":"curupira","skin":"copper","hair":"mohawk","outfit":"ranger","armor":"none","accent":"crimson"}'::jsonb;

create or replace function private.initialize_new_profile_avatar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Sign-ups always begin as the free Legend. The player can customize this
  -- after the profile exists through the normal avatar-save contract.
  new.avatar_config :=
    '{"legendId":"curupira","favoriteLegendId":"curupira","skin":"copper","hair":"mohawk","outfit":"ranger","armor":"none","accent":"crimson"}'::jsonb;
  return new;
end;
$$;

revoke all on function private.initialize_new_profile_avatar()
  from public, anon, authenticated;
grant execute on function private.initialize_new_profile_avatar()
  to service_role;

drop trigger if exists initialize_new_profile_avatar_before_insert on public.profiles;
create trigger initialize_new_profile_avatar_before_insert
before insert on public.profiles
for each row execute function private.initialize_new_profile_avatar();

create or replace function private.initialize_new_profile_legend_loadout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  starter_ability_ids text[] := private.legend_signature_ability_ids('curupira');
begin
  -- Curupira is the free starter Legend. Store ownership explicitly so every
  -- inventory-based client sees the same entitlement as database validators.
  insert into public.inventory_items (user_id, item_key, quantity, metadata)
  values (
    new.id,
    'legend-curupira',
    1,
    jsonb_build_object('source', 'profile_signup_bootstrap', 'legendId', 'curupira', 'grantedAt', now())
  )
  on conflict (user_id, item_key) do update
  set quantity = greatest(public.inventory_items.quantity, excluded.quantity),
      metadata = public.inventory_items.metadata || excluded.metadata,
      updated_at = now();

  insert into public.inventory_items (user_id, item_key, quantity, metadata)
  select
    new.id,
    ability.ability_id,
    1,
    jsonb_build_object(
      'source', 'profile_signup_bootstrap',
      'legendId', 'curupira',
      'grantedAt', now()
    )
  from unnest(starter_ability_ids) as ability(ability_id)
  on conflict (user_id, item_key) do update
  set quantity = greatest(public.inventory_items.quantity, excluded.quantity),
      metadata = public.inventory_items.metadata || excluded.metadata,
      updated_at = now();

  -- leather-armor is a required legacy column value that now represents no
  -- armor. The active equipment contract remains the starter bow, compass and
  -- exactly the two signature abilities; the interface does not expose armor.
  insert into public.player_arpg_loadouts (
    user_id,
    weapon_id,
    secondary_weapon_id,
    armor_id,
    relic_id,
    ability_ids,
    updated_at
  ) values (
    new.id,
    'forest-bow',
    'iron-sword',
    'leather-armor',
    'cartographer-compass',
    starter_ability_ids,
    now()
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.initialize_new_profile_legend_loadout()
  from public, anon, authenticated;
grant execute on function private.initialize_new_profile_legend_loadout()
  to service_role;

drop trigger if exists initialize_new_profile_legend_loadout_after_insert on public.profiles;
create trigger initialize_new_profile_legend_loadout_after_insert
after insert on public.profiles
for each row execute function private.initialize_new_profile_legend_loadout();
