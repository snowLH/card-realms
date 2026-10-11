import { NextResponse } from "next/server";
import { DEFAULT_PLAYER_PREFERENCES, PlayerPreferencesSchema, PreferencesMutationSchema, PreferencesReceiptSchema } from "@/lib/player-preferences";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured, isSupabaseAdminConfigured } from "@/lib/supabase/env";

const headers = { "cache-control": "private, no-store" };
async function authenticate() {
  if (!isSupabaseConfigured()) return null;
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  const id = data?.claims?.sub;
  return !error && typeof id === "string" ? { client, id } : null;
}
export async function GET() {
  try {
    const auth = await authenticate();
    if (!auth) return NextResponse.json({ error: "Entre para carregar suas preferências." }, { status: 401, headers });
    const { data, error } = await auth.client.from("player_preferences")
      .select("sound_enabled,revision,updated_at").eq("user_id", auth.id).maybeSingle();
    if (error) throw error;
    const snapshot = data ? PlayerPreferencesSchema.parse({ soundEnabled: data.sound_enabled,
      revision: Number(data.revision), updatedAt: data.updated_at }) : DEFAULT_PLAYER_PREFERENCES;
    return NextResponse.json({ snapshot, authority: "supabase" }, { headers });
  } catch {
    return NextResponse.json({ error: "As preferências deste aparelho foram preservadas." }, { status: 503, headers });
  }
}
export async function PATCH(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Origem inválida." }, { status: 403, headers });
    const parsed = PreferencesMutationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Preferência inválida." }, { status: 400, headers });
    const auth = await authenticate();
    if (!auth) return NextResponse.json({ error: "Entre para salvar suas preferências." }, { status: 401, headers });
    if (!isSupabaseAdminConfigured()) throw new Error("Authority unavailable");
    // The account comes exclusively from verified claims, never from request JSON.
    const { data, error } = await createAdminClient().rpc("update_player_preferences", {
      target_user_id: auth.id, expected_revision: parsed.data.expectedRevision, target_sound_enabled: parsed.data.soundEnabled,
    });
    if (error) throw error;
    const receipt = PreferencesReceiptSchema.parse(data);
    return NextResponse.json({ ...receipt, authority: "supabase" }, { status: receipt.confirmed ? 200 : 409, headers });
  } catch {
    return NextResponse.json({ error: "Não foi possível sincronizar o som. Sua escolha foi preservada neste aparelho." }, { status: 503, headers });
  }
}
