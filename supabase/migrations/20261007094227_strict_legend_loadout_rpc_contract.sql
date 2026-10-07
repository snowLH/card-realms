-- Keep the existing four-argument client contract, but route it through the
-- strict implementation that checks the authenticated player's active Legend.
create or replace function public.save_arpg_loadout(
  target_weapon_id text,
  target_armor_id text,
  target_relic_id text,
  target_ability_ids text[]
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.save_arpg_loadout(
    target_weapon_id,
    target_armor_id,
    target_relic_id,
    target_ability_ids
  );
$$;

revoke all on function public.save_arpg_loadout(text, text, text, text[])
  from public, anon, authenticated, service_role;
grant execute on function public.save_arpg_loadout(text, text, text, text[])
  to authenticated;

-- The strict private helper is called by the invoker wrapper as the caller.
revoke all on function private.save_arpg_loadout(text, text, text, text[])
  from public, anon, service_role;
grant execute on function private.save_arpg_loadout(text, text, text, text[])
  to authenticated;

-- No application or trusted server code uses the superseded five-argument
-- contract, so remove its execution path for every API role.
revoke all on function public.save_arpg_loadout(text, text, text, text, text[])
  from public, anon, authenticated, service_role;
revoke all on function private.save_arpg_loadout(text, text, text, text, text[])
  from public, anon, authenticated, service_role;
