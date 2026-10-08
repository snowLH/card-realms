-- Folklard-only API surface: remove client execution permissions from
-- obsolete turn-based battle, energy, classic PvP and creature-evolution RPCs.
-- No tables, users, or inventory data are deleted by this migration.
-- The names are restricted to the retired set; modern ARPG/co-op RPCs remain callable.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS arguments
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'buy_energy_pack',
        'choose_starter_card',
        'evolve_owned_creature',
        'create_pvp_challenge',
        'cancel_pvp_challenge',
        'decline_pvp_challenge',
        'start_pvp_challenge',
        'commit_pvp_action',
        'claim_story_battle_reward',
        'get_arpg_power_gacha_state',
        'roll_arpg_power_gacha',
        'redeem_arpg_power_gacha_card'
      ]::text[])
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
      fn.proname, fn.arguments
    );
  END LOOP;
END;
$$;
