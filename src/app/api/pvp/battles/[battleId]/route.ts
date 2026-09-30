import { NextResponse } from "next/server";
import { visiblePvpState } from "@/game/pvp";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { loadAuthoritativePvpBattle, PvpBattleAccessError } from "@/server/pvp/battles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ battleId: string }> },
) {
  if (!isSupabaseConfigured() || !isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  }
  const { battleId } = await context.params;
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || typeof claimsData?.claims?.sub !== "string") {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  try {
    const { battle, boardId } = await loadAuthoritativePvpBattle(battleId, claimsData.claims.sub);
    const visible = visiblePvpState(battle.state, claimsData.claims.sub);
    return NextResponse.json({
      state: visible.state,
      events: [],
      version: battle.version,
      boardId,
      authority: "server",
      hidden: visible.hidden,
    });
  } catch (error) {
    if (error instanceof PvpBattleAccessError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Estado persistido de batalha incompatível." }, { status: 500 });
  }
}
