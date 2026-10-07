"use client";

import { Button } from "@/components/ui/button";
import { PvpRealtimeArena } from "./pvp-realtime-arena";

type PvpSession = { battleId: string; playerId: string };

type BattleArenaProps = {
  open: boolean;
  onClose: () => void;
  pvp?: PvpSession;
};

export function BattleArena({ open, onClose, pvp }: BattleArenaProps) {
  if (pvp) {
    return <PvpRealtimeArena key={pvp.battleId} open={open} onClose={onClose} pvp={pvp} />;
  }
  if (!open) return null;

  return (
    <div
      className="battle-screen battle-screen--loading"
      role="dialog"
      aria-modal="true"
      aria-label="Combate indisponível"
    >
      <strong>Escolha um encontro no Atlas</strong>
      <p>Encontros contra criaturas e viajantes abrem uma expedição de ação com sua Lenda e os dois ataques de assinatura.</p>
      <Button variant="secondary" onClick={onClose}>Voltar</Button>
    </div>
  );
}
