import { NextResponse } from "next/server";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { ArpgRaidRoomAccessError } from "@/server/raid/arpg-rooms";
import { startArpgRaidRoom } from "@/server/raid/arpg-setup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  if (!isSupabaseConfigured() || !isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const actorId = data?.claims?.sub;
  if (error || typeof actorId !== "string") {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  try {
    const result = await startArpgRaidRoom((await context.params).roomId, actorId);
    return NextResponse.json({ result, authority: "server", gameplayMode: "arpg" });
  } catch (caught) {
    if (caught instanceof ArpgRaidRoomAccessError) {
      return NextResponse.json({ error: caught.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Não foi possível iniciar a Raid ARPG." }, { status: 500 });
  }
}
