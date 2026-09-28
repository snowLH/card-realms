import { createClient } from "@supabase/supabase-js";

const required = [
  "APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "STAGING_TEST_A_EMAIL",
  "STAGING_TEST_A_PASSWORD",
  "STAGING_TEST_B_EMAIL",
  "STAGING_TEST_B_PASSWORD",
  "TEST_BATTLE_ID",
  "TEST_PLAYER_A_ID",
  "TEST_PLAYER_B_ID",
];

for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

const playerA = {
  id: process.env.TEST_PLAYER_A_ID,
  email: process.env.STAGING_TEST_A_EMAIL,
  password: process.env.STAGING_TEST_A_PASSWORD,
};
const playerB = {
  id: process.env.TEST_PLAYER_B_ID,
  email: process.env.STAGING_TEST_B_EMAIL,
  password: process.env.STAGING_TEST_B_PASSWORD,
};
const players = new Map([[playerA.id, playerA], [playerB.id, playerB]]);
const authCookieName = "sb-ywawwhnsvpfeppfcuwzg-auth-token";
const elementByCreature = {
  boitata: "fire",
  iara: "water",
  curupira: "nature",
  "saci-perere": "storm",
  "black-shuck": "spirit",
  "boto-cor-de-rosa": "water",
};

function newClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function signIn(player) {
  player.client = newClient();
  const { data, error } = await player.client.auth.signInWithPassword({
    email: player.email,
    password: player.password,
  });
  if (error || !data.session) {
    throw error ?? new Error(`No session returned for ${player.email}`);
  }
  player.session = data.session;
  player.cookie = `base64-${Buffer.from(JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    expires_in: data.session.expires_in,
    token_type: data.session.token_type,
  }), "utf8").toString("base64url")}`;
}

async function appRequest(player, path, init = {}) {
  const response = await fetch(new URL(path, process.env.APP_URL), {
    ...init,
    headers: {
      accept: "application/json",
      cookie: `${authCookieName}=${player.cookie}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const payload = await response.json();
  return { response, payload };
}

async function loadBattle(player) {
  const result = await appRequest(player, `/api/pvp/battles/${process.env.TEST_BATTLE_ID}`);
  if (!result.response.ok) {
    throw new Error(`Battle load failed (${result.response.status}): ${result.payload.error}`);
  }
  return result.payload;
}

async function act(player, payload, expectedVersion) {
  const result = await appRequest(player, "/api/pvp/actions", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      battleId: process.env.TEST_BATTLE_ID,
      expectedVersion,
      actionId: crypto.randomUUID(),
    }),
  });
  if (!result.response.ok) {
    throw new Error(`Battle action failed (${result.response.status}): ${result.payload.error}`);
  }
  return result.payload;
}

await Promise.all([signIn(playerA), signIn(playerB)]);

let actions = 0;
for (; actions < 300; actions += 1) {
  const observer = actions % 2 === 0 ? playerA : playerB;
  let battle = await loadBattle(observer);
  if (battle.state.status === "finished") break;

  const actor = players.get(battle.state.turn.sideId);
  if (!actor) throw new Error("The server selected a turn owner outside the two test accounts.");
  battle = await loadBattle(actor);
  let side = battle.state.sides.find((candidate) => candidate.id === actor.id);

  if (battle.state.turn.phase === "forced_switch") {
    const nextIndex = side.team.findIndex(
      (creature, index) => index !== side.activeIndex && !creature.defeated,
    );
    battle = await act(actor, { action: "switch", creatureIndex: nextIndex }, battle.version);
    side = battle.state.sides.find((candidate) => candidate.id === actor.id);
  }

  let active = side.team[side.activeIndex];
  const element = elementByCreature[active.catalogId];
  if (!element) throw new Error(`No element mapping for ${active.catalogId}`);

  while (side.attachmentsRemaining > 0) {
    const card = side.energyHand.find((candidate) => candidate.element === element);
    if (!card) break;
    battle = await act(actor, {
      action: "attach",
      creatureIndex: side.activeIndex,
      cardId: card.id,
    }, battle.version);
    side = battle.state.sides.find((candidate) => candidate.id === actor.id);
  }

  active = side.team[side.activeIndex];
  const matchingEnergy = active.attachedEnergy.filter(
    (card) => card.element === element,
  ).length;
  const attackLevel = Math.min(3, matchingEnergy);
  battle = attackLevel > 0
    ? await act(actor, {
      action: "attack",
      attackId: `${active.catalogId}-${attackLevel}`,
    }, battle.version)
    : await act(actor, { action: "pass" }, battle.version);

  if (battle.state.status === "finished") break;
}

const final = await loadBattle(playerA);
if (final.state.status !== "finished") {
  throw new Error(`Battle did not finish within the action limit (version ${final.version}).`);
}

const eventCounts = final.state.log.reduce((counts, event) => {
  counts[event.kind] = (counts[event.kind] ?? 0) + 1;
  return counts;
}, {});

const resultChecks = {};
for (const player of [playerA, playerB]) {
  const { data, error } = await player.client
    .from("battle_results")
    .select("battle_id,user_id,opponent_id,outcome,finished_at")
    .eq("battle_id", process.env.TEST_BATTLE_ID);
  if (error) throw error;
  resultChecks[player.id] = data;
}

for (const player of [playerA, playerB]) {
  await player.client.auth.signOut();
  await signIn(player);
}

const reloginChecks = {};
for (const player of [playerA, playerB]) {
  const { data, error } = await player.client.rpc("get_my_player_snapshot");
  if (error) throw error;
  reloginChecks[player.id] = {
    profileId: data?.profile?.id ?? null,
    collectionCount: data?.collection?.length ?? 0,
    activeTeamCount: data?.teams?.find((team) => team.isActive)?.members?.length ?? 0,
    battleHistoryCount: data?.battleHistory?.length ?? 0,
    currentRegionId: data?.world?.currentRegionId ?? null,
    openedTreasuresCount: data?.world?.openedTreasures?.length ?? 0,
    energyTypeCount: Object.keys(data?.energy ?? {}).length,
    inventoryCount: data?.inventory?.length ?? 0,
    missionCount: data?.missions?.length ?? 0,
    achievementCount: data?.achievements?.length ?? 0,
    hasHouse: Boolean(data?.house),
  };
}

process.stdout.write(JSON.stringify({
  battleId: process.env.TEST_BATTLE_ID,
  status: final.state.status,
  winnerId: final.state.winnerId,
  version: final.version,
  turnNumber: final.state.turn.number,
  actions,
  eventCounts,
  resultChecks: Object.fromEntries(
    Object.entries(resultChecks).map(([id, rows]) => [
      id,
      rows.map((row) => ({ outcome: row.outcome, persisted: Boolean(row.finished_at) })),
    ]),
  ),
  reloginChecks,
}, null, 2));
