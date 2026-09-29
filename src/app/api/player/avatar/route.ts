import { NextResponse } from "next/server";
import { z } from "zod";
import { AvatarConfigSchema } from "@/game/save/local-progress";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
    }
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    if (claimsError || typeof claimsData?.claims?.sub !== "string") {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }
    const config = AvatarConfigSchema.parse(await request.json());
    const { data, error } = await supabase.rpc("save_avatar_config", {
      target_config: config,
    });
    if (error) {
      return NextResponse.json({ error: "O personagem não pôde ser salvo." }, { status: 409 });
    }
    return NextResponse.json({ avatar: data, authority: "supabase" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof z.ZodError ? "A aparência escolhida é inválida." : "Não foi possível salvar o personagem." },
      { status: 400 },
    );
  }
}
