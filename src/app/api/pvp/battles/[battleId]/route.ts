import { NextResponse } from "next/server";
import { BattleStateSchema } from "@/game/battle";
import { visiblePvpState } from "@/game/pvp";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ battleId: string }> },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  }
  const { battleId } = await context.params;
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || typeof claimsData?.claims?.sub !== "string") {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("battles")
    .select("id,state,version,status,turn_user_id,winner_id,updated_at")
    .eq("id", battleId)
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "Batalha PVP não encontrada." }, { status: 404 });
  }
  const parsed = BattleStateSchema.safeParse(data.state);
  if (!parsed.success || parsed.data.id !== battleId || parsed.data.mode !== "pvp") {
    return NextResponse.json({ error: "Estado persistido de batalha incompatível." }, { status: 500 });
  }
  const visible = visiblePvpState(parsed.data, claimsData.claims.sub);
  return NextResponse.json({
    state: visible.state,
    events: [],
    version: data.version,
    authority: "server",
    hidden: visible.hidden,
  });
}
