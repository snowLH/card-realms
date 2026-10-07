"use client";

import { useEffect, useMemo } from "react";
import { Check, Coins, LockKeyhole, LoaderCircle, Star } from "lucide-react";
import {
  getLegendAppearance,
  PLAYABLE_LEGENDS,
  type PlayableLegendId,
} from "@/game/arpg/content/legends";
import { ARPG_ABILITY_CARD_BY_ID } from "@/game/arpg/content/ability-cards";
import { CharacterAvatar2D } from "@/components/game/character-avatar";
import { DEFAULT_AVATAR_CONFIG } from "@/game/save/local-progress";
import styles from "./legend-selector.module.css";

export type LegendSelectorProps = {
  selectedLegendId: PlayableLegendId;
  focusLegendId?: PlayableLegendId | null;
  favoriteLegendId: PlayableLegendId | null;
  ownedLegendIds: readonly PlayableLegendId[];
  coins: number;
  pendingLegendId: PlayableLegendId | null;
  onSelect: (legendId: PlayableLegendId) => void;
  onPurchase: (legendId: PlayableLegendId) => void | Promise<void>;
  onToggleFavorite: (legendId: PlayableLegendId) => void;
};

export function LegendSelector({
  selectedLegendId,
  focusLegendId = null,
  favoriteLegendId,
  ownedLegendIds,
  coins,
  pendingLegendId,
  onSelect,
  onPurchase,
  onToggleFavorite,
}: LegendSelectorProps) {
  useEffect(() => {
    if (!focusLegendId) return;
    const card = [...document.querySelectorAll<HTMLElement>("[data-legend-id]")]
      .find((candidate) => candidate.dataset.legendId === focusLegendId);
    const scrollIntoView = (card as (HTMLElement & { scrollIntoView?: (options?: ScrollIntoViewOptions) => void }) | undefined)?.scrollIntoView;
    scrollIntoView?.call(card, { block: "center", behavior: "smooth" });
  }, [focusLegendId]);

  const owned = useMemo(
    () => new Set<PlayableLegendId>([...ownedLegendIds, "curupira"]),
    [ownedLegendIds],
  );
  const appearances = useMemo(
    () => new Map(PLAYABLE_LEGENDS.map((legend) => [
      legend.id,
      { ...DEFAULT_AVATAR_CONFIG, ...getLegendAppearance(legend.id) },
    ])),
    [],
  );

  return (
    <section
      className={styles.selector}
      aria-labelledby="legend-selector-title"
      aria-describedby="legend-selector-description"
    >
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>HERÓIS DA GUILDA</span>
          <h2 id="legend-selector-title">Escolha sua lenda</h2>
          <p id="legend-selector-description">Cada lenda leva seus dois ataques para a masmorra. Encontre armas e melhorias durante a aventura.</p>
        </div>
        <div className={styles.wallet} aria-label={`${coins.toLocaleString("pt-BR")} moedas disponíveis`}>
          <Coins aria-hidden="true" />
          <span><small>SUAS MOEDAS</small><strong>{coins.toLocaleString("pt-BR")}</strong></span>
        </div>
      </header>

      <div className={styles.grid}>
        {PLAYABLE_LEGENDS.map((legend) => {
          const isOwned = owned.has(legend.id);
          const isSelected = selectedLegendId === legend.id;
          const isFavorite = favoriteLegendId === legend.id;
          const isPending = pendingLegendId === legend.id;
          const purchaseBusy = pendingLegendId !== null;
          const canAfford = coins >= legend.price;
          const avatarConfig = appearances.get(legend.id)!;
          const signatureAbilities = legend.signatureAbilityIds.map(
            (id) => ARPG_ABILITY_CARD_BY_ID.get(id)?.name ?? id,
          );

          return (
            <article
              key={legend.id}
              className={`${styles.card} ${isSelected ? styles.cardSelected : ""} ${focusLegendId === legend.id ? styles.cardFocused : ""} ${!isOwned ? styles.cardLocked : ""}`}
              data-legend-id={legend.id}
              data-focused={focusLegendId === legend.id ? "true" : undefined}
              aria-labelledby={`legend-card-${legend.id}-title`}
            >
              <div className={styles.cardTop}>
                <div className={styles.identity}>
                  <span className={styles.origin}>{legend.folklore}</span>
                  <h3 id={`legend-card-${legend.id}-title`}>{legend.name}</h3>
                  <p>{legend.epithet}</p>
                </div>
                <button
                  type="button"
                  className={`${styles.favorite} ${isFavorite ? styles.favoriteActive : ""}`}
                  aria-label={isFavorite ? `Remover ${legend.name} dos favoritos` : `Marcar ${legend.name} como favorito`}
                  aria-pressed={isFavorite}
                  title={isOwned ? (isFavorite ? "Remover dos favoritos" : "Marcar como favorito") : "Desbloqueie para favoritar"}
                  disabled={!isOwned}
                  onClick={() => onToggleFavorite(legend.id)}
                >
                  <Star aria-hidden="true" />
                </button>
              </div>

              <div className={styles.preview}>
                <span className={styles.previewRune} aria-hidden="true">✦</span>
                <CharacterAvatar2D
                  config={avatarConfig}
                  compact
                  idleStrip
                  ariaLabel={`Visual de ${legend.name}`}
                />
                <span className={styles.previewBase} aria-hidden="true" />
                {!isOwned ? (
                  <span className={styles.lockedStamp}><LockKeyhole aria-hidden="true" /> BLOQUEADA</span>
                ) : null}
                {isSelected ? (
                  <span className={styles.selectedStamp}><Check aria-hidden="true" /> ESCOLHIDA</span>
                ) : null}
              </div>

              <p className={styles.description}>{legend.description}</p>

              <section className={styles.attacks} aria-label={`Dois ataques de ${legend.name}`}>
                <span className={styles.attacksLabel}>2 ATAQUES DE ASSINATURA</span>
                <ol className={styles.attackList}>
                  {signatureAbilities.map((name, index) => (
                    <li key={legend.signatureAbilityIds[index]}>{name}</li>
                  ))}
                </ol>
                <small>{isOwned ? "Os dois ataques estão desbloqueados." : "A compra desta lenda libera os dois ataques."}</small>
              </section>

              <div className={styles.cardBottom}>
                {isOwned ? (
                  <span className={styles.ownedLabel}><Check aria-hidden="true" /> DISPONÍVEL</span>
                ) : (
                  <div className={styles.priceBlock}>
                    <span className={styles.price}><Coins aria-hidden="true" /> {legend.price.toLocaleString("pt-BR")}</span>
                    {!canAfford ? <small>Faltam {(legend.price - coins).toLocaleString("pt-BR")} moedas</small> : null}
                  </div>
                )}

                {isOwned ? (
                  <button
                    type="button"
                    className={styles.selectButton}
                    aria-pressed={isSelected}
                    onClick={() => onSelect(legend.id)}
                  >
                    {isSelected ? <><Check aria-hidden="true" /> Escolhida</> : "Escolher"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.purchaseButton}
                    disabled={!canAfford || purchaseBusy}
                    aria-busy={isPending}
                    onClick={() => { void onPurchase(legend.id); }}
                  >
                    {isPending
                      ? <><LoaderCircle className={styles.spinner} aria-hidden="true" /> Comprando</>
                      : <><Coins aria-hidden="true" /> Comprar</>}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
