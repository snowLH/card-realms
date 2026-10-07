import { NextResponse } from "next/server";
import { z } from "zod";
import { PLAYABLE_LEGEND_BY_ID } from "@/game/arpg/content/legends";
import { DEFAULT_AVATAR_CONFIG, AvatarConfigSchema } from "@/game/save/local-progress";
import { ArpgLoadoutSchema } from "@/game/arpg/domain/loadout-schema";
import { DEFAULT_ARPG_LOADOUT } from "@/game/arpg/content/mata-encantada";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authenticatedClient() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  return !error && typeof data?.claims?.sub === "string"
    ? { supabase, playerId: data.claims.sub }
    : null;
}

function isLegendPowerPair(selected: readonly string[], expected: readonly string[]) {
  return selected.length === 2
    && new Set(selected).size === 2
    && selected.every((id) => expected.includes(id));
}

export async function PATCH(request: Request) {
  try {
    const auth = await authenticatedClient();
    if (!auth) {
      return NextResponse.json({ error: "Entre na conta para salvar o Arsenal." }, { status: 401 });
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "O loadout ARPG enviado é inválido." }, { status: 400 });
    }
    const submitted = body as Record<string, unknown>;
    const loadout = ArpgLoadoutSchema.parse({
      ...submitted,
      armorId: DEFAULT_ARPG_LOADOUT.armorId,
    });
    if (new Set(loadout.abilityIds).size !== 2) {
      return NextResponse.json({ error: "O loadout contém itens repetidos." }, { status: 400 });
    }

    const { data: profile, error: profileError } = await auth.supabase
      .from("profiles")
      .select("avatar_config")
      .eq("id", auth.playerId)
      .maybeSingle();
    if (profileError) {
      return NextResponse.json({ error: "Não foi possível carregar a Lenda ativa." }, { status: 503 });
    }
    if (!profile) {
      return NextResponse.json({ error: "O perfil do jogador não foi encontrado." }, { status: 404 });
    }

    const avatar = AvatarConfigSchema.safeParse(profile.avatar_config ?? DEFAULT_AVATAR_CONFIG);
    const legend = avatar.success ? PLAYABLE_LEGEND_BY_ID.get(avatar.data.legendId) : undefined;
    if (!legend) {
      return NextResponse.json({ error: "A Lenda ativa do perfil é inválida." }, { status: 409 });
    }
    if (!isLegendPowerPair(loadout.abilityIds, legend.signatureAbilityIds)) {
      return NextResponse.json(
        { error: `Equipe exatamente os dois poderes de ${legend.name} no Arsenal.` },
        { status: 409 },
      );
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
