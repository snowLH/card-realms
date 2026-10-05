"use client";

import { Coins, Gem, RotateCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ARPG_ABILITY_CARD_BY_ID, ARPG_ABILITY_CARDS } from "@/game/arpg/content/ability-cards";
import {
  ARPG_POWER_GACHA_BASE_PROBABILITIES,
  ARPG_POWER_GACHA_COST,
  ARPG_POWER_GACHA_FRAGMENT_COSTS,
  ARPG_POWER_GACHA_TIER_LABELS,
  ARPG_POWER_GACHA_TIERS,
  getArpgPowerGachaFragmentCost,
  type ArpgPowerGachaProbabilities,
  type ArpgPowerGachaRarity,
  type ArpgPowerGachaTier,
} from "@/game/arpg/content/power-gacha";
import { CREATURE_BY_ID } from "@/game/catalog";
import styles from "./power-gacha.module.css";

type GachaState = {
  accountId: string;
  cost: number;
  coins: number;
  legendFragments: number;
  ownedCardIds: string[];
  fragmentCosts: Record<ArpgPowerGachaRarity, number>;
  pityMisses: number;
  softPityStartsAtMisses: number;
  hardPityAfterMisses: number;
  rollsUntilGuaranteedEpic: number;
  probabilities: ArpgPowerGachaProbabilities;
};

type GachaResult = {
  coins: number;
  itemId: string;
  rarity: string;
  tier: ArpgPowerGachaTier;
  duplicate: boolean;
  fragmentsAwarded: number;
  legendFragments: number;
  pityMisses: number;
  rollsUntilGuaranteedEpic: number;
  probabilities: ArpgPowerGachaProbabilities;
  replayed: boolean;
};

type RedemptionResult = {
  itemId: string;
  rarity: ArpgPowerGachaRarity;
  tier: ArpgPowerGachaTier;
  fragmentsSpent: number;
  legendFragments: number;
  ownedCardIds: string[];
  replayed: boolean;
};

type Props = {
  authenticated: boolean;
  accountId?: string | null;
  onResult: (result: GachaResult) => void;
  onRedeem?: (result: { accountId: string; itemId: string; legendFragments: number; replayed: boolean }) => void;
};

const LEGACY_PENDING_KEY = "card-realms:arpg-power-gacha:pending-roll-v1";
const PENDING_ROLL_KEY_PREFIX = "card-realms:arpg-power-gacha:pending-roll-v2:";
const PENDING_REDEEM_KEY_PREFIX = "card-realms:arpg-power-gacha:pending-redeem-v1:";

function isUuid(value: string | null): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function rarityLabel(rarity: string) {
  if (rarity === "mythic") return "Mítico";
  const tier = rarity as ArpgPowerGachaTier;
  return ARPG_POWER_GACHA_TIER_LABELS[tier] ?? rarity;
}

function readPendingKey(storageKey: string) {
  try {
    const stored = window.sessionStorage.getItem(storageKey);
    if (isUuid(stored)) return stored;
    if (stored) window.sessionStorage.removeItem(storageKey);
  } catch {
    // The server idempotency key still protects an in-flight request.
  }
  return null;
}

function storePendingKey(storageKey: string, key: string) {
  try {
    window.sessionStorage.setItem(storageKey, key);
  } catch {
    // The current request is still safe even if storage is blocked.
  }
}

function clearPendingKey(storageKey: string) {
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // The server idempotency key still prevents a repeated charge.
  }
}

export function ArpgPowerGacha({ authenticated, accountId, onResult, onRedeem }: Props) {
  const [state, setState] = useState<GachaState | null>(null);
  const [result, setResult] = useState<{ accountId: string; value: GachaResult } | null>(null);
  const [pendingKey, setPendingKey] = useState<{ accountId: string; key: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [redeemingCardId, setRedeemingCardId] = useState<string | null>(null);
  const [redeemMessage, setRedeemMessage] = useState<{ accountId: string; value: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeAccountIdRef = useRef<string | null>(accountId ?? null);

  useLayoutEffect(() => {
    activeAccountIdRef.current = accountId ?? state?.accountId ?? null;
  }, [accountId, state?.accountId]);

  const cardsByTier = useMemo(() => {
    const resultMap: Record<ArpgPowerGachaTier, string[]> = {
      common: [], uncommon: [], rare: [], epic: [], legendary: [],
    };
    for (const card of ARPG_ABILITY_CARDS) {
      if (!card.purchasable) continue;
      const tier = card.rarity === "mythic" ? "legendary" : card.rarity;
      if (tier in resultMap) resultMap[tier as ArpgPowerGachaTier].push(card.id);
    }
    return resultMap;
  }, []);

  const refreshState = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/arpg/powers/gacha", { cache: "no-store" });
      const payload = await response.json() as GachaState & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "O Arquivo não respondeu.");
      return payload;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar as chances.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    clearPendingKey(LEGACY_PENDING_KEY);
    void Promise.resolve().then(refreshState).then((loaded) => {
      if (!loaded || cancelled) return;
      if (accountId && accountId !== loaded.accountId) {
        setError("A sessão mudou. Atualize o Arquivo antes de continuar.");
        return;
      }
      setState(loaded);
      const key = readPendingKey(`${PENDING_ROLL_KEY_PREFIX}${loaded.accountId}`);
      setPendingKey(key ? { accountId: loaded.accountId, key } : null);
    });
    return () => { cancelled = true; };
  }, [accountId, authenticated, refreshState]);

  const roll = async () => {
    const currentState = authenticated && (!accountId || state?.accountId === accountId) ? state : null;
    if (!authenticated || rolling || !currentState) return;
    const currentAccountId = accountId ?? currentState.accountId;
    if (currentAccountId !== currentState.accountId) return;
    const storageKey = `${PENDING_ROLL_KEY_PREFIX}${currentAccountId}`;
    const savedKey = pendingKey?.accountId === currentAccountId
      ? pendingKey.key
      : readPendingKey(storageKey);
    const key = savedKey ?? window.crypto.randomUUID();
    if (!savedKey) storePendingKey(storageKey, key);
    setPendingKey({ accountId: currentAccountId, key });

    setRolling(true);
    setError(null);
    try {
      const response = await fetch("/api/arpg/powers/gacha", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId: currentAccountId, idempotencyKey: key }),
      });
      const payload = await response.json() as GachaResult & { error?: string; authority?: string };
      if (!response.ok) throw new Error(payload.error ?? "A roletagem não pôde ser concluída.");
      const card = ARPG_ABILITY_CARD_BY_ID.get(payload.itemId);
      if (!card) throw new Error("O Arquivo recebeu um poder fora do catálogo atual.");
      clearPendingKey(storageKey);
      if (activeAccountIdRef.current !== currentAccountId) {
        setPendingKey(null);
        return;
      }

      setResult({ accountId: currentAccountId, value: payload });
      setState((current) => current ? {
        ...current,
        coins: payload.coins,
        legendFragments: payload.legendFragments,
        ownedCardIds: [...new Set([...current.ownedCardIds, payload.itemId])],
        pityMisses: payload.pityMisses,
        rollsUntilGuaranteedEpic: payload.rollsUntilGuaranteedEpic,
        probabilities: payload.probabilities,
      } : current);
      onResult(payload);
      setPendingKey(null);
    } catch (reason) {
      if (activeAccountIdRef.current === currentAccountId) {
        setError(reason instanceof Error ? reason.message : "A roletagem não pôde ser concluída.");
      }
    } finally {
      setRolling(false);
    }
  };

  const redeem = async (cardId: string) => {
    const currentState = authenticated && (!accountId || state?.accountId === accountId) ? state : null;
    if (!authenticated || !currentState || rolling || redeemingCardId) return;
    const card = ARPG_ABILITY_CARD_BY_ID.get(cardId);
    if (!card?.purchasable || currentState.ownedCardIds.includes(cardId)) return;
    const currentAccountId = accountId ?? currentState.accountId;
    if (currentAccountId !== currentState.accountId) return;

    const storageKey = `${PENDING_REDEEM_KEY_PREFIX}${currentAccountId}:${cardId}`;
    const key = readPendingKey(storageKey) ?? window.crypto.randomUUID();
    storePendingKey(storageKey, key);
    setRedeemingCardId(cardId);
    setRedeemMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/arpg/powers/gacha/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId: currentAccountId, cardId, idempotencyKey: key }),
      });
      const payload = await response.json() as RedemptionResult & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "O resgate não pôde ser concluído.");
      if (payload.itemId !== cardId) throw new Error("O Arquivo respondeu com outro poder.");
      clearPendingKey(storageKey);
      if (activeAccountIdRef.current !== currentAccountId) return;

      setState((current) => current ? {
        ...current,
        legendFragments: payload.legendFragments,
        ownedCardIds: payload.ownedCardIds,
      } : current);
      setRedeemMessage({
        accountId: currentAccountId,
        value: `${card.name} resgatado por ${payload.fragmentsSpent.toLocaleString("pt-BR")} fragmentos${payload.replayed ? " · resultado recuperado" : ""}.`,
      });
      onRedeem?.({ accountId: currentAccountId, itemId: payload.itemId, legendFragments: payload.legendFragments, replayed: payload.replayed });
    } catch (reason) {
      if (activeAccountIdRef.current === currentAccountId) {
        setError(reason instanceof Error ? reason.message : "O resgate não pôde ser concluído.");
      }
    } finally {
      setRedeemingCardId(null);
    }
  };

  const visibleState = authenticated && (!accountId || state?.accountId === accountId) ? state : null;
  const currentAccountId = accountId ?? visibleState?.accountId ?? null;
  const visibleResult = authenticated && result?.accountId === currentAccountId ? result.value : null;
  const visibleRedeemMessage = authenticated && redeemMessage?.accountId === currentAccountId ? redeemMessage.value : null;
  const odds = visibleState?.probabilities ?? ARPG_POWER_GACHA_BASE_PROBABILITIES;
  const resultCard = visibleResult ? ARPG_ABILITY_CARD_BY_ID.get(visibleResult.itemId) : undefined;
  const resultCreature = resultCard ? CREATURE_BY_ID.get(resultCard.creatureId)?.name : undefined;
  const canAfford = Boolean(visibleState && visibleState.coins >= visibleState.cost);
  const pendingRollForAccount = Boolean(visibleState && pendingKey?.accountId === currentAccountId && pendingKey.key);
  const ownedCardIds = new Set(visibleState?.ownedCardIds ?? []);

  return (
    <section className={styles.panel} aria-labelledby="arpg-power-gacha-title">
      <header className={styles.header}>
        <span className={styles.icon}><Sparkles aria-hidden="true" /></span>
        <div>
          <small>ARQUIVO DA GUILDA</small>
          <h2 id="arpg-power-gacha-title">Roleta de poderes</h2>
          <p>Desbloqueie ataques para o seu próprio personagem. Cada poder recebido ocupa uma das duas escolhas equipadas.</p>
        </div>
      </header>

      <div className={styles.odds} aria-label="Chances por raridade para esta rolagem">
        {ARPG_POWER_GACHA_TIERS.map((tier) => {
          const count = cardsByTier[tier].length;
          const chance = odds[tier];
          return (
            <div className={styles.oddsCard} key={tier}>
              <span>{ARPG_POWER_GACHA_TIER_LABELS[tier]}</span>
              <strong>{chance.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</strong>
              <small>{count > 0 ? `${(chance / count).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% por poder · ${count} ${count === 1 ? "poder" : "poderes"}` : "sem poderes no catálogo"}</small>
            </div>
          );
        })}
      </div>

      <div className={styles.info}>
        <p>Chances iniciais: 50% comum, 28% incomum, 14% raro, 6% épico e 2% lendário. O poder mítico do Roc integra a faixa lendária.</p>
        {authenticated ? (
          <p>
            {visibleState
              ? visibleState.pityMisses >= visibleState.softPityStartsAtMisses
                ? `Proteção ativa: ${visibleState.pityMisses} tentativas sem épico+. Restam ${visibleState.rollsUntilGuaranteedEpic} para a garantia.`
                : `A chance aumenta após ${visibleState.softPityStartsAtMisses} tentativas sem épico+. Épico+ garantido na 20ª.`
              : "Carregando sua proteção contra azar..."}
          </p>
        ) : (
          <p>Entre na sua conta para usar a roleta e salvar o resultado.</p>
        )}
      </div>

      <section className={styles.exchange} aria-labelledby="arpg-power-gacha-exchange-title">
        <div className={styles.exchangeHeading}>
          <div>
            <h3 id="arpg-power-gacha-exchange-title">Troca por fragmentos</h3>
            <p>Custo fixo por raridade, equivalente a cinco duplicatas dessa raridade. O resgate não usa moedas.</p>
          </div>
          <span><Gem aria-hidden="true" /> {visibleState ? visibleState.legendFragments.toLocaleString("pt-BR") : "—"} disponíveis</span>
        </div>
        <div className={styles.exchangeList}>
          {ARPG_ABILITY_CARDS.filter((card) => card.purchasable).map((card) => {
            const rarity = card.rarity as ArpgPowerGachaRarity;
            const cost = visibleState?.fragmentCosts[rarity]
              ?? getArpgPowerGachaFragmentCost(rarity)
              ?? ARPG_POWER_GACHA_FRAGMENT_COSTS.common;
            const owned = ownedCardIds.has(card.id);
            const insufficient = Boolean(visibleState && visibleState.legendFragments < cost);
            const disabled = !authenticated || !visibleState || loading || rolling || redeemingCardId !== null || owned || insufficient;
            const creatureName = CREATURE_BY_ID.get(card.creatureId)?.name ?? card.creatureId;
            const label = owned
              ? "Já adquirido"
              : !authenticated
                ? "Entre para resgatar"
                  : !visibleState
                  ? "Consultando saldo"
                  : insufficient
                    ? `Faltam ${(cost - visibleState.legendFragments).toLocaleString("pt-BR")} fragmentos`
                    : `Resgatar por ${cost.toLocaleString("pt-BR")} fragmentos`;

            return (
              <article className={styles.exchangeCard} key={card.id}>
                <div className={styles.exchangeCardInfo}>
                  <small>{rarityLabel(card.rarity)} · {creatureName}</small>
                  <strong>{card.name}</strong>
                  <span>{card.description}</span>
                </div>
                <button
                  type="button"
                  className={styles.exchangeButton}
                  disabled={disabled}
                  aria-label={`${card.name}, ${rarityLabel(card.rarity)}: ${label}`}
                  onClick={() => void redeem(card.id)}
                >
                  {redeemingCardId === card.id ? "Resgatando..." : label}
                </button>
              </article>
            );
          })}
        </div>
        {visibleRedeemMessage ? <p className={styles.exchangeMessage} role="status" aria-live="polite">{visibleRedeemMessage}</p> : null}
      </section>

      {resultCard && visibleResult ? (
        <div className={styles.result} data-duplicate={visibleResult.duplicate} role="status" aria-live="polite">
          <Sparkles aria-hidden="true" />
          <div>
            <small>{visibleResult.duplicate ? "DUPLICATA · FRAGMENTOS DA LENDA" : "NOVO PODER DESBLOQUEADO"} · {rarityLabel(visibleResult.rarity)}</small>
            <strong>{resultCard.name}</strong>
            <span>{resultCreature ?? resultCard.creatureId} · {resultCard.description}</span>
            {visibleResult.duplicate ? <em>+{visibleResult.fragmentsAwarded} fragmentos · total {visibleResult.legendFragments}</em> : null}
            {visibleResult.replayed ? <em>Resultado recuperado com a mesma chave; nenhuma cobrança repetida.</em> : null}
          </div>
        </div>
      ) : null}

      <footer className={styles.footer}>
        <div className={styles.wallet}>
          <span><Coins aria-hidden="true" /> {visibleState ? visibleState.coins.toLocaleString("pt-BR") : "—"} moedas</span>
          <span><Gem aria-hidden="true" /> {visibleState ? visibleState.legendFragments.toLocaleString("pt-BR") : "—"} fragmentos</span>
        </div>
        {authenticated ? (
          <button
            type="button"
            className={styles.rollButton}
            disabled={loading || rolling || !visibleState || !canAfford}
            onClick={() => void roll()}
          >
            <RotateCw aria-hidden="true" />
            {rolling
              ? "Registrando resultado..."
                : pendingRollForAccount
                ? "Recuperar rolagem pendente"
                : `Rolar por ${(visibleState?.cost ?? ARPG_POWER_GACHA_COST).toLocaleString("pt-BR")} moedas`}
          </button>
        ) : null}
      </footer>
      {authenticated && visibleState && !canAfford ? <p className={styles.error} role="status">Você precisa de {visibleState.cost.toLocaleString("pt-BR")} moedas para rolar.</p> : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {loading && !visibleState ? <p className={styles.loading} role="status">Consultando chances e saldo...</p> : null}
    </section>
  );
}
