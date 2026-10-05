"use client";

import { useState, type ReactNode } from "react";
import { ArrowLeft, Coins, Gem, Shield, Sparkles, Swords, Zap } from "lucide-react";
import {
  ARPG_ABILITY_CARD_BY_ID,
  ARPG_ABILITY_CARDS,
  STARTER_ARPG_ABILITY_IDS,
} from "@/game/arpg/content/ability-cards";
import { ARPG_ARMORS, ARPG_WEAPONS, getDefaultSecondaryArpgWeaponId } from "@/game/arpg/content/equipment";
import { DEFAULT_ARPG_LOADOUT } from "@/game/arpg/content/mata-encantada";
import { CREATURE_BY_ID } from "@/game/catalog";
import {
  ARPG_RELIC_BY_ID,
  ARPG_RELICS,
  STARTER_ARPG_RELIC_ID,
} from "@/game/arpg/content/relics";
import type { ArpgLoadout } from "@/game/arpg/domain/types";
import {
  DEFAULT_AVATAR_CONFIG,
  type AvatarConfig,
} from "@/game/save/local-progress";
import { CharacterCreator2D } from "@/components/game/character-avatar";

const rarityLabel: Record<string, string> = {
  common: "Comum",
  uncommon: "Incomum",
  rare: "Raro",
  epic: "Épico",
  legendary: "Lendário",
  mythic: "Mítico",
};

export type ArpgLoadoutFocus = "all" | "cards" | "avatar";

type PowerPurchaseResult = {
  coins: number;
  ownedAbilityIds: string[];
};

export function ArpgLoadoutView({
  focus = "all",
  loadout,
  inventoryItemKeys,
  ownedAbilityCardIds,
  coins,
  avatarConfig = DEFAULT_AVATAR_CONFIG,
  onChange,
  onPurchaseAbilityCard,
  onSaveAvatar,
  onBack,
  onPlay,
  children,
}: {
  focus?: ArpgLoadoutFocus;
  loadout: ArpgLoadout;
  inventoryItemKeys: string[];
  ownedAbilityCardIds: string[];
  coins: number;
  avatarConfig?: AvatarConfig;
  onChange: (next: ArpgLoadout) => void;
  onPurchaseAbilityCard: (cardId: string) => Promise<PowerPurchaseResult>;
  onSaveAvatar: (config: AvatarConfig) => Promise<void> | void;
  onBack: () => void;
  onPlay: () => void;
  children?: ReactNode;
}) {
  const [activeAbilitySlot, setActiveAbilitySlot] = useState<0 | 1>(0);
  const [activeWeaponSlot, setActiveWeaponSlot] = useState<0 | 1>(0);
  const [pendingCardId, setPendingCardId] = useState<string | null>(null);
  const [purchaseMessage, setPurchaseMessage] = useState<string | null>(null);
  const ownedItems = new Set([
    DEFAULT_ARPG_LOADOUT.weaponId,
    DEFAULT_ARPG_LOADOUT.secondaryWeaponId!,
    DEFAULT_ARPG_LOADOUT.armorId,
    STARTER_ARPG_RELIC_ID,
    ...inventoryItemKeys,
  ]);
  const ownedPowers = new Set(ownedAbilityCardIds);
  const selectedWeapon = ARPG_WEAPONS.find((item) => item.id === loadout.weaponId) ?? ARPG_WEAPONS[0];
  const secondaryWeaponId = loadout.secondaryWeaponId ?? getDefaultSecondaryArpgWeaponId(loadout.weaponId);
  const selectedSecondaryWeapon = ARPG_WEAPONS.find((item) => item.id === secondaryWeaponId) ?? ARPG_WEAPONS[0];
  const selectedArmor = ARPG_ARMORS.find((item) => item.id === loadout.armorId) ?? ARPG_ARMORS[0];
  const selectedRelic = ARPG_RELIC_BY_ID.get(loadout.relicId) ?? ARPG_RELIC_BY_ID.get(STARTER_ARPG_RELIC_ID)!;
  const selectedCards = loadout.abilityIds.map((id) =>
    ARPG_ABILITY_CARD_BY_ID.get(id) ?? ARPG_ABILITY_CARDS[0]
  );

  const equipAbility = (cardId: string) => {
    if (!ownedPowers.has(cardId)) return;
    const next = [...loadout.abilityIds] as [string, string];
    const currentIndex = next.indexOf(cardId);
    if (currentIndex >= 0 && currentIndex !== activeAbilitySlot) {
      [next[currentIndex], next[activeAbilitySlot]] = [next[activeAbilitySlot], next[currentIndex]];
    } else if (currentIndex < 0) {
      next[activeAbilitySlot] = cardId;
    }
    onChange({ ...loadout, abilityIds: next });
    setPurchaseMessage(null);
  };

  const equipWeapon = (weaponId: string) => {
    if (!ownedItems.has(weaponId)) return;
    if (activeWeaponSlot === 0) {
      onChange({
        ...loadout,
        weaponId,
        secondaryWeaponId: weaponId === secondaryWeaponId ? loadout.weaponId : secondaryWeaponId,
      });
    } else {
      onChange({
        ...loadout,
        weaponId: weaponId === loadout.weaponId ? secondaryWeaponId : loadout.weaponId,
        secondaryWeaponId: weaponId,
      });
    }
  };

  const purchaseCard = async (cardId: string) => {
    const card = ARPG_ABILITY_CARD_BY_ID.get(cardId);
    if (focus !== "cards" || !card || !card.purchasable || card.purchasePrice === null || ownedPowers.has(cardId) || pendingCardId) return;
    if (coins < card.purchasePrice) {
      setPurchaseMessage(`Faltam ${(card.purchasePrice - coins).toLocaleString("pt-BR")} moedas para comprar ${card.name}.`);
      return;
    }

    setPendingCardId(cardId);
    setPurchaseMessage(null);
    try {
      await onPurchaseAbilityCard(cardId);
      setPurchaseMessage(`${card.name} foi adicionada à sua coleção. Escolha um dos dois espaços para equipá-la.`);
    } catch (error) {
      setPurchaseMessage(error instanceof Error ? error.message : "A compra não pôde ser concluída.");
    } finally {
      setPendingCardId(null);
    }
  };

  const cardAction = (cardId: string) => {
    if (ownedPowers.has(cardId)) equipAbility(cardId);
    else void purchaseCard(cardId);
  };

  const header = focus === "avatar"
    ? {
        eyebrow: "IDENTIDADE DO CARTÓGRAFO",
        title: "Ateliê do Cartógrafo",
        description: "Crie seu próprio personagem e leve essa aparência para a Guilda e as expedições.",
      }
    : focus === "cards"
      ? {
          eyebrow: "BANCA DO ARQUIVISTA",
          title: "Arquivo de Poderes",
          description: "Aprenda ataques inspirados nas lendas com moedas da jornada. Equipe exatamente dois antes de partir.",
        }
      : {
          eyebrow: "PREPARAÇÃO DA EXPEDIÇÃO",
          title: "Arsenal do Cartógrafo",
          description: "Prepare armas, armadura, relíquia e dois ataques próprios para a próxima expedição.",
        };

  return (
    <section className="content-view arpg-loadout-view" aria-labelledby="arpg-loadout-title">
      <header className="arpg-loadout-hero">
        <div>
          <small>{header.eyebrow}</small>
          <h1 id="arpg-loadout-title">{header.title}</h1>
          <p>{header.description}</p>
        </div>
        {focus === "all" ? (
          <button type="button" onClick={onPlay}>Escolher expedição</button>
        ) : (
          <button type="button" onClick={onBack}><ArrowLeft aria-hidden="true" /> Voltar à Guilda</button>
        )}
      </header>

      {focus === "avatar" ? (
        <CharacterCreator2D
          key="cartographer-avatar-editor"
          initial={avatarConfig}
          ownedEquipment={inventoryItemKeys}
          onSave={onSaveAvatar}
          eyebrowLabel="Personalização"
          title="Seu personagem"
          helperText="Escolha sua aparência. A mesma configuração acompanha você na Guilda e nas expedições."
        />
      ) : null}

      {focus === "all" ? (
        <div className="arpg-loadout-summary">
        <span><Swords aria-hidden="true" /><b>2 armas</b><small>{selectedWeapon.name} · {selectedSecondaryWeapon.name}</small></span>
          <span><Shield aria-hidden="true" /><b>{selectedArmor.name}</b><small>+{selectedArmor.maxHpBonus} HP</small></span>
          <span><Gem aria-hidden="true" /><b>{selectedRelic.name}</b><small>{selectedRelic.effectLabel}</small></span>
          <span><Zap aria-hidden="true" /><b>2 ataques</b><small>{selectedCards.map((card) => card.name).join(" · ")}</small></span>
          <span><Coins aria-hidden="true" /><b>{coins.toLocaleString("pt-BR")} moedas</b><small>Saldo da jornada</small></span>
        </div>
      ) : null}

      {focus === "all" ? <>
        <section className="arpg-loadout-section">
          <div className="arpg-loadout-section__heading"><Swords aria-hidden="true" /><div><strong>Duas armas</strong><small>Alterne entre os espaços 1 e 2 durante a expedição.</small></div></div>
          <div className="arpg-loadout-weapon-slots" role="group" aria-label="Espaço de arma para selecionar">
            <button type="button" aria-pressed={activeWeaponSlot === 0} onClick={() => setActiveWeaponSlot(0)}>
              Espaço 1 · {selectedWeapon.name}
            </button>
            <button type="button" aria-pressed={activeWeaponSlot === 1} onClick={() => setActiveWeaponSlot(1)}>
              Espaço 2 · {selectedSecondaryWeapon.name}
            </button>
          </div>
          <div className="arpg-loadout-grid arpg-loadout-grid--equipment">
            {ARPG_WEAPONS.map((weapon) => {
              const unlocked = ownedItems.has(weapon.id);
              const slot = weapon.id === loadout.weaponId ? 0 : weapon.id === secondaryWeaponId ? 1 : null;
              return (
                <button
                  type="button"
                  key={weapon.id}
                  disabled={!unlocked}
                  aria-pressed={slot === activeWeaponSlot}
                  className={slot === activeWeaponSlot ? "is-selected" : undefined}
                  onClick={() => equipWeapon(weapon.id)}
                >
                  <small>{slot === null ? `Espaço ${activeWeaponSlot + 1} · ` : `Espaço ${slot + 1} · `}{rarityLabel[weapon.rarity] ?? weapon.rarity}</small>
                  <strong>{unlocked ? weapon.name : "Arma não encontrada"}</strong>
                  <span>{unlocked ? `${weapon.damage} dano · ${weapon.kind}` : "Encontre em dungeons para desbloquear."}</span>
                  {unlocked && weapon.effect ? <em>{weapon.effect.label}: {weapon.effect.description}</em> : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="arpg-loadout-section">
          <div className="arpg-loadout-section__heading"><Shield aria-hidden="true" /><div><strong>Armadura</strong><small>Altera vida, defesa e mobilidade.</small></div></div>
          <div className="arpg-loadout-grid arpg-loadout-grid--equipment">
            {ARPG_ARMORS.map((armor) => {
              const unlocked = ownedItems.has(armor.id);
              return (
                <button
                  type="button"
                  key={armor.id}
                  disabled={!unlocked}
                  className={loadout.armorId === armor.id ? "is-selected" : undefined}
                  onClick={() => onChange({ ...loadout, armorId: armor.id })}
                >
                  <small>{rarityLabel[armor.rarity] ?? armor.rarity}</small>
                  <strong>{unlocked ? armor.name : "Armadura não encontrada"}</strong>
                  <span>{unlocked ? `+${armor.maxHpBonus} HP · +${armor.defenseBonus} defesa` : "Encontre em dungeons para desbloquear."}</span>
                  {unlocked && armor.effect ? <em>{armor.effect.label}: {armor.effect.description}</em> : null}
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
                  onClick={() => onChange({ ...loadout, relicId: relic.id })}
                >
                  <small>{rarityLabel[relic.rarity] ?? relic.rarity}</small>
                  <strong>{unlocked ? relic.name : "Relíquia bloqueada"}</strong>
                  <span>{unlocked ? relic.effectLabel : relic.acquisition.label}</span>
                  <em>{unlocked ? relic.description : "Conclua a expedição indicada para desbloquear."}</em>
                </button>
              );
            })}
          </div>
        </section>
      </> : null}

      {focus !== "avatar" ? (
        <section className="arpg-loadout-section" aria-labelledby="arpg-power-title">
          <div className="arpg-loadout-section__heading">
            <Sparkles aria-hidden="true" />
            <div>
              <strong id="arpg-power-title">{focus === "cards" ? "Ataques das lendas" : "Seus ataques"}</strong>
              <small>{focus === "cards"
                ? "Escolha dois espaços. Aprenda ataques novos aqui com moedas."
                : "Equipe dois ataques próprios. Para aprender novos poderes, visite o Arquivo de Poderes na Guilda."}</small>
            </div>
          </div>

          <div className="arpg-ability-slots" role="list" aria-label="Dois espaços de ataque">
            {selectedCards.map((card, index) => (
              <button
                type="button"
                key={`${card.id}:${index}`}
                className={activeAbilitySlot === index ? "is-active" : undefined}
                aria-pressed={activeAbilitySlot === index}
                onClick={() => setActiveAbilitySlot(index as 0 | 1)}
              >
                <small>ATAQUE {index + 1}{activeAbilitySlot === index ? " · SELECIONADO" : ""}</small>
                <strong>{card.name}</strong>
                <span>{rarityLabel[card.rarity] ?? card.rarity} · recarga {(card.cooldownMs / 1000).toFixed(1)}s</span>
              </button>
            ))}
          </div>

          <div className="arpg-ability-collection" aria-label={focus === "cards" ? "Arquivo de cartas de poder" : "Ataques que você possui"}>
            {ARPG_ABILITY_CARDS.filter((card) => focus === "cards" || ownedPowers.has(card.id)).map((card) => {
              const owned = ownedPowers.has(card.id);
              const equippedIndex = loadout.abilityIds.indexOf(card.id);
              const creatureName = CREATURE_BY_ID.get(card.creatureId)?.name ?? card.creatureId;
              const starter = STARTER_ARPG_ABILITY_IDS.includes(card.id as (typeof STARTER_ARPG_ABILITY_IDS)[number]);
              const price = card.purchasePrice ?? null;
              const purchasable = card.purchasable && price !== null;
              const insufficient = !owned && card.purchasable && price !== null && price > coins;
              const disabled = pendingCardId !== null || (!owned && (!purchasable || insufficient));
              const action = owned
                ? equippedIndex >= 0
                  ? `Ataque ${equippedIndex + 1} equipado`
                  : `Equipar no ataque ${activeAbilitySlot + 1}`
                : !card.purchasable || price === null
                  ? `Exclusiva · ${card.acquisition.label}`
                  : insufficient
                    ? `Faltam ${(price - coins).toLocaleString("pt-BR")} moedas · custa ${price.toLocaleString("pt-BR")}`
                    : `Comprar por ${price.toLocaleString("pt-BR")} moedas`;
              const ownedPrice = owned && price !== null ? ` · preço ${price.toLocaleString("pt-BR")} moedas` : "";
              const stateLabel = equippedIndex >= 0
                ? "EQUIPADA"
                : starter
                  ? "INICIAL"
                  : owned
                    ? "ADQUIRIDA"
                    : purchasable
                      ? "À VENDA"
                      : "EXCLUSIVA";

              return (
                <button
                  type="button"
                  key={card.id}
                  disabled={disabled}
                  className={equippedIndex >= 0 ? "is-equipped" : owned ? "is-owned" : price === null ? "is-unavailable" : "is-for-sale"}
                  aria-label={`${creatureName}, ${card.name}: ${action}`}
                  onClick={() => cardAction(card.id)}
                >
                  <small>{stateLabel} · {rarityLabel[card.rarity] ?? card.rarity} · {card.element}</small>
                  <strong>{card.name}</strong>
                  <span>{creatureName} · {card.description}</span>
                  <em>{pendingCardId === card.id ? "Registrando compra..." : starter ? `Inicial · ${action}` : owned ? `Adquirida · ${action}${ownedPrice}` : action}</em>
                </button>
              );
            })}
          </div>

          {focus === "cards" && purchaseMessage ? <p role="status" aria-live="polite">{purchaseMessage}</p> : null}
          {focus === "cards" ? <p>Saldo disponível: <strong>{coins.toLocaleString("pt-BR")} moedas</strong></p> : null}
        </section>
      ) : null}

      {children}
    </section>
  );
}
