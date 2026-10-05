begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

select ok(
  has_function_privilege('authenticated', 'public.purchase_arpg_merchant_item(text)', 'execute'),
  'authenticated can use the narrow merchant purchase RPC'
);

insert into auth.users (id, email) values
  ('40000000-0000-4000-8000-000000000004', 'merchant-owner@test.invalid'),
  ('50000000-0000-4000-8000-000000000005', 'merchant-poor@test.invalid');
update public.profiles set coins = 500 where id = '40000000-0000-4000-8000-000000000004';
update public.profiles set coins = 10 where id = '50000000-0000-4000-8000-000000000005';

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000004', true);

select throws_ok(
  $$select public.purchase_arpg_merchant_item('forest-bow')$$,
  '22023',
  null,
  'the legacy merchant RPC no longer sells a weapon'
);
select throws_ok(
  $$select public.purchase_arpg_merchant_item('ritual-cloak')$$,
  '22023',
  null,
  'the legacy merchant RPC no longer sells armor'
);
select lives_ok(
  $$select public.purchase_arpg_merchant_item('refuge-furniture-books')$$,
  'a player can buy a catalogued Refuge cosmetic'
);
select is(
  (select coins from public.profiles where id = auth.uid()),
  455::bigint,
  'the server deducts the fixed cosmetic price'
);
select results_eq(
  $$select item_key, quantity from public.inventory_items where user_id = auth.uid() order by item_key$$,
  $$values ('refuge-furniture-books'::text, 1::integer)$$,
  'a cosmetic purchase grants exactly one inventory item'
);
select throws_ok(
  $$select public.purchase_arpg_merchant_item('refuge-furniture-books')$$,
  '23505',
  null,
  'a player cannot purchase a unique item twice'
);
select throws_ok(
  $$select public.purchase_arpg_merchant_item('invented-weapon')$$,
  '22023',
  null,
  'the RPC rejects items outside the server catalog'
);

select set_config('request.jwt.claim.sub', '50000000-0000-4000-8000-000000000005', true);
select throws_ok(
  $$select public.purchase_arpg_merchant_item('refuge-furniture-books')$$,
  '22023',
  null,
  'a player without enough coins cannot buy a cosmetic'
);
select is(
  (select coins from public.profiles where id = auth.uid()),
  10::bigint,
  'a rejected purchase leaves the wallet unchanged'
);

select * from finish();
rollback;
