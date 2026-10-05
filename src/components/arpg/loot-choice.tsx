"use client";

import { Shield, Sparkles, Swords } from "lucide-react";
import { ARPG_ARMOR_BY_ID, ARPG_WEAPON_BY_ID } from "@/game/arpg/content/equipment";
import type { ArpgArmorDefinition, ArpgHudState, ArpgWeaponDefinition } from "@/game/arpg/domain/types";
import { ArpgBridge } from "@/game/arpg/runtime/bridge";

const rarityLabel: Record<string, string> = {
  common: "Comum",
  uncommon: "Incomum",
  rare: "Raro",
  epic: "Épico",
  legendary: "Lendário",
  mythic: "Mítico",
};

function WeaponDetails({ item }: { item: ArpgWeaponDefinition }) {
  return <>
    <span>{item.damage} dano · {item.kind}</span>
    <small>{item.attackRateMs} ms · alcance {item.range}</small>
    {item.effect ? <em><Sparkles /> {item.effect.label}: {item.effect.description}</em> : null}
  </>;
}

function ArmorDetails({ item }: { item: ArpgArmorDefinition }) {
  return <>
    <span>+{item.maxHpBonus} HP · +{item.defenseBonus} defesa</span>
    <small>{item.moveSpeedBonus >= 0 ? "+" : ""}{item.moveSpeedBonus} velocidade</small>
    {item.effect ? <em><Sparkles /> {item.effect.label}: {item.effect.description}</em> : null}
  </>;
}
export function LootChoice({ state, bridge }: { state: ArpgHudState | null; bridge: ArpgBridge }) {
  const pending = state?.pendingLoot;
  if (!pending || (pending.kind !== "weapon" && pending.kind !== "armor")) return null;

  const weaponMode = pending.kind === "weapon";
  const current = weaponMode
    ? ARPG_WEAPON_BY_ID.get(state!.weaponId)
    : ARPG_ARMOR_BY_ID.get(state!.armorId);
  const found = weaponMode
    ? ARPG_WEAPON_BY_ID.get(pending.id)
    : ARPG_ARMOR_BY_ID.get(pending.id);
  if (!current || !found) return null;

  const Icon = weaponMode ? Swords : Shield;
  return (
    <div className="arpg-loot-choice" role="dialog" aria-modal="true" aria-label="Escolha de equipamento">
      <div className="arpg-loot-choice__panel">
        <header>
          <small>BAÚ ABERTO</small>
          <strong><Icon /> {pending.label}</strong>
          <span>O item foi encontrado e será guardado. Escolha se quer equipá-lo agora.</span>
        </header>
        <div className="arpg-loot-choice__compare">
          <article className="is-current">
            <small>EQUIPADO</small>
            <strong>{current.name}</strong>
            <b>{rarityLabel[current.rarity] ?? current.rarity}</b>
            {weaponMode
              ? <WeaponDetails item={current as ArpgWeaponDefinition} />
              : <ArmorDetails item={current as ArpgArmorDefinition} />}
          </article>
          <article className="is-found">
            <small>ENCONTRADO</small>
            <strong>{found.name}</strong>
            <b>{rarityLabel[found.rarity] ?? found.rarity}</b>
            {weaponMode
              ? <WeaponDetails item={found as ArpgWeaponDefinition} />
              : <ArmorDetails item={found as ArpgArmorDefinition} />}
          </article>
        </div>
        <div className="arpg-loot-choice__actions">
          <button type="button" onClick={() => bridge.queueLootDecision("keep")}>Guardar e manter atual</button>
          <button type="button" className="is-primary" onClick={() => bridge.queueLootDecision("equip")}>Equipar agora</button>
        </div>
      </div>
    </div>
  );
}
