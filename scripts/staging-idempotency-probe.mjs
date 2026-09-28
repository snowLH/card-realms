import { createClient } from "@supabase/supabase-js";

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "STAGING_TEST_A_EMAIL",
  "STAGING_TEST_A_PASSWORD",
  "STAGING_TEST_B_EMAIL",
  "STAGING_TEST_B_PASSWORD",
];

for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
}

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function login(email, password) {
  const supabase = client();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return supabase;
}

async function metrics(supabase) {
  const [{ data: snapshot, error: snapshotError }, { data: ledger, error: ledgerError }] =
    await Promise.all([
      supabase.rpc("get_my_player_snapshot"),
      supabase
        .from("reward_ledger")
        .select("id")
        .eq("source_type", "region_treasure")
        .eq("source_id", "roots"),
    ]);
  if (snapshotError) throw snapshotError;
  if (ledgerError) throw ledgerError;
  return {
    coins: snapshot.profile.coins,
    openedCount: snapshot.world.openedTreasures.filter((id) => id === "roots").length,
    fragments: snapshot.inventory.find((item) => item.itemKey === "bond-fragment")?.quantity ?? 0,
    treasuresFound: snapshot.exploration.find((entry) => entry.regionId === "roots")?.treasuresFound ?? 0,
    ledgerCount: ledger.length,
  };
}

function compact(result) {
  return {
    ok: !result.error,
    code: result.error?.code ?? null,
    message: result.error?.message ?? null,
  };
}

async function probe(label, supabase, concurrent) {
  const before = await metrics(supabase);
  const calls = concurrent
    ? await Promise.all([
      supabase.rpc("claim_region_treasure", { target_region_id: "roots" }),
      supabase.rpc("claim_region_treasure", { target_region_id: "roots" }),
    ])
    : [
      await supabase.rpc("claim_region_treasure", { target_region_id: "roots" }),
      await supabase.rpc("claim_region_treasure", { target_region_id: "roots" }),
    ];
  const after = await metrics(supabase);
  return {
    label,
    mode: concurrent ? "concurrent duplicate" : "sequential replay",
    calls: calls.map(compact),
    delta: {
      coins: after.coins - before.coins,
      openedCount: after.openedCount - before.openedCount,
      fragments: after.fragments - before.fragments,
      treasuresFound: after.treasuresFound - before.treasuresFound,
      ledgerCount: after.ledgerCount - before.ledgerCount,
    },
    after,
  };
}

const [a, b] = await Promise.all([
  login(process.env.STAGING_TEST_A_EMAIL, process.env.STAGING_TEST_A_PASSWORD),
  login(process.env.STAGING_TEST_B_EMAIL, process.env.STAGING_TEST_B_PASSWORD),
]);

const result = {
  sequential: await probe("A", a, false),
  concurrent: await probe("B", b, true),
};

await Promise.all([a.auth.signOut(), b.auth.signOut()]);
process.stdout.write(JSON.stringify(result, null, 2));
