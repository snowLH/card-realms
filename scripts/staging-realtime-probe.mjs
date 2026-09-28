import { createClient } from "@supabase/supabase-js";

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "STAGING_TEST_EMAIL",
  "STAGING_TEST_PASSWORD",
  "TEST_BATTLE_ID",
];

for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

const { data, error } = await supabase.auth.signInWithPassword({
  email: process.env.STAGING_TEST_EMAIL,
  password: process.env.STAGING_TEST_PASSWORD,
});

if (error || !data.session) {
  throw error ?? new Error("The staging test account did not return a session.");
}

await supabase.realtime.setAuth(data.session.access_token);

async function subscribe(topic) {
  return new Promise((resolve) => {
    let finished = false;
    let timer;
    const channel = supabase.channel(topic, {
      config: {
        private: true,
        broadcast: { ack: true },
      },
    });

    const finish = async (status, publishStatus = null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      await supabase.removeChannel(channel);
      resolve({ status, publishStatus });
    };

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        const publishStatus = await channel.send({
          type: "broadcast",
          event: "unauthorized-client-probe",
          payload: { source: "staging-realtime-probe" },
        });
        await finish(status, publishStatus);
      } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
        await finish(status);
      }
    });

    timer = setTimeout(() => void finish("TIMEOUT"), 12_000);
  });
}

const valid = await subscribe(`pvp:battle:${process.env.TEST_BATTLE_ID}`);
const unrelated = await subscribe("pvp:battle:00000000-0000-4000-8000-000000000099");

await supabase.auth.signOut();
await supabase.realtime.disconnect();

process.stdout.write(JSON.stringify({
  validBattleTopic: valid,
  unrelatedBattleTopic: unrelated,
}, null, 2));
