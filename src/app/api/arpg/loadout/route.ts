import { NextResponse } from "next/server";
import { z } from "zod";
import { ArpgLoadoutSchema } from "@/game/arpg/domain/loadout-schema";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authenticatedClient() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  return !error && typeof data?.claims?.sub === "string" ? { supabase } : null;
}

export async function PATCH(request: Request) {
  try {
    const auth = await authenticatedClient();
    if (!auth) {
      return NextResponse.json({ error: "Entre na conta para salvar o Arsenal." }, { status: 401 });
    }

    const loadout = ArpgLoadoutSchema.parse(await request.json());
    if (new Set(loadout.abilityIds).size !== 2) {
      return NextResponse.json({ error: "O loadout contém itens repetidos." }, { status: 400 });
    }

    const { data, error } = await auth.supabase.rpc("save_arpg_loadout", {
      target_weapon_id: loadout.weaponId,
      target_armor_id: loadout.armorId,
      target_relic_id: loadout.relicId,
      target_ability_ids: loadout.abilityIds,
    });
    if (error) {
      const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 400;
      return NextResponse.json(
        { error: error.message || "Não foi possível salvar o Arsenal." },
        { status },
      );
    }

    return NextResponse.json({ loadout: data, authority: "server" });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? "O loadout ARPG enviado é inválido."
      : error instanceof Error
        ? error.message
        : "Não foi possível salvar o Arsenal.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
