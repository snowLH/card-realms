begin;

create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('86000000-0000-4000-8000-000000000008', 'power-shop-zero-row@test.invalid');
update public.profiles set coins = 500
where id = '86000000-0000-4000-8000-000000000008';
insert into public.inventory_items (user_id, item_key, quantity, metadata)
values (
  '86000000-0000-4000-8000-000000000008',
  'saci-whirlwind',
  0,
  '{"legacy":"preserve this row"}'::jsonb
);

select ok(
  has_function_privilege('authenticated', 'public.purchase_arpg_power_card(text)', 'execute'),
  'authenticated players retain the public lobby purchase RPC'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '86000000-0000-4000-8000-000000000008', true);

select lives_ok(
  $$select public.purchase_arpg_power_card('saci-whirlwind')$$,
  'a lobby purchase reactivates an existing zero-quantity inventory row'
);
select is(
  (select coins from public.profiles where id = auth.uid()),
  380::bigint,
  'the successful zero-row purchase charges the uncommon price once'
);
select is(
  (select quantity from public.inventory_items
    where user_id = auth.uid() and item_key = 'saci-whirlwind'),
  1,
  'the zero-quantity row becomes one owned card'
);
select ok(
  exists (
    select 1 from public.inventory_items
    where user_id = auth.uid()
      and item_key = 'saci-whirlwind'
      and metadata ->> 'legacy' = 'preserve this row'
      and metadata ->> 'source' = 'arpg_power_shop'
  ),
  'the upsert preserves legacy metadata and records the lobby purchase'
);
select throws_ok(
  $$select public.purchase_arpg_power_card('saci-whirlwind')$$,
  '23505', null,
  'the repaired row follows the normal duplicate purchase guard'
);
select is(
  (select coins from public.profiles where id = auth.uid()),
  380::bigint,
  'a duplicate attempt does not charge the account again'
);

reset role;
select * from finish(true);
rollback;
