begin;

create extension if not exists pgtap with schema extensions;
select plan(41);

select is(
  (select count(*) from private.arpg_power_gacha_catalog where enabled),
  37::bigint,
  'the enabled pool contains the 11 existing and 26 new purchasable cards'
);
select is(
  (select count(*) from private.arpg_power_gacha_catalog where card_id = any(array[
    'boto-river-current', 'cuca-echo-cauldron', 'mula-cinder-stampede',
    'matinta-whistling-mark', 'boiuna-eddy-snare', 'mapinguari-hollow-roar',
    'vitoria-regia-moon-bloom', 'alicanto-mineral-glint', 'camahueto-hoofbreak',
    'ahuizotl-spring-hand', 'llorona-river-lament', 'cadejo-crossroads-pulse',
    'chupacabra-night-quills', 'jackalope-bramble-bounce', 'jersey-devil-pine-scream',
    'selkie-breaker-lance', 'black-shuck-lantern-gaze', 'baba-yaga-threshold-fence',
    'leshy-forest-circle', 'anansi-thread-snare', 'sasabonsam-canopy-strike',
    'impundulu-thunderclap', 'tokoloshe-low-mist', 'oni-kanabo-impact',
    'jiangshi-paper-seal', 'huli-jing-foxfire', 'tikbalang-hoofbeat',
    'manananggal-shadow-sweep', 'penanggalan-return-tether',
    'bunyip-billabong-echo', 'taniwha-place-ward'
  ]::text[])),
  31::bigint,
  'all 31 expansion IDs are present in the private catalogue'
);
select is(
  (select count(*) from private.arpg_power_gacha_catalog
    where enabled and card_id = any(array[
      'boto-river-current', 'cuca-echo-cauldron', 'mula-cinder-stampede',
      'matinta-whistling-mark', 'boiuna-eddy-snare', 'mapinguari-hollow-roar',
      'vitoria-regia-moon-bloom', 'alicanto-mineral-glint', 'camahueto-hoofbreak',
      'ahuizotl-spring-hand', 'llorona-river-lament', 'cadejo-crossroads-pulse',
      'chupacabra-night-quills', 'jackalope-bramble-bounce', 'jersey-devil-pine-scream',
      'selkie-breaker-lance', 'black-shuck-lantern-gaze', 'baba-yaga-threshold-fence',
      'leshy-forest-circle', 'anansi-thread-snare', 'impundulu-thunderclap',
      'tokoloshe-low-mist', 'oni-kanabo-impact', 'jiangshi-paper-seal',
      'huli-jing-foxfire', 'tikbalang-hoofbeat'
    ]::text[])),
  26::bigint,
  'the 26 cards cleared for release are enabled'
);
select is(
  (select count(*) from private.arpg_power_gacha_catalog
    where not enabled and card_id = any(array[
      'sasabonsam-canopy-strike', 'manananggal-shadow-sweep',
      'penanggalan-return-tether', 'bunyip-billabong-echo', 'taniwha-place-ward'
    ]::text[])),
  5::bigint,
  'the five culturally gated cards remain disabled in the catalogue'
);
select is(
  cardinality(private.active_arpg_power_card_ids()),
  39,
  'the active server allowlist includes 37 enabled cards and two starters'
);
select ok(
  'ancestral-roots' = any(private.active_arpg_power_card_ids()),
  'the first starter remains equipable outside the shop catalogue'
);
select ok(
  'boitata-flame' = any(private.active_arpg_power_card_ids()),
  'the second starter remains equipable outside the shop catalogue'
);
select ok(
  not ('sasabonsam-canopy-strike' = any(private.active_arpg_power_card_ids())),
  'Sasabonsam is excluded from the active allowlist'
);
select ok(
  not ('manananggal-shadow-sweep' = any(private.active_arpg_power_card_ids())),
  'Manananggal is excluded from the active allowlist'
);
select ok(
  not ('penanggalan-return-tether' = any(private.active_arpg_power_card_ids())),
  'Penanggalan is excluded from the active allowlist'
);
select ok(
  not ('bunyip-billabong-echo' = any(private.active_arpg_power_card_ids())),
  'Bunyip is excluded from the active allowlist'
);
select ok(
  not ('taniwha-place-ward' = any(private.active_arpg_power_card_ids())),
  'Taniwha is excluded from the active allowlist'
);
select ok(
  not exists (
    select 1
    from private.arpg_power_gacha_catalog as catalog
    where catalog.tier <> case catalog.card_rarity
        when 'mythic' then 'legendary'
        else catalog.card_rarity
      end
      or catalog.duplicate_fragments <> case catalog.card_rarity
        when 'common' then 5
        when 'uncommon' then 8
        when 'rare' then 14
        when 'epic' then 24
        when 'legendary' then 45
        when 'mythic' then 60
      end
  ),
  'rarity bands and duplicate fragment values are fixed for every catalogue row'
);
select ok(
  not has_function_privilege('anon', 'private.active_arpg_power_card_ids()', 'execute'),
  'anonymous callers cannot invoke the private active power helper'
);
select ok(
  has_function_privilege('authenticated', 'private.active_arpg_power_card_ids()', 'execute'),
  'authenticated writes can evaluate the structural allowlist constraint'
);
select ok(
  not has_function_privilege('authenticated', 'private.purchase_roc_horizon_storm()', 'execute'),
  'the retired Roc-specific purchase RPC is unavailable to authenticated users'
);
select ok(
  not has_function_privilege('authenticated', 'public.activate_team(uuid)', 'execute'),
  'authenticated clients cannot activate legacy six-member teams'
);
select ok(
  not has_function_privilege('authenticated', 'private.activate_team(uuid)', 'execute'),
  'authenticated clients cannot call the private legacy team activation RPC'
);
select ok(
  not has_function_privilege('authenticated', 'public.save_active_team(uuid[],text)', 'execute'),
  'authenticated clients cannot save legacy six-member teams'
);
select ok(
  has_function_privilege('service_role', 'private.activate_team(uuid)', 'execute'),
  'service_role retains access to private legacy team maintenance'
);

insert into auth.users (id, email) values
  ('83000000-0000-4000-8000-000000000008', 'folklore-power-shop@test.invalid'),
  ('84000000-0000-4000-8000-000000000008', 'folklore-roc-shop@test.invalid'),
  ('85000000-0000-4000-8000-000000000008', 'folklore-power-unowned@test.invalid');

update public.profiles set coins = 1000
where id = '83000000-0000-4000-8000-000000000008';
update public.profiles set coins = 500
where id = '84000000-0000-4000-8000-000000000008';

set local role authenticated;
select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000008', true);
select is(
  public.purchase_arpg_power_card('matinta-whistling-mark') ->> 'coins',
  '920'::text,
  'a common power costs 80 coins'
);
select is(
  public.purchase_arpg_power_card('boto-river-current') ->> 'coins',
  '800'::text,
  'an uncommon power costs 120 coins'
);
select is(
  public.purchase_arpg_power_card('cuca-echo-cauldron') ->> 'coins',
  '620'::text,
  'a rare power costs 180 coins'
);
select is(
  public.purchase_arpg_power_card('boiuna-eddy-snare') ->> 'coins',
  '380'::text,
  'an epic power costs 240 coins'
);
select is(
  public.purchase_arpg_power_card('mapinguari-hollow-roar') ->> 'coins',
  '60'::text,
  'a legendary power costs 320 coins'
);
select throws_ok(
  $$select public.purchase_arpg_power_card('sasabonsam-canopy-strike')$$,
  '22023', null,
  'a culturally gated power cannot be bought'
);
select set_config('request.jwt.claim.sub', '85000000-0000-4000-8000-000000000008', true);
select throws_ok(
  $$select public.save_arpg_loadout(
    'forest-bow', 'iron-sword', 'leather-armor', 'cartographer-compass',
    array['ancestral-roots', 'boto-river-current']::text[]
  )$$,
  '42501', null,
  'an active expansion power still requires inventory ownership'
);
select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000008', true);
select throws_ok(
  $$select public.save_arpg_loadout(
    'forest-bow', 'iron-sword', 'leather-armor', 'cartographer-compass',
    array['ancestral-roots', 'sasabonsam-canopy-strike']::text[]
  )$$,
  '22023', null,
  'a culturally gated power cannot be equipped'
);
select is(
  public.save_arpg_loadout(
    'forest-bow', 'iron-sword', 'leather-armor', 'cartographer-compass',
    array['ancestral-roots', 'boto-river-current']::text[]
  ) -> 'abilityIds',
  '["ancestral-roots","boto-river-current"]'::jsonb,
  'an owned expansion power can be saved in the five-argument loadout'
);
select is(
  public.save_arpg_loadout(
    'forest-bow', 'iron-sword', 'leather-armor', 'cartographer-compass',
    array['ancestral-roots', 'boto-river-current']::text[]
  ) ->> 'secondaryWeaponId',
  'iron-sword'::text,
  'the five-argument loadout keeps its secondary weapon contract'
);
reset role;

select is(
  (select coins from public.profiles where id = '83000000-0000-4000-8000-000000000008'),
  60::bigint,
  'the rarity-based shop debits the wallet by the configured prices'
);
select ok(
  exists (
    select 1 from public.inventory_items
    where user_id = '83000000-0000-4000-8000-000000000008'
      and item_key = 'boto-river-current'
      and quantity > 0
  ),
  'a successful shop purchase grants the selected power to inventory'
);
select ok(
  not exists (
    select 1 from public.inventory_items
    where user_id = '83000000-0000-4000-8000-000000000008'
      and item_key = 'sasabonsam-canopy-strike'
      and quantity > 0
  ),
  'a gated purchase attempt does not grant inventory'
);
select ok(
  not exists (
    select 1 from public.player_arpg_loadouts
    where user_id = '85000000-0000-4000-8000-000000000008'
  ),
  'a rejected unowned power save does not create a loadout'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '84000000-0000-4000-8000-000000000008', true);
select is(
  public.purchase_arpg_power_card('roc-horizon-storm') ->> 'coins',
  '0'::text,
  'the Roc costs exactly 500 coins in the general shop RPC'
);
reset role;
select is(
  (select coins from public.profiles where id = '84000000-0000-4000-8000-000000000008'),
  0::bigint,
  'the general shop persists the 500-coin Roc debit'
);
select ok(
  exists (
    select 1 from public.inventory_items
    where user_id = '84000000-0000-4000-8000-000000000008'
      and item_key = 'roc-horizon-storm'
      and quantity > 0
  ),
  'the Roc remains available through the general shop inventory path'
);

set local role service_role;
select throws_ok(
  $$update public.player_arpg_loadouts
    set ability_ids = array['ancestral-roots', 'sasabonsam-canopy-strike']::text[]
    where user_id = '83000000-0000-4000-8000-000000000008'$$,
  '23514', null,
  'the table constraint rejects a gated power even for direct privileged writes'
);
select is(
  private.active_avatar_power_snapshot('83000000-0000-4000-8000-000000000008') -> 'abilityIds',
  '["ancestral-roots","boto-river-current"]'::jsonb,
  'the PvP snapshot accepts the owned expansion power through the shared allowlist'
);
select is(
  private.arpg_raid_loadout_snapshot('83000000-0000-4000-8000-000000000008') -> 'abilityIds',
  '["ancestral-roots","boto-river-current"]'::jsonb,
  'the Raid snapshot accepts the owned expansion power through the shared allowlist'
);
select is(
  private.arpg_raid_loadout_snapshot('83000000-0000-4000-8000-000000000008') ->> 'secondaryWeaponId',
  'iron-sword'::text,
  'the Raid snapshot preserves the secondary weapon'
);
reset role;

select * from finish(true);
rollback;
