"use client";

import { Check, LoaderCircle, Search, UserPlus, Users, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Player = { id: string; username: string; displayName: string };
type Friendship = {
  id: string;
  direction: "incoming" | "outgoing";
  status: "pending" | "accepted" | "blocked";
  player: Player;
  createdAt: string;
};

export function FriendManager({ onChanged }: { onChanged: () => void }) {
  const [query, setQuery] = useState("");
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [results, setResults] = useState<Player[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async (search = "") => {
    const response = await fetch(`/api/pvp/friends${search.length >= 3 ? `?q=${encodeURIComponent(search)}` : ""}`, { cache: "no-store" });
    const payload = (await response.json()) as { friendships?: Friendship[]; results?: Player[]; error?: string };
    if (!response.ok) throw new Error(payload.error ?? "A lista de amigos não respondeu.");
    setFriendships(payload.friendships ?? []);
    setResults(payload.results ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(query).catch((error) => {
        setMessage(error instanceof Error ? error.message : "A lista de amigos não respondeu.");
        setLoading(false);
      });
    }, query ? 350 : 0);
    return () => window.clearTimeout(timer);
  }, [load, query]);

  async function send(addresseeId: string) {
    setBusy(addresseeId);
    setMessage("");
    try {
      const response = await fetch("/api/pvp/friends", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ addresseeId }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "A solicitação não pôde ser enviada.");
      setMessage("Solicitação enviada.");
      setQuery("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "A solicitação não pôde ser enviada.");
    } finally {
      setBusy(null);
    }
  }

  async function respond(friendshipId: string, responseType: "accept" | "block") {
    setBusy(friendshipId);
    setMessage("");
    try {
      const response = await fetch("/api/pvp/friends", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ friendshipId, response: responseType }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "A resposta não pôde ser salva.");
      await load();
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "A resposta não pôde ser salva.");
    } finally {
      setBusy(null);
    }
  }

  const incoming = friendships.filter((entry) => entry.status === "pending" && entry.direction === "incoming");
  const accepted = friendships.filter((entry) => entry.status === "accepted");
  const outgoing = friendships.filter((entry) => entry.status === "pending" && entry.direction === "outgoing");

  return (
    <article className="pvp-panel pvp-panel--wide friend-manager">
      <div className="pvp-panel__heading"><Users /><div><strong>Amigos</strong><span>Procure pelo nome de viajante e envie uma solicitação</span></div></div>
      <label className="friend-search">
        <Search />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome ou @usuário (mínimo 3 letras)" aria-label="Procurar jogador" />
        {loading ? <LoaderCircle className="animate-spin" /> : null}
      </label>
      {results.map((player) => (
        <div className="pvp-row" key={player.id}>
          <div><strong>{player.displayName}</strong><span>@{player.username}</span></div>
          <Button size="sm" variant="game" disabled={busy === player.id} onClick={() => void send(player.id)}><UserPlus /> Adicionar</Button>
        </div>
      ))}
      {incoming.map((entry) => (
        <div className="pvp-row friend-request" key={entry.id}>
          <div><strong>{entry.player.displayName}</strong><span>@{entry.player.username} quer ser seu amigo</span></div>
          <div className="pvp-row__actions">
            <Button size="sm" variant="game" disabled={busy === entry.id} onClick={() => void respond(entry.id, "accept")}><Check /> Aceitar</Button>
            <Button size="sm" variant="secondary" disabled={busy === entry.id} onClick={() => void respond(entry.id, "block")}><X /> Bloquear</Button>
          </div>
        </div>
      ))}
      <div className="friend-roster">
        {accepted.map((entry) => <span key={entry.id}><Users /> {entry.player.displayName} <small>@{entry.player.username}</small></span>)}
        {outgoing.map((entry) => <span className="is-pending" key={entry.id}><UserPlus /> {entry.player.displayName} <small>aguardando</small></span>)}
      </div>
      {!loading && !query && friendships.length === 0 ? <p className="pvp-panel__empty">Sua lista ainda está vazia. Procure uma conta para começar.</p> : null}
      {message ? <p className="friend-message" role="status">{message}</p> : null}
    </article>
  );
}
