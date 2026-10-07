"use client";

import { Sparkles, Swords } from "lucide-react";
import { ARPG_WEAPON_BY_ID } from "@/game/arpg/content/equipment";
import type { ArpgHudState, ArpgWeaponDefinition } from "@/game/arpg/domain/types";
import { ArpgBridge } from "@/game/arpg/runtime/bridge";
import { ArpgItemPixelIcon } from "./item-pixel-icon";

const rarityLabel: Record<string, string> = {
  common: "Comum",
  uncommon: "Incomum",
  rare: "Raro",
  epic: "Épico",
  legendary: "Lendário",
  mythic: "Mítico",
};

const weaponKindLabel: Record<ArpgWeaponDefinition["kind"], string> = {
  sword: "Espada",
  bow: "Arco",
  staff: "Cajado",
};

const elementLabel: Record<string, string> = {
  nature: "Natureza",
  spirit: "Espírito",
  water: "Água",
  fire: "Fogo",
  earth: "Terra",
  shadow: "Sombra",
};

function rarityName(rarity: string) {
  return rarityLabel[rarity] ?? rarity;
}

function WeaponDetails({ item }: { item: ArpgWeaponDefinition }) {
  return <>
    <span>{weaponKindLabel[item.kind]} · {elementLabel[item.element] ?? item.element}</span>
    <small>{item.damage} dano · {item.attackRateMs} ms · alcance {item.range}</small>
    <span>{item.description}</span>
    {item.effect ? <em><Sparkles /> {item.effect.label}: {item.effect.description}</em> : null}
  </>;
}

export function LootChoice({ state, bridge }: { state: ArpgHudState | null; bridge: ArpgBridge }) {
  const pending = state?.pendingLoot;
  if (!pending || pending.kind !== "weapon") return null;

  const weaponSlots = state!.weaponSlots ?? { A: state!.weaponId, B: null, active: "A" as const };
  const current = ARPG_WEAPON_BY_ID.get(weaponSlots[weaponSlots.active] ?? state!.weaponId);
  const found = ARPG_WEAPON_BY_ID.get(pending.id);
  if (!current || !found) return null;

  return (
    <div
      className="arpg-loot-choice arpg-dungeon-reward"
      role="dialog"
      aria-modal="true"
      aria-labelledby="arpg-loot-choice-title"
      aria-describedby="arpg-loot-choice-description"
      data-reward-kind={pending.kind}
      data-reward-rarity={found.rarity}
    >
      <div className="arpg-loot-choice__panel">
        <header>
          <small>RECOMPENSA DA DUNGEON · ARMA</small>
          <strong id="arpg-loot-choice-title"><Swords aria-hidden="true" /> {pending.label}</strong>
          <span id="arpg-loot-choice-description">
            Arma encontrada no baú. Escolha em qual espaço equipá-la; seus dois poderes principais continuam os mesmos.
          </span>
        </header>
        <div className="arpg-loot-choice__slots" aria-label="Armas carregadas">
          <span className={weaponSlots.active === "A" ? "is-active" : undefined}><b>A</b> {ARPG_WEAPON_BY_ID.get(weaponSlots.A)?.name ?? "Vazio"}</span>
          <span className={weaponSlots.active === "B" ? "is-active" : undefined}><b>B</b> {weaponSlots.B ? ARPG_WEAPON_BY_ID.get(weaponSlots.B)?.name ?? "Vazio" : "Vazio · arma encontrada irá para cá"}</span>
        </div>
        <div className="arpg-loot-choice__compare">
          <article className="is-current" aria-label={`Arma ativa: ${current.name}`}>
            <small>SLOT {weaponSlots.active} ATIVO</small>
            <ArpgItemPixelIcon item={current.kind} size={58} />
            <strong>{current.name}</strong>
            <b>Arma · {rarityName(current.rarity)}</b>
            <WeaponDetails item={current} />
          </article>
          <article className="is-found" aria-label={`Arma encontrada na dungeon: ${found.name}`}>
            <small>ACHADO NO BAÚ</small>
            <ArpgItemPixelIcon item={found.kind} size={58} />
            <strong>{found.name}</strong>
            <b>Arma · {rarityName(found.rarity)}</b>
            <WeaponDetails item={found} />
          </article>
        </div>
        <div className="arpg-loot-choice__actions">
          <button type="button" onClick={() => bridge.queueLootDecision("keep")}>Manter armas</button>
          {weaponSlots.B === null ? (
            <button type="button" className="is-primary" onClick={() => bridge.queueLootDecision("equip")}>Equipar no slot B</button>
          ) : (
            <>
              <button type="button" className="is-primary" onClick={() => bridge.queueLootDecision("replace-a")}>Substituir slot A</button>
              <button type="button" className="is-primary" onClick={() => bridge.queueLootDecision("replace-b")}>Substituir slot B</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
