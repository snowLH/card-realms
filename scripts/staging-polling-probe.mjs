import { createClient } from "@supabase/supabase-js";

const required = [
  "APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "STAGING_TEST_A_EMAIL",
  "STAGING_TEST_A_PASSWORD",
  "STAGING_TEST_B_EMAIL",
  "STAGING_TEST_B_PASSWORD",
  "TEST_PLAYER_A_ID",
  "TEST_PLAYER_B_ID",
];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
}

const authCookieName = "sb-ywawwhnsvpfeppfcuwzg-auth-token";
const players = [
  {
    label: "A",
    id: process.env.TEST_PLAYER_A_ID,
    email: process.env.STAGING_TEST_A_EMAIL,
    password: process.env.STAGING_TEST_A_PASSWORD,
  },
  {
    label: "B",
    id: process.env.TEST_PLAYER_B_ID,
    email: process.env.STAGING_TEST_B_EMAIL,
    password: process.env.STAGING_TEST_B_PASSWORD,
  },
];

for (const player of players) {
  player.client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data, error } = await player.client.auth.signInWithPassword({
    email: player.email,
    password: player.password,
  });
  if (error || !data.session) throw error ?? new Error(`No session for ${player.label}`);
  player.cookie = `base64-${Buffer.from(JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    expires_in: data.session.expires_in,
    token_type: data.session.token_type,
  }), "utf8").toString("base64url")}`;
}

async function request(player, path, init = {}) {
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
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} failed (${response.status}): ${payload.error}`);
  }
  return payload;
}

await request(players[0], "/api/pvp/challenges", {
  method: "POST",
  body: JSON.stringify({ addresseeId: players[1].id }),
});
const inbox = await request(players[1], "/api/pvp/challenges");
const pending = inbox.challenges.find(
  (challenge) =>
    challenge.requester_id === players[0].id &&
    challenge.addressee_id === players[1].id &&
    challenge.status === "pending",
);
if (!pending) throw new Error("B did not receive the polling probe challenge.");

const accepted = await request(players[1], "/api/pvp/challenges", {
  method: "PATCH",
  body: JSON.stringify({ challengeId: pending.id, response: "accept" }),
});
const battleId = accepted.battle?.battleId;
if (!battleId) throw new Error("The polling probe did not create a battle.");

const initial = await request(players[0], `/api/pvp/battles/${battleId}`);
const actor = players.find((player) => player.id === initial.state.turn.sideId);
const observer = players.find((player) => player.id !== initial.state.turn.sideId);
if (!actor || !observer) throw new Error("Invalid polling probe participants.");

await request(actor, "/api/pvp/actions", {
  method: "POST",
  body: JSON.stringify({
    action: "pass",
    actionId: crypto.randomUUID(),
    battleId,
    expectedVersion: initial.version,
  }),
});

await new Promise((resolve) => setTimeout(resolve, 5_250));
const observed = await request(observer, `/api/pvp/battles/${battleId}`);

await Promise.all(players.map((player) => player.client.auth.signOut()));
process.stdout.write(JSON.stringify({
  battleId,
  challengeId: pending.id,
  actor: actor.label,
  observer: observer.label,
  initialVersion: initial.version,
  observedVersion: observed.version,
  observedTurnOwner: observed.state.turn.sideId,
  pollingDelayMs: 5_250,
  advanced: observed.version > initial.version,
}, null, 2));
