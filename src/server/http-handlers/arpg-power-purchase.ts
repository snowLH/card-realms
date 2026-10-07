import { NextResponse } from "next/server";
import { z } from "zod";
import { ARPG_ABILITY_CARD_BY_ID, CURRENT_ARPG_ABILITY_CARD_IDS } from "@/game/arpg/content/ability-cards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({ cardId: z.string().trim().min(1).max(80) }).strict();

export async function POST(request: Request) {
  try {
    const { cardId } = requestSchema.parse(await request.json());
    const card = ARPG_ABILITY_CARD_BY_ID.get(cardId);
    if (!card || !CURRENT_ARPG_ABILITY_CARD_IDS.has(cardId)) {
      return NextResponse.json({ error: "Carta de poder desconhecida." }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Os poderes acompanham a Lenda; compras avulsas estão desativadas." },
      { status: 409 },
    );
  } catch (error) {
    const message = error instanceof z.ZodError
      ? "O pedido de compra é inválido."
      : "Não foi possível processar a compra.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
