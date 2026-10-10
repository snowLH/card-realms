import { NextResponse } from "next/server";
import { z } from "zod";
import {
  PLAYABLE_LEGEND_BY_ID,
  PLAYABLE_LEGEND_IDS,
} from "@/game/arpg/content/legends";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({ legendId: z.enum(PLAYABLE_LEGEND_IDS) }).strict();
const purchaseResultSchema = z.object({
  coins: z.number().int().nonnegative(),
  price: z.number().int().nonnegative(),
  legendId: z.enum(PLAYABLE_LEGEND_IDS),
  itemKey: z.string().regex(/^legend-[a-z0-9][a-z0-9_-]{1,79}$/),
  signatureAbilityIds: z.tuple([z.string().min(1), z.string().min(1)]),
  ownedAbilityIds: z.array(z.string().min(1)),
});

export async function POST(request: Request) {
  try {
    const { legendId } = requestSchema.parse(await request.json());
    const legend = PLAYABLE_LEGEND_BY_ID.get(legendId);
    if (legend?.unlockBossId) {
      return NextResponse.json({ error: "Esta Lenda é desbloqueada ao concluir sua purificação." }, { status: 409 });
    }
    if (!legend) {
      return NextResponse.json({ error: "Personagem desconhecido." }, { status: 400 });
    }
    if (legend.id === "curupira" && legend.price === 0) {
      return NextResponse.json({
        error: "Curupira já é o personagem inicial e não precisa ser comprado.",
      }, { status: 409 });
    }
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "A loja está indisponível no momento." }, { status: 503 });
    }

    const supabase = await createClient();
    const { data: claims, error: claimsError } = await supabase.auth.getClaims();
    if (claimsError || typeof claims?.claims?.sub !== "string") {
      return NextResponse.json({ error: "Entre na conta para comprar personagens." }, { status: 401 });
    }

    const { data, error } = await supabase.rpc("purchase_playable_legend", {
      target_legend_id: legendId,
    });
    if (error) {
      const status = error.code === "42501"
        ? 401
        : error.code === "23505" || error.code === "22023"
          ? 409
          : error.code === "P0002"
            ? 404
            : 503;
      const message = error.code === "23505"
        ? "Você já possui este personagem."
        : error.code === "22023" && error.message.includes("Moedas insuficientes")
          ? "Moedas insuficientes para comprar este personagem."
          : status === 401
            ? "Entre na conta para comprar personagens."
            : "Não foi possível concluir a compra do personagem.";
      return NextResponse.json({ error: message }, { status });
    }

    const result = purchaseResultSchema.safeParse(data);
    if (!result.success) {
      return NextResponse.json({ error: "A resposta da loja é incompatível." }, { status: 503 });
    }

    const purchased = result.data;
    if (
      purchased.legendId !== legend.id
      || purchased.itemKey !== `legend-${legend.id}`
      || purchased.price !== legend.price
      || purchased.signatureAbilityIds[0] !== legend.signatureAbilityIds[0]
      || purchased.signatureAbilityIds[1] !== legend.signatureAbilityIds[1]
    ) {
      return NextResponse.json({ error: "O catálogo da loja precisa ser sincronizado." }, { status: 503 });
    }

    return NextResponse.json({ ...purchased, authority: "server" });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? "O pedido de compra é inválido."
      : "Não foi possível processar a compra.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
