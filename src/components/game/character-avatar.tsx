"use client";

import { Check, LockKeyhole, Save, Shield, Shirt, Sparkles, UserRound } from "lucide-react";
import { useState } from "react";
import {
  DEFAULT_AVATAR_CONFIG,
  type AvatarConfig,
} from "@/game/save/local-progress";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const choices = {
  skin: [
    { id: "amber", label: "Âmbar" },
    { id: "copper", label: "Cobre" },
    { id: "umber", label: "Terra" },
    { id: "rose", label: "Rosa" },
  ],
  hair: [
    { id: "braids", label: "Tranças" },
    { id: "short", label: "Curto" },
    { id: "waves", label: "Ondas" },
    { id: "mohawk", label: "Crista" },
  ],
  outfit: [
    { id: "traveler", label: "Viajante" },
    { id: "scholar", label: "Estudioso" },
    { id: "ranger", label: "Mateiro" },
    { id: "merchant", label: "Mercador" },
  ],
  armor: [
    { id: "none", label: "Sem armadura", item: null },
    { id: "leather", label: "Couro", item: "leather" },
    { id: "runic", label: "Rúnica", item: "runic-armor" },
    { id: "guardian", label: "Guardiã", item: "guardian-armor" },
  ],
  accent: [
    { id: "gold", label: "Ouro" },
    { id: "emerald", label: "Esmeralda" },
    { id: "azure", label: "Azur" },
    { id: "crimson", label: "Carmesim" },
  ],
} as const;

type ChoiceKey = keyof AvatarConfig;

export function CharacterAvatar2D({
  config = DEFAULT_AVATAR_CONFIG,
  compact = false,
}: {
  config?: AvatarConfig;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "character-avatar-2d",
        compact && "character-avatar-2d--compact",
        `character-avatar-2d--skin-${config.skin}`,
        `character-avatar-2d--hair-${config.hair}`,
        `character-avatar-2d--outfit-${config.outfit}`,
        `character-avatar-2d--armor-${config.armor}`,
        `character-avatar-2d--accent-${config.accent}`,
      )}
      role="img"
      aria-label="Personagem cartógrafo em pixel art 2D"
    >
      <span className="avatar-shadow" />
      <span className="avatar-cape" />
      <span className="avatar-leg avatar-leg--left" />
      <span className="avatar-leg avatar-leg--right" />
      <span className="avatar-body" />
      <span className="avatar-arm avatar-arm--left" />
      <span className="avatar-arm avatar-arm--right" />
      <span className="avatar-neck" />
      <span className="avatar-head" />
      <span className="avatar-ear avatar-ear--left" />
      <span className="avatar-ear avatar-ear--right" />
      <span className="avatar-hair" />
      <span className="avatar-eye avatar-eye--left" />
      <span className="avatar-eye avatar-eye--right" />
      <span className="avatar-armor" />
      <span className="avatar-belt" />
      <span className="avatar-buckle" />
      <span className="avatar-boots" />
    </div>
  );
}

export function CharacterCreator2D({
  initial,
  ownedEquipment,
  onSave,
}: {
  initial?: AvatarConfig;
  ownedEquipment: string[];
  onSave: (config: AvatarConfig) => Promise<void> | void;
}) {
  const [config, setConfig] = useState(initial ?? DEFAULT_AVATAR_CONFIG);
  const [tab, setTab] = useState<ChoiceKey>("skin");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave(config);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } finally {
      setSaving(false);
    }
  }

  const tabIcons: Record<ChoiceKey, typeof UserRound> = {
    skin: UserRound,
    hair: Sparkles,
    outfit: Shirt,
    armor: Shield,
    accent: Sparkles,
  };
  const tabLabels: Record<ChoiceKey, string> = {
    skin: "Pele",
    hair: "Cabelo",
    outfit: "Roupa",
    armor: "Armadura",
    accent: "Cor",
  };

  return (
    <section className="character-creator" aria-labelledby="character-creator-title">
      <div className="character-creator__preview">
        <span className="view-eyebrow">Personagem 2D</span>
        <h2 id="character-creator-title">Seu Cartógrafo</h2>
        <CharacterAvatar2D config={config} />
        <p>Roupas e armaduras especiais aparecem em baús das regiões.</p>
      </div>
      <div className="character-creator__book">
        <nav className="character-creator__tabs" aria-label="Categorias do personagem">
          {(Object.keys(tabLabels) as ChoiceKey[]).map((key) => {
            const Icon = tabIcons[key];
            return (
              <button key={key} type="button" className={cn(tab === key && "is-active")} onClick={() => setTab(key)}>
                <Icon /> <span>{tabLabels[key]}</span>
              </button>
            );
          })}
        </nav>
        <div className="character-creator__choices">
          {choices[tab].map((choice) => {
            const equipment = "item" in choice ? choice.item : null;
            const locked = Boolean(equipment && !ownedEquipment.includes(equipment));
            const active = config[tab] === choice.id;
            return (
              <button
                key={choice.id}
                type="button"
                disabled={locked}
                className={cn(active && "is-active", locked && "is-locked")}
                onClick={() => setConfig((current) => ({ ...current, [tab]: choice.id }))}
              >
                <span className="character-choice__swatch" data-value={choice.id} />
                <strong>{choice.label}</strong>
                {locked ? <small><LockKeyhole /> Encontrada em baús</small> : active ? <Check /> : null}
              </button>
            );
          })}
        </div>
        <Button type="button" variant="game" size="lg" onClick={() => void save()} disabled={saving}>
          {saved ? <Check /> : <Save />} {saved ? "Personagem salvo" : saving ? "Salvando..." : "Salvar personagem"}
        </Button>
      </div>
    </section>
  );
}
