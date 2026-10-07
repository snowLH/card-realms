-- Stop future profiles receiving the superseded starter cards and close every
-- API-role execution path into the retired standalone power shop and gacha.
-- Keep existing inventory rows and balances untouched; the current Legend
-- bootstrap still grants its active signature pair for loadout validation.

drop trigger if exists seed_arpg_power_starters_after_profile on public.profiles;

revoke all on function private.seed_arpg_power_starters()
  from public, anon, authenticated, service_role;

revoke all on function public.purchase_arpg_power_card(text)
  from public, anon, authenticated, service_role;
revoke all on function private.purchase_arpg_power_card(text)
  from public, anon, authenticated, service_role;

revoke all on function public.get_arpg_power_gacha_state()
  from public, anon, authenticated, service_role;
revoke all on function private.get_arpg_power_gacha_state()
  from public, anon, authenticated, service_role;

-- The earlier fragment-redemption migration already drops the public
-- one-argument overload; retain the private helper only for internal callers.
revoke all on function private.roll_arpg_power_gacha(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.roll_arpg_power_gacha(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.roll_arpg_power_gacha(uuid, uuid)
  from public, anon, authenticated, service_role;

revoke all on function public.redeem_arpg_power_gacha_card(uuid, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.redeem_arpg_power_gacha_card(uuid, text, uuid)
  from public, anon, authenticated, service_role;

revoke all on function private.arpg_power_gacha_odds(integer)
  from public, anon, authenticated, service_role;
revoke all on function private.arpg_power_gacha_fragment_cost(text)
  from public, anon, authenticated, service_role;
