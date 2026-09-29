"use client";

import { Check, Clock3, LoaderCircle, Radio, ShieldAlert, Swords, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { PlayerBootstrap } from "@/game/player";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { LoginDialog } from "@/components/auth/login-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FriendManager } from "./friend-manager";

type Challenge = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  battle_id: string | null;
  expires_at: string;
  created_at: string;
};

type Friend = {
  id: string;
  name: string;
  hasActiveTeam: boolean;
};

type LobbyResponse = {
  challenges: Challenge[];
  friends: Friend[];
  error?: string;
};

export function PvpView({
  bootstrap,
  onOpenBattle,
}: {
  bootstrap: PlayerBootstrap;
  onOpenBattle: (battleId: string) => void;
}) {
  const playerId = bootstrap.identity?.id ?? null;
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(bootstrap.source === "supabase");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (bootstrap.source !== "supabase") return;
    try {
      const response = await fetch("/api/pvp/challenges", { cache: "no-store" });
      const payload = (await response.json()) as LobbyResponse;
      if (!response.ok) throw new Error(payload.error ?? "O salão de duelos não respondeu.");
      setChallenges(payload.challenges);
      setFriends(payload.friends ?? []);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "O salão de duelos não respondeu.");
    } finally {
      setLoading(false);
    }
  }, [bootstrap.source]);

  useEffect(() => {
    if (bootstrap.source !== "supabase" || !playerId) return;
    const initialLoad = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 15000);
    const supabase = getSupabaseBrowserClient();
    let cancelled = false;
    let removeChannel: (() => void) | null = null;
    if (supabase) {
      void supabase.realtime.setAuth().then(() => {
        if (cancelled) return;
        const channel = supabase
          .channel(`pvp:player:${playerId}`, { config: { private: true } })
          .on("broadcast", { event: "INSERT" }, () => void refresh())
          .on("broadcast", { event: "UPDATE" }, () => void refresh())
          .subscribe();
        removeChannel = () => void supabase.removeChannel(channel);
      }).catch(() => undefined);
    }
    return () => {
      cancelled = true;
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
      removeChannel?.();
    };
  }, [bootstrap.source, playerId, refresh]);

  async function createChallenge(friendId: string) {
    setBusyId(friendId);
    setError("");
    try {
      const response = await fetch("/api/pvp/challenges", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ addresseeId: friendId }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "O desafio não pôde ser enviado.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "O desafio não pôde ser enviado.");
    } finally {
      setBusyId(null);
    }
  }

  async function respond(challengeId: string, responseType: "accept" | "decline" | "cancel") {
    setBusyId(challengeId);
    setError("");
    try {
      const response = await fetch("/api/pvp/challenges", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId, response: responseType }),
      });
      const payload = (await response.json()) as {
        error?: string;
        battle?: { battleId?: string };
      };
      if (!response.ok) throw new Error(payload.error ?? "A resposta não pôde ser confirmada.");
      if (responseType === "accept" && payload.battle?.battleId) {
        onOpenBattle(payload.battle.battleId);
      }
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "A resposta não pôde ser confirmada.");
    } finally {
      setBusyId(null);
    }
  }

  if (bootstrap.source !== "supabase" || !playerId) {
    return (
      <section className="content-view pvp-view">
        <header className="view-heading">
          <div><span className="view-eyebrow">Duelo online</span><h1>Salão dos Cartógrafos</h1><p>Desafios exigem uma conta online e uma equipe ativa de exatamente seis criaturas.</p></div>
        </header>
        <div className="pvp-empty">
          <ShieldAlert />
          <div><strong>Entre para jogar com amigos</strong><p>{bootstrap.source === "supabase-unavailable" ? "Sua sessão existe, mas a fundação remota não respondeu. Nenhuma batalha local será apresentada como PVP real." : "Use sua conta Google, adicione outro jogador e envie um desafio."}</p><LoginDialog prominent label="Entrar com Google" /></div>
        </div>
      </section>
    );
  }

  const pending = challenges.filter((challenge) => challenge.status === "pending");
  const incoming = pending.filter((challenge) => challenge.addressee_id === playerId);
  const outgoing = pending.filter((challenge) => challenge.requester_id === playerId);
  const active = challenges.filter((challenge) => challenge.status === "accepted" && challenge.battle_id);

  return (
    <section className="content-view pvp-view">
      <header className="view-heading">
        <div><span className="view-eyebrow">Duelo online</span><h1>Salão dos Cartógrafos</h1><p>Convites entre amigos, equipes congeladas ao aceitar e cada jogada confirmada pelo servidor.</p></div>
        <Badge className="border-emerald-300/30 bg-emerald-300/10 text-emerald-200"><Radio /> Sincronização ativa</Badge>
      </header>

      {error ? <div className="pvp-error" role="alert">{error}</div> : null}
      {loading ? <div className="pvp-empty"><LoaderCircle className="animate-spin" /><strong>Consultando desafios...</strong></div> : null}

      {!loading ? <FriendManager onChanged={() => void refresh()} /> : null}

      {!loading ? (
        <div className="pvp-columns">
          <article className="pvp-panel">
            <div className="pvp-panel__heading"><Swords /><div><strong>Convites recebidos</strong><span>{incoming.length} aguardando resposta</span></div></div>
            {incoming.map((challenge) => (
              <div className="pvp-row" key={challenge.id}>
                <div><strong>Desafio de amigo</strong><span><Clock3 /> expira às {new Date(challenge.expires_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></div>
                <div className="pvp-row__actions">
                  <Button size="sm" variant="game" disabled={busyId === challenge.id} onClick={() => void respond(challenge.id, "accept")}><Check /> Aceitar</Button>
                  <Button size="sm" variant="secondary" disabled={busyId === challenge.id} onClick={() => void respond(challenge.id, "decline")}><X /> Recusar</Button>
                </div>
              </div>
            ))}
            {incoming.length === 0 ? <p className="pvp-panel__empty">Nenhum convite pendente.</p> : null}
          </article>

          <article className="pvp-panel">
            <div className="pvp-panel__heading"><Radio /><div><strong>Partidas confirmadas</strong><span>{active.length} salas no histórico recente</span></div></div>
            {active.map((challenge) => (
              <div className="pvp-row" key={challenge.id}>
                <div><strong>Duelo #{challenge.battle_id?.slice(0, 8)}</strong><span>Estado persistido no servidor</span></div>
                <Button size="sm" variant="game" onClick={() => onOpenBattle(challenge.battle_id!)}>Abrir duelo</Button>
              </div>
            ))}
            {active.length === 0 ? <p className="pvp-panel__empty">Nenhuma sala confirmada.</p> : null}
          </article>
        </div>
      ) : null}

      {!loading ? (
        <article className="pvp-panel pvp-panel--wide">
          <div className="pvp-panel__heading"><Swords /><div><strong>Amigos disponíveis</strong><span>Ambos precisam de equipe ativa com seis criaturas</span></div></div>
          {friends.map((friend) => {
            const sent = outgoing.find((challenge) => challenge.addressee_id === friend.id);
            return (
              <div className="pvp-row" key={friend.id}>
                <div><strong>{friend.name}</strong><span>{friend.hasActiveTeam ? "Equipe pronta" : "Equipe incompleta"}</span></div>
                {sent ? (
                  <Button size="sm" variant="secondary" disabled={busyId === sent.id} onClick={() => void respond(sent.id, "cancel")}><X /> Cancelar convite</Button>
                ) : (
                  <Button size="sm" variant="game" disabled={!friend.hasActiveTeam || busyId === friend.id} onClick={() => void createChallenge(friend.id)}><Swords /> Desafiar</Button>
                )}
              </div>
            );
          })}
          {friends.length === 0 ? <p className="pvp-panel__empty">Nenhum amigo aceito foi encontrado. O salão não permite desafiar contas aleatórias.</p> : null}
        </article>
      ) : null}
    </section>
  );
}
