begin;

create extension if not exists pgtap with schema extensions;
select plan(35);

select ok(
  has_function_privilege('authenticated', 'public.get_arpg_power_gacha_state()', 'execute'),
  'authenticated players can read their own gacha state'
);
select ok(
  not has_function_privilege('anon', 'public.get_arpg_power_gacha_state()', 'execute'),
  'anonymous callers cannot read gacha state'
);
select ok(
  has_function_privilege('authenticated', 'public.roll_arpg_power_gacha(uuid,uuid)', 'execute'),
  'authenticated players can request a server roll'
);
select ok(
  not has_function_privilege('anon', 'public.roll_arpg_power_gacha(uuid,uuid)', 'execute'),
  'anonymous callers cannot request a server roll'
);
select ok(
  not has_table_privilege('authenticated', 'private.arpg_power_gacha_catalog', 'select'),
  'authenticated clients cannot inspect the private catalog'
);
select ok(
  not has_table_privilege('authenticated', 'private.arpg_power_gacha_state', 'select'),
  'authenticated clients cannot read another player’s pity state'
);
select ok(
  not has_table_privilege('authenticated', 'private.arpg_power_gacha_rolls', 'select'),
  'authenticated clients cannot inspect roll history'
);

select is(
  private.arpg_power_gacha_odds(0),
  '{"common":50.00,"uncommon":28.00,"rare":14.00,"epic":6.00,"legendary":2.00}'::jsonb,
  'the disclosed base odds match the authoritative pool'
);
select is(
  (select sum(value::numeric) from jsonb_each_text(private.arpg_power_gacha_odds(0))),
  100::numeric,
  'the base probability distribution totals 100 percent'
);
select ok(
  (private.arpg_power_gacha_odds(9) ->> 'epic')::numeric >
    (private.arpg_power_gacha_odds(8) ->> 'epic')::numeric,
  'soft pity increases the epic chance after nine misses'
);
select is(
  (select sum(value::numeric) from jsonb_each_text(private.arpg_power_gacha_odds(18))),
  100::numeric,
  'soft pity preserves a complete probability distribution'
);
select is(
  private.arpg_power_gacha_odds(19),
  '{"common":0,"uncommon":0,"rare":0,"epic":75.00,"legendary":25.00}'::jsonb,
  'the twentieth roll guarantees epic or legendary'
);
select is(
  (select count(*) from private.arpg_power_gacha_catalog where enabled),
  37::bigint,
  'the gacha contains the 37 enabled power cards'
);
select is(
  (select card_rarity || ':' || tier from private.arpg_power_gacha_catalog
    where card_id = 'roc-horizon-storm'),
  'mythic:legendary'::text,
  'the mythic Roc card stays in the legendary odds band'
);

insert into auth.users (id, email) values
  ('81000000-0000-4000-8000-000000000008', 'gacha-owner@test.invalid'),
  ('82000000-0000-4000-8000-000000000008', 'gacha-poor@test.invalid');

select is(
  (select coins from public.profiles where id = '81000000-0000-4000-8000-000000000008'),
  500::bigint,
  'the gacha fixture begins with the normal starter balance'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000008', true);
select lives_ok(
  $$select public.get_arpg_power_gacha_state()$$,
  'an authenticated player can load gacha state'
);
select is(
  public.get_arpg_power_gacha_state() ->> 'pityMisses',
  '0'::text,
  'a new player starts with no pity misses'
);
select is(
  public.get_arpg_power_gacha_state() ->> 'legendFragments',
  '0'::text,
  'a new player starts with no legend fragments'
);
select lives_ok(
  $$select public.roll_arpg_power_gacha('81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000008')$$,
  'a funded player can complete a server-authoritative roll'
);
reset role;

select is(
  (select coins from public.profiles where id = '81000000-0000-4000-8000-000000000008'),
  420::bigint,
  'a successful roll debits exactly 80 coins'
);
select is(
  (select count(*) from private.arpg_power_gacha_rolls
    where user_id = '81000000-0000-4000-8000-000000000008'),
  1::bigint,
  'the server records exactly one roll'
);
select ok(
  exists (
    select 1
    from private.arpg_power_gacha_rolls as rolls
    join public.inventory_items as inventory
      on inventory.user_id = rolls.user_id and inventory.item_key = rolls.card_id
    where rolls.user_id = '81000000-0000-4000-8000-000000000008'
      and rolls.idempotency_key = '81000000-0000-4000-8000-000000000001'
      and not rolls.duplicate
      and inventory.quantity = 1
  ),
  'a new roll grants exactly the card stored in its result'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000008', true);
select is(
  public.roll_arpg_power_gacha('81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000008') ->> 'replayed',
  'true'::text,
  'retrying an idempotency key returns its original result'
);
reset role;
select is(
  (select coins from public.profiles where id = '81000000-0000-4000-8000-000000000008'),
  420::bigint,
  'a replay does not charge coins twice'
);

update public.profiles set coins = 333
where id = '81000000-0000-4000-8000-000000000008';
update private.arpg_power_gacha_state
set misses_since_epic = 4, legend_fragments = 12
where user_id = '81000000-0000-4000-8000-000000000008';
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000008', true);
select is(
  public.roll_arpg_power_gacha('81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000008') ->> 'coins',
  '333'::text,
  'an idempotent replay reports the current wallet balance'
);
select is(
  public.roll_arpg_power_gacha('81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000008') ->> 'pityMisses',
  '4'::text,
  'an idempotent replay reports current pity state'
);
select is(
  public.roll_arpg_power_gacha('81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000008') ->> 'legendFragments',
  '12'::text,
  'an idempotent replay reports the current fragment balance'
);
reset role;

insert into public.inventory_items (user_id, item_key, quantity, metadata)
select
  '81000000-0000-4000-8000-000000000008', catalog.card_id, 1,
  '{"source":"gacha-duplicate-fixture"}'::jsonb
from private.arpg_power_gacha_catalog as catalog
on conflict (user_id, item_key) do update
set quantity = greatest(public.inventory_items.quantity, excluded.quantity);

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000008', true);
select lives_ok(
  $$select public.roll_arpg_power_gacha('81000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000008')$$,
  'an owned pool can still be rolled safely'
);
reset role;
select ok(
  (select duplicate and fragments_awarded > 0
    from private.arpg_power_gacha_rolls
    where user_id = '81000000-0000-4000-8000-000000000008'
      and idempotency_key = '81000000-0000-4000-8000-000000000002'),
  'duplicate rolls grant the configured fragment compensation'
);
select ok(
  exists (
    select 1
    from private.arpg_power_gacha_rolls as rolls
    join public.inventory_items as inventory
      on inventory.user_id = rolls.user_id and inventory.item_key = rolls.card_id
    where rolls.user_id = '81000000-0000-4000-8000-000000000008'
      and rolls.idempotency_key = '81000000-0000-4000-8000-000000000002'
      and inventory.quantity = 1
  ),
  'a duplicate does not inflate card quantity'
);
select is(
  (select state.legend_fragments from private.arpg_power_gacha_state as state
    where state.user_id = '81000000-0000-4000-8000-000000000008'),
  (select 12 + rolls.fragments_awarded from private.arpg_power_gacha_rolls as rolls
    where rolls.user_id = '81000000-0000-4000-8000-000000000008'
      and rolls.idempotency_key = '81000000-0000-4000-8000-000000000002'),
  'duplicate fragments are persisted atomically'
);
select is(
  (select coins from public.profiles where id = '81000000-0000-4000-8000-000000000008'),
  253::bigint,
  'the duplicate roll still charges the fixed cost once'
);

update public.profiles set coins = 10
where id = '82000000-0000-4000-8000-000000000008';
set local role authenticated;
select set_config('request.jwt.claim.sub', '82000000-0000-4000-8000-000000000008', true);
select throws_ok(
  $$select public.roll_arpg_power_gacha('82000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000008')$$,
  '22023', null,
  'a player without enough coins cannot roll'
);
reset role;
select is(
  (select coins from public.profiles where id = '82000000-0000-4000-8000-000000000008'),
  10::bigint,
  'an insufficient-funds roll leaves the wallet unchanged'
);
select is(
  (select count(*) from private.arpg_power_gacha_rolls
    where user_id = '82000000-0000-4000-8000-000000000008'),
  0::bigint,
  'an insufficient-funds attempt is not recorded as a roll'
);

select * from finish(true);
rollback;
