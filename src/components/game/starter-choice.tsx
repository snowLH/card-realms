"use client";

import { Check, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CREATURE_BY_ID, ELEMENT_META } from "@/game/catalog";
import { Button } from "@/components/ui/button";
import { CreatureCard } from "./creature-card";

const STARTER_IDS = ["boitata", "iara", "curupira"] as const;

export function StarterChoice() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<(typeof STARTER_IDS)[number] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirmChoice() {
    if (!selectedId || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/player/progress", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "choose_starter", creatureId: selectedId }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível vincular sua carta.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível concluir a escolha.");
      setBusy(false);
    }
  }

  return (
    <div className="starter-overlay" role="dialog" aria-modal="true" aria-labelledby="starter-title">
      <section className="starter-choice">
        <header className="starter-choice__header">
          <span className="starter-choice__mark"><Sparkles /></span>
          <div>
            <span className="view-eyebrow">Coleção de Aurória</span>
            <h1 id="starter-title">Conheça os seres do folclore</h1>
            <p>
              Estas criaturas fazem parte da sua coleção. Seu personagem é o avatar,
              e os dois poderes iniciais ficam disponíveis no Arquivo da Guilda.
            </p>
          </div>
        </header>

        <div className="starter-choice__grid">
          {STARTER_IDS.map((id) => {
            const creature = CREATURE_BY_ID.get(id)!;
            const element = ELEMENT_META[creature.element];
            const selected = selectedId === id;
            return (
              <div className="starter-option" key={id}>
                <button
                  type="button"
                  className={selected ? "starter-option__select is-selected" : "starter-option__select"}
                  onClick={() => setSelectedId(id)}
                  aria-pressed={selected}
                  disabled={busy}
                >
                  <CreatureCard creature={creature} />
                  <span className="starter-option__footer">
                    <span>
                      <small>{element.name}</small>
                      <strong>{selected ? "Sua escolha" : "Escolher"}</strong>
                    </span>
                    {selected ? <Check /> : <ShieldCheck />}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <footer className="starter-choice__footer">
          <p>
            {selectedId
              ? `${CREATURE_BY_ID.get(selectedId)!.name} será a primeira criatura da sua coleção.`
              : "Selecione uma carta para conhecer seus atributos e adicioná-la à coleção."}
          </p>
          <Button size="lg" onClick={confirmChoice} disabled={!selectedId || busy}>
            {busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
            Adicionar à coleção
          </Button>
        </footer>

        {error ? <p className="starter-choice__error">{error}</p> : null}
      </section>
    </div>
  );
}


