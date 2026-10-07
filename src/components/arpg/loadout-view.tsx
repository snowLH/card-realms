"use client";

import { ArrowLeft, Coins, Gem, Sparkles, Swords } from "lucide-react";
import { ARPG_ABILITY_CARD_BY_ID, ARPG_ABILITY_CARDS } from "@/game/arpg/content/ability-cards";
import { ARPG_WEAPONS } from "@/game/arpg/content/equipment";
import { DEFAULT_ARPG_LOADOUT } from "@/game/arpg/content/mata-encantada";
import { CREATURE_BY_ID } from "@/game/catalog";
import { ARPG_RELIC_BY_ID, ARPG_RELICS, STARTER_ARPG_RELIC_ID } from "@/game/arpg/content/relics";
import { getLegendAppearance, PLAYABLE_LEGEND_BY_ID, type PlayableLegendId } from "@/game/arpg/content/legends";
import type { ArpgLoadout } from "@/game/arpg/domain/types";
import { PixelCreature } from "@/components/game/pixel-creature";
import { CharacterAvatar2D } from "@/components/game/character-avatar";
import { LegendSelector } from "@/components/game/legend-selector";
import { DEFAULT_AVATAR_CONFIG, type AvatarConfig } from "@/game/save/local-progress";
import { ArpgItemPixelIcon, type ArpgItemPixelIconKey } from "./item-pixel-icon";

const rarityLabel: Record<string, string> = {
  common: "Comum",
  uncommon: "Incomum",
  rare: "Raro",
  epic: "Épico",
  legendary: "Lendário",
  mythic: "Mítico",
};

const relicIconById: Record<string, ArpgItemPixelIconKey> = {
  "cartographer-compass": "compass",
  "curupira-track-talisman": "talisman",
  "iara-shell-charm": "shell",
};

export type ArpgLoadoutFocus = "all" | "cards" | "legend";

export function ArpgLoadoutView({
  focus = "all",
  loadout,
  inventoryItemKeys,
  ownedLegendIds,
  coins,
  avatarConfig = DEFAULT_AVATAR_CONFIG,
  pendingLegendId,
  focusLegendId,
  onChange,
  onSelectLegend,
  onPurchaseLegend,
  onToggleFavoriteLegend,
  onBack,
  onPlay,
}: {
  focus?: ArpgLoadoutFocus;
  loadout: ArpgLoadout;
  inventoryItemKeys: string[];
  ownedLegendIds: PlayableLegendId[];
  coins: number;
  avatarConfig?: AvatarConfig;
  pendingLegendId: PlayableLegendId | null;
  focusLegendId?: PlayableLegendId | null;
  onChange: (next: ArpgLoadout) => void;
  onSelectLegend: (legendId: PlayableLegendId) => Promise<void> | void;
  onPurchaseLegend: (legendId: PlayableLegendId) => Promise<void>;
  onToggleFavoriteLegend: (legendId: PlayableLegendId) => void;
  onBack: () => void;
  onPlay: () => void;
}) {
  const ownedItems = new Set([
    DEFAULT_ARPG_LOADOUT.weaponId,
    STARTER_ARPG_RELIC_ID,
    ...inventoryItemKeys,
  ]);
  const selectedWeapon = ARPG_WEAPONS.find((item) => item.id === loadout.weaponId) ?? ARPG_WEAPONS[0];
  const selectedRelic = ARPG_RELIC_BY_ID.get(loadout.relicId) ?? ARPG_RELIC_BY_ID.get(STARTER_ARPG_RELIC_ID)!;
  const selectedLegend = PLAYABLE_LEGEND_BY_ID.get(avatarConfig.legendId) ?? PLAYABLE_LEGEND_BY_ID.get("curupira")!;
  const selectedCards = loadout.abilityIds.map((id) => {
    const card = ARPG_ABILITY_CARD_BY_ID.get(id) ?? ARPG_ABILITY_CARDS[0];
    const ownerLegend = PLAYABLE_LEGEND_BY_ID.get(card.creatureId as PlayableLegendId);
    return {
      ...card,
      creatureName: ownerLegend?.name ?? CREATURE_BY_ID.get(card.creatureId)?.name ?? card.creatureId,
    };
  });

  const renderPowerPortrait = (creatureId: string, size: number) => {
    const legend = PLAYABLE_LEGEND_BY_ID.get(creatureId as PlayableLegendId);
    if (legend) {
      return (
        <span style={{ width: size, height: size, flex: `0 0 ${size}px`, overflow: "hidden" }} aria-hidden="true">
          <CharacterAvatar2D config={{ ...getLegendAppearance(legend.id), favoriteLegendId: null }} compact ariaLabel="" />
        </span>
      );
    }
    const creature = CREATURE_BY_ID.get(creatureId);
    if (!creature) return null;
    return (
      <span
        className="arpg-hud__card-portrait"
        aria-hidden="true"
        style={{ width: size, height: size, flex: `0 0 ${size}px` }}
      >
        <PixelCreature sprite={creature.sprite} className="arpg-hud__card-sprite" label="" />
      </span>
    );
  };

  const header = focus === "legend"
    ? {
        eyebrow: "HERÓIS DA GUILDA",
        title: "Escolha sua lenda",
        description: "Escolha um personagem jogável. Cada carta desbloqueia os dois ataques próprios daquela lenda.",
      }
    : focus === "cards"
      ? {
          eyebrow: "TÉCNICAS DA LENDA",
          title: `Ataques de ${selectedLegend.name}`,
          description: "Cada personagem leva seus dois ataques próprios. Eles vêm com a carta da lenda e não mudam durante a expedição.",
        }
      : {
          eyebrow: "PREPARAÇÃO DA EXPEDIÇÃO",
          title: "Arsenal da Guilda",
          description: `${selectedLegend.name} leva seus dois ataques próprios e entra sem armadura. Prepare sua arma e relíquia antes de partir.`,
        };

  return (
    <section className="content-view arpg-loadout-view" aria-labelledby="arpg-loadout-title">
      <header className="arpg-loadout-hero">
        <div style={focus === "legend" ? undefined : { display: "flex", alignItems: "center", gap: 14 }}>
          {focus !== "legend" ? <CharacterAvatar2D config={avatarConfig} compact ariaLabel={selectedLegend.name} /> : null}
          <div>
            <small>{header.eyebrow}</small>
            <h1 id="arpg-loadout-title">{header.title}</h1>
            <p>{header.description}</p>
          </div>
        </div>
        {focus === "all" ? (
          <button type="button" onClick={onPlay}>Escolher expedição</button>
        ) : (
          <button type="button" onClick={onBack}><ArrowLeft aria-hidden="true" /> Voltar à Guilda</button>
        )}
      </header>

      {focus === "legend" ? (
        <LegendSelector
          selectedLegendId={avatarConfig.legendId}
          focusLegendId={focusLegendId}
          favoriteLegendId={avatarConfig.favoriteLegendId}
          ownedLegendIds={ownedLegendIds}
          coins={coins}
          pendingLegendId={pendingLegendId}
          onSelect={onSelectLegend}
          onPurchase={onPurchaseLegend}
          onToggleFavorite={onToggleFavoriteLegend}
        />
      ) : null}

      {focus === "all" ? (
        <div className="arpg-loadout-summary">
          <span><ArpgItemPixelIcon item={selectedWeapon.kind} size={32} /><b>{selectedWeapon.name}</b><small>{selectedWeapon.damage} dano</small></span>
          <span><ArpgItemPixelIcon item={relicIconById[selectedRelic.id]} size={32} /><b>{selectedRelic.name}</b><small>{selectedRelic.effectLabel}</small></span>
          <span><Sparkles aria-hidden="true" /><b>2 ataques de {selectedLegend.name}</b><small>{selectedCards[0].name} · {selectedCards[1].name}</small></span>
          <span><Coins aria-hidden="true" /><b>{coins.toLocaleString("pt-BR")} moedas</b><small>Saldo da jornada</small></span>
        </div>
      ) : null}

      {focus === "all" ? <>
        <section className="arpg-loadout-section">
          <div className="arpg-loadout-section__heading"><Swords aria-hidden="true" /><div><strong>Arma</strong><small>Define o ataque básico e pode ser encontrada nas masmorras.</small></div></div>
          <div className="arpg-loadout-grid arpg-loadout-grid--equipment">
            {ARPG_WEAPONS.map((weapon) => {
              const unlocked = ownedItems.has(weapon.id);
              return (
                <button
                  type="button"
                  key={weapon.id}
                  disabled={!unlocked}
                  className={loadout.weaponId === weapon.id ? "is-selected" : undefined}
                  aria-pressed={loadout.weaponId === weapon.id}
                  onClick={() => onChange({ ...loadout, weaponId: weapon.id })}
                >
                  <ArpgItemPixelIcon item={weapon.kind} size={52} />
                  <small>{loadout.weaponId === weapon.id ? "EQUIPADA · " : ""}{rarityLabel[weapon.rarity] ?? weapon.rarity}</small>
                  <strong>{unlocked ? weapon.name : "Arma não encontrada"}</strong>
                  <span>{unlocked ? `${weapon.damage} dano · ${weapon.kind}` : "Encontre em expedições para desbloquear."}</span>
                  {unlocked && weapon.effect ? <em>{weapon.effect.label}: {weapon.effect.description}</em> : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="arpg-loadout-section">
          <div className="arpg-loadout-section__heading"><Gem aria-hidden="true" /><div><strong>Relíquia</strong><small>Um passivo durante toda a expedição.</small></div></div>
          <div className="arpg-loadout-grid arpg-loadout-grid--relics">
            {ARPG_RELICS.map((relic) => {
              const unlocked = ownedItems.has(relic.id);
              return (
                <button
                  type="button"
                  key={relic.id}
                  disabled={!unlocked}
                  className={loadout.relicId === relic.id ? "is-selected" : undefined}
                  aria-pressed={loadout.relicId === relic.id}
                  onClick={() => onChange({ ...loadout, relicId: relic.id })}
                >
                  <ArpgItemPixelIcon item={relicIconById[relic.id]} size={52} />
                  <small>{loadout.relicId === relic.id ? "EQUIPADA · " : ""}{rarityLabel[relic.rarity] ?? relic.rarity}</small>
                  <strong>{unlocked ? relic.name : "Relíquia bloqueada"}</strong>
                  <span>{unlocked ? relic.effectLabel : relic.acquisition.label}</span>
                  <em>{unlocked ? relic.description : "Conclua a expedição indicada para desbloquear."}</em>
                </button>
              );
            })}
          </div>
        </section>
      </> : null}

      {focus !== "legend" ? (
        <section className="arpg-loadout-section" aria-labelledby="arpg-power-title">
          <div className="arpg-loadout-section__heading">
            <Sparkles aria-hidden="true" />
            <div>
              <strong id="arpg-power-title">Os dois ataques de {selectedLegend.name}</strong>
              <small>Desbloqueados juntos com a carta deste personagem; escolha outra lenda na Guilda para trocar de ataques.</small>
            </div>
          </div>
          <div className="arpg-ability-collection" aria-label={`Ataques de ${selectedLegend.name}`}>
            {selectedCards.map((card, index) => (
              <article className="is-equipped" key={`${card.id}:${index}`}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  {renderPowerPortrait(card.creatureId, 42)}
                  <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
                    <small>ATAQUE {index + 1} · {rarityLabel[card.rarity] ?? card.rarity} · {card.element}</small>
                    <strong>{card.name}</strong>
                    <span>{card.creatureName} · {card.description}</span>
                    <em>Recarga {(card.cooldownMs / 1000).toFixed(1)}s</em>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
