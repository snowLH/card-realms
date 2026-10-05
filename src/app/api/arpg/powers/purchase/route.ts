import { NextResponse } from "next/server";
import { z } from "zod";
import { ARPG_ABILITY_CARD_BY_ID } from "@/game/arpg/content/ability-cards";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({ cardId: z.string().trim().min(1).max(80) }).strict();
const purchaseResultSchema = z.object({
  coins: z.number().int().nonnegative(),
  ownedAbilityIds: z.array(z.string().min(1)),
});

export async function POST(request: Request) {
  try {
    const { cardId } = requestSchema.parse(await request.json());
    const card = ARPG_ABILITY_CARD_BY_ID.get(cardId);
    if (!card) {
      return NextResponse.json({ error: "Carta de poder desconhecida." }, { status: 400 });
    }
    if (!card.purchasable || card.purchasePrice === null) {
      return NextResponse.json({ error: "Esta carta não está à venda." }, { status: 409 });
    }
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "A loja está indisponível no momento." }, { status: 503 });
    }

    const supabase = await createClient();
    const { data: claims, error: claimsError } = await supabase.auth.getClaims();
    if (claimsError || typeof claims?.claims?.sub !== "string") {
      return NextResponse.json({ error: "Entre na conta para comprar cartas." }, { status: 401 });
    }

    const { data, error } = await supabase.rpc("purchase_arpg_power_card", {
      target_card_id: cardId,
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
        ? "Você já possui esta carta."
        : error.code === "22023"
          ? error.message || "Não foi possível concluir a compra."
          : status === 401
            ? "Entre na conta para comprar cartas."
            : "Não foi possível concluir a compra da carta.";
      return NextResponse.json({ error: message }, { status });
    }

    const result = purchaseResultSchema.safeParse(data);
    if (!result.success) {
      return NextResponse.json({ error: "A resposta da loja é incompatível." }, { status: 503 });
    }

    return NextResponse.json({ ...result.data, authority: "server" });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? "O pedido de compra é inválido."
      : "Não foi possível processar a compra.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
