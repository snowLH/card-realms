"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Crown,
  LoaderCircle,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { CREATURE_BY_ID, ELEMENT_META } from "@/game/catalog";
import type { ProgressSource, RemotePlayerSnapshot } from "@/game/player";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PixelCreature } from "./pixel-creature";

type OwnedCreature = RemotePlayerSnapshot["collection"][number];
type TeamSnapshot = RemotePlayerSnapshot["teams"][number];

export function TeamView({
  team,
  collection,
  source,
  onSave,
}: {
  team?: TeamSnapshot | null;
  collection: OwnedCreature[];
  source: ProgressSource;
  onSave?: (memberIds: string[], name: string) => Promise<void>;
}) {
  const initialMembers = useMemo(
    () => team?.members.slice().sort((a, b) => a.slot - b.slot).map((member) => member.playerCreatureId) ?? [],
    [team],
  );
  const [members, setMembers] = useState<string[]>(initialMembers);
  const [name, setName] = useState(team?.name ?? "Equipe principal");
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");


  const ownedById = useMemo(
    () => new Map(collection.map((creature) => [creature.instanceId, creature])),
    [collection],
  );
  const changed = name.trim() !== (team?.name ?? "Equipe principal")
    || members.length !== initialMembers.length
    || members.some((id, index) => id !== initialMembers[index]);

  function chooseCreature(instanceId: string) {
    if (members.includes(instanceId) && members[selectedSlot ?? -1] !== instanceId) {
      setMessage("Essa carta já está em outro espaço da equipe.");
      return;
    }
    setMessage("");
    setMembers((current) => {
      const next = [...current];
      if (selectedSlot === null) {
        if (next.length >= 6) return next;
        next.push(instanceId);
      } else {
        while (next.length < selectedSlot) next.push("");
        next[selectedSlot] = instanceId;
      }
      return next.filter(Boolean).slice(0, 6);
    });
    setSelectedSlot(null);
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= members.length) return;
    setMembers((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function remove(index: number) {
    setMembers((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setSelectedSlot(null);
  }

  async function save() {
    if (!onSave) return;
    if (members.length < 1) {
      setMessage("Sua equipe precisa ter pelo menos uma criatura.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await onSave(members, name.trim() || "Equipe principal");
      setMessage("Equipe salva. O primeiro espaço será sua criatura inicial na batalha.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar a equipe.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="content-view team-builder-view">
      <header className="view-heading">
        <div>
          <span className="view-eyebrow">Formação ativa</span>
          <h1>Monte sua equipe</h1>
          <p>Escolha de 1 a 6 cartas da sua coleção. O espaço 1 é o líder que entra primeiro em campo.</p>
        </div>
        <div className="team-builder-actions">
          <label>
            <span>Nome</span>
            <input value={name} maxLength={60} onChange={(event) => setName(event.target.value)} />
          </label>
          <Button variant="game" disabled={!onSave || saving || !changed || members.length < 1} onClick={() => void save()}>
            {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
            Salvar equipe
          </Button>
        </div>
      </header>

      {message ? <div className="team-builder-message" role="status">{message}</div> : null}

      <div className="team-builder-slots">
        {Array.from({ length: 6 }, (_, index) => {
          const instanceId = members[index];
          const owned = instanceId ? ownedById.get(instanceId) : null;
          const definition = owned ? CREATURE_BY_ID.get(owned.catalogId) : null;
          const isSelected = selectedSlot === index;
          return (
            <article
              key={index}
              className={cn(
                "team-builder-slot",
                index === 0 && "is-leader",
                isSelected && "is-selecting",
                !definition && "is-empty",
              )}
            >
              <button
                type="button"
                className="team-builder-slot__pick"
                onClick={() => setSelectedSlot(isSelected ? null : index)}
              >
                <span className="team-builder-slot__number">
                  {index === 0 ? <Crown /> : index + 1}
                </span>
                {definition && owned ? (
                  <>
                    <PixelCreature sprite={definition.sprite} label={definition.name} />
                    <strong>{definition.name}</strong>
                    <small>
                      {ELEMENT_META[definition.element].name}
                      {owned.evolutionStage > 0 ? " · Vínculo " + owned.evolutionStage : ""}
                    </small>
                  </>
                ) : (
                  <>
                    <span className="team-builder-slot__plus">+</span>
                    <strong>Espaço vazio</strong>
                    <small>Escolher carta</small>
                  </>
                )}
              </button>

              {definition ? (
                <div className="team-builder-slot__controls">
                  <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Mover para a esquerda"><ArrowLeft /></button>
                  <button type="button" disabled={index === members.length - 1} onClick={() => move(index, 1)} aria-label="Mover para a direita"><ArrowRight /></button>
                  <button type="button" onClick={() => remove(index)} aria-label="Remover da equipe"><Trash2 /></button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="team-builder-legend">
        <span><Crown /> Líder: entra primeiro</span>
        <span><ShieldCheck /> Cada instância só pode ocupar um espaço</span>
        <span>{members.length}/6 cartas selecionadas</span>
      </div>

      <section className={cn("team-builder-collection", selectedSlot !== null && "is-open")}>
        <div className="team-builder-collection__heading">
          <div>
            <span className="view-eyebrow">
              {selectedSlot === null ? "SUA COLEÇÃO" : "ESCOLHA PARA O ESPAÇO " + (selectedSlot + 1)}
            </span>
            <strong>{collection.length} cartas disponíveis</strong>
          </div>
          {selectedSlot !== null ? <Button variant="secondary" size="sm" onClick={() => setSelectedSlot(null)}>Cancelar</Button> : null}
        </div>

        <div className="team-builder-collection__grid">
          {collection.map((owned) => {
            const definition = CREATURE_BY_ID.get(owned.catalogId);
            if (!definition) return null;
            const alreadyUsed = members.includes(owned.instanceId) && members[selectedSlot ?? -1] !== owned.instanceId;
            return (
              <button
                type="button"
                key={owned.instanceId}
                disabled={alreadyUsed || selectedSlot === null}
                className={cn("team-builder-owned-card", alreadyUsed && "is-used")}
                onClick={() => chooseCreature(owned.instanceId)}
              >
                <PixelCreature sprite={definition.sprite} label={definition.name} />
                <div>
                  <strong>{definition.name}</strong>
                  <span>{ELEMENT_META[definition.element].name} · {definition.role}</span>
                  <small>
                    {owned.evolutionStage > 0 ? "Vínculo " + owned.evolutionStage + " · " : ""}
                    Nv. {owned.level}
                  </small>
                </div>
                {alreadyUsed ? <Check /> : null}
              </button>
            );
          })}
        </div>

        {source !== "supabase" ? (
          <p className="team-builder-offline">
            Entre com sua conta para sincronizar a formação entre dispositivos.
          </p>
        ) : null}
      </section>
    </section>
  );
}
