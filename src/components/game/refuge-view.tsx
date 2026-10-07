"use client";

import Image from "next/image";
import {
  Lock,
  Move,
  RotateCw,
  Save,
  Sparkles,
  Trash2,
  X,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import type { ProgressSource, RemotePlayerSnapshot } from "@/game/player";
import type { AvatarConfig } from "@/game/save/local-progress";
import {
  DEFAULT_REFUGE_FURNITURE,
  REFUGE_FURNITURE_KEYS,
  REFUGE_THEMES,
  isRefugeFurnitureKey,
  isRefugeFurnitureUnlocked,
  isRefugeTheme,
  type RefugeFurnitureKey,
  type RefugeFurniturePlacement,
  type RefugeSavePayload,
  type RefugeTheme,
} from "@/game/refuge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CharacterAvatar2D } from "./character-avatar";
import { RefugeFurnitureSprite } from "./refuge-furniture-sprite";
import styles from "./refuge-view.module.css";

type RefugeHouse = RemotePlayerSnapshot["house"];

type RefugeViewProps = {
  avatarConfig: AvatarConfig;
  ownedItemKeys?: string[];
  house?: RefugeHouse;
  savedLayout?: RefugeSavePayload;
  source?: ProgressSource;
  onSave?: (payload: RefugeSavePayload) => Promise<void>;
};

const THEME_META: Record<RefugeTheme, { label: string; description: string }> = {
  cartographer: { label: "Cartógrafo", description: "Madeira quente, mapas e luz de lareira." },
  forest: { label: "Bosque", description: "Tons verdes e atmosfera de floresta antiga." },
  moonlit: { label: "Luar", description: "Azuis frios e iluminação noturna." },
};

const FURNITURE_LABELS: Record<RefugeFurnitureKey, string> = {
  armchair: "Poltrona",
  lamp: "Luminária",
  plant: "Planta",
  books: "Livros",
  chest: "Baú",
  "map-stand": "Mapa",
};

function FurnitureIcon({ itemKey }: { itemKey: RefugeFurnitureKey }) {
  return <RefugeFurnitureSprite itemKey={itemKey} className={styles.furnitureSprite} />;
}

function parseFurniture(house: RefugeHouse, savedLayout?: RefugeSavePayload): RefugeFurniturePlacement[] {
  const raw = house?.layout?.furniture;
  if (!Array.isArray(raw)) {
    return (savedLayout?.furniture ?? DEFAULT_REFUGE_FURNITURE).map((item) => ({ ...item }));
  }

  return raw.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const value = entry as Record<string, unknown>;
    if (!isRefugeFurnitureKey(value.itemKey)) return [];
    const x = typeof value.x === "number" ? Math.min(92, Math.max(8, value.x)) : 50;
    const y = typeof value.y === "number" ? Math.min(88, Math.max(24, value.y)) : 65;
    const rotation = value.rotation === 90 || value.rotation === 180 || value.rotation === 270
      ? value.rotation
      : 0;
    return [{
      id: typeof value.id === "string" && value.id ? value.id : `saved-${value.itemKey}-${index}`,
      itemKey: value.itemKey,
      x,
      y,
      rotation,
    }];
  });
}

function resolveTheme(house: RefugeHouse, savedLayout?: RefugeSavePayload): RefugeTheme {
  if (isRefugeTheme(house?.theme)) return house.theme;
  return savedLayout?.theme ?? "cartographer";
}

function nextRotation(rotation: RefugeFurniturePlacement["rotation"]) {
  if (rotation === 0) return 90;
  if (rotation === 90) return 180;
  if (rotation === 180) return 270;
  return 0;
}

export function RefugeView({
  avatarConfig,
  ownedItemKeys = [],
  house = null,
  savedLayout,
  source = "local",
  onSave,
}: RefugeViewProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState<RefugeTheme>(() => resolveTheme(house, savedLayout));
  const [furniture, setFurniture] = useState<RefugeFurniturePlacement[]>(() => parseFurniture(house, savedLayout));
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [status, setStatus] = useState("");


  const selectedFurniture = furniture.find((item) => item.id === selectedFurnitureId) ?? null;
  const canPersist = Boolean(onSave);

  function resetDraft() {
    setTheme(resolveTheme(house, savedLayout));
    setFurniture(parseFurniture(house, savedLayout));
    setSelectedFurnitureId(null);
    setStatus("");
  }

  function startEditing() {
    resetDraft();
    setEditing(true);
  }

  function cancelEditing() {
    resetDraft();
    setEditing(false);
  }

  function addFurniture(itemKey: RefugeFurnitureKey) {
    if (!isRefugeFurnitureUnlocked(itemKey, ownedItemKeys)) {
      setStatus("Este móvel cosmético pode ser adquirido no Mercador da Guilda.");
      return;
    }
    if (furniture.length >= 12) {
      setStatus("O Refúgio comporta até 12 móveis decorativos por enquanto.");
      return;
    }
    const id = `${itemKey}-${crypto.randomUUID()}`;
    const count = furniture.length;
    const next: RefugeFurniturePlacement = {
      id,
      itemKey,
      x: 42 + ((count * 9) % 38),
      y: 60 + ((count * 7) % 20),
      rotation: 0,
    };
    setFurniture((current) => [...current, next]);
    setSelectedFurnitureId(id);
    setStatus(`${FURNITURE_LABELS[itemKey]} adicionado e selecionado. Use as setas para posicionar ou clique/toque no chão.`);
  }

  function selectFurniture(item: RefugeFurniturePlacement) {
    setSelectedFurnitureId(item.id);
    setStatus(`${FURNITURE_LABELS[item.itemKey]} selecionado. Use as setas para ajustar a posição ou clique/toque no chão.`);
  }

  function placeSelected(event: ReactPointerEvent<HTMLDivElement>) {
    if (!editing || !selectedFurnitureId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.min(92, Math.max(8, ((event.clientX - bounds.left) / bounds.width) * 100));
    const y = Math.min(88, Math.max(24, ((event.clientY - bounds.top) / bounds.height) * 100));
    setFurniture((current) => current.map((item) =>
      item.id === selectedFurnitureId ? { ...item, x, y } : item
    ));
  }

  function moveSelectedWithKeyboard(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!editing || !selectedFurnitureId || !selectedFurniture) return;
    const movements: Record<string, { x: number; y: number }> = {
      ArrowUp: { x: 0, y: -2 },
      ArrowRight: { x: 2, y: 0 },
      ArrowDown: { x: 0, y: 2 },
      ArrowLeft: { x: -2, y: 0 },
    };
    const movement = movements[event.key];
    if (!movement) return;

    event.preventDefault();
    const nextX = Math.min(92, Math.max(8, selectedFurniture.x + movement.x));
    const nextY = Math.min(88, Math.max(24, selectedFurniture.y + movement.y));
    setFurniture((current) => current.map((item) => item.id === selectedFurnitureId
      ? {
          ...item,
          x: nextX,
          y: nextY,
        }
      : item
    ));
    setStatus(`${FURNITURE_LABELS[selectedFurniture.itemKey]} selecionado. Posição ${Math.round(nextX)}% horizontal, ${Math.round(nextY)}% vertical. Continue com as setas para ajustar.`);
  }

  async function saveRefuge() {
    if (!onSave || !canPersist) return;
    setSaving(true);
    setStatus("");
    try {
      // `companionId` remains in the persisted contract for old saves, but new
      // Refuge layouts no longer assign folklore creatures as residents.
      await onSave({ companionId: null, theme, furniture });
      setEditing(false);
      setSelectedFurnitureId(null);
      setStatus(source === "supabase" ? "Refúgio salvo na sua conta." : "Refúgio salvo neste aparelho.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível salvar o Refúgio.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="content-view refuge-view">
      <header className="view-heading">
        <div>
          <span className="view-eyebrow">Base pessoal</span>
          <h1>Meu Refúgio</h1>
          <p>Personalize sua casa e reencontre sua Lenda ativa entre as expedições.</p>
        </div>
        {editing ? (
          <Button variant="secondary" onClick={cancelEditing} disabled={saving}><X /> Cancelar</Button>
        ) : (
          <Button variant="secondary" onClick={startEditing}><FurnitureIcon itemKey="armchair" /> Decorar</Button>
        )}
      </header>

      <div
        className={cn("refuge-room", `refuge-room--${theme}`, editing && "is-editing")}
        onPointerDown={placeSelected}
        onKeyDown={moveSelectedWithKeyboard}
        role="group"
        aria-label="Cena do Refúgio"
        aria-describedby={editing ? "refuge-placement-hint" : undefined}
        tabIndex={editing ? 0 : -1}
      >
        <Image
          src="/art/refuge-pixel-v2.webp"
          alt="Refúgio de cartógrafo em pixel art, com mapas, estantes, mesa e lareira"
          fill
          priority
          sizes="(max-width: 768px) 100vw, calc(100vw - 300px)"
          className="refuge-room__art object-cover [image-rendering:pixelated]"
        />
        <div className="refuge-room__tone" />
        <div className={styles.setDressing} aria-hidden="true">
          <span className={styles.rug} />
          <span className={styles.restBench} />
          <span className={styles.relicStand} />
          <span className={styles.travelChest} />
        </div>

        <div className={styles.avatar}>
          <CharacterAvatar2D config={avatarConfig} idleStrip ariaLabel="Sua Lenda ativa no Refúgio" />
          <span className={styles.avatarLabel}>Lenda ativa</span>
        </div>

        {furniture.map((item) => (
          <button
            type="button"
            key={item.id}
            className={cn(
              "refuge-furniture",
              styles.furniture,
              editing && "is-editable",
              selectedFurnitureId === item.id && "is-selected",
            )}
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              if (editing) selectFurniture(item);
            }}
            onClick={() => {
              if (editing) selectFurniture(item);
            }}
            tabIndex={editing ? 0 : -1}
            aria-label={`${FURNITURE_LABELS[item.itemKey]} no Refúgio`}
            aria-pressed={selectedFurnitureId === item.id}
          >
            <FurnitureIcon itemKey={item.itemKey} />
          </button>
        ))}

        {editing ? (
          <div className="refuge-placement-hint">
            <Move aria-hidden="true" />
            <span id="refuge-placement-hint">{selectedFurniture
              ? "Use as setas para mover o móvel selecionado em passos pequenos, ou clique/toque no chão para posicioná-lo"
              : "Escolha um móvel para posicionar; depois use as setas ou clique/toque no chão"}</span>
          </div>
        ) : null}
      </div>

      {editing ? (
        <div className="refuge-editor">
          <section className="refuge-editor__section">
            <div className="refuge-editor__title"><UserRound /><div><strong>Lenda ativa</strong><span>A Lenda escolhida na Guilda acompanha você em casa e nas expedições.</span></div></div>
          </section>

          <section className="refuge-editor__section">
            <div className="refuge-editor__title"><Sparkles /><div><strong>Estilo da casa</strong><span>Mude a atmosfera do mesmo Refúgio.</span></div></div>
            <div className="refuge-theme-picker">
              {REFUGE_THEMES.map((themeId) => (
                <button
                  type="button"
                  key={themeId}
                  className={cn("refuge-theme-choice", theme === themeId && "is-selected")}
                  aria-pressed={theme === themeId}
                  onClick={() => setTheme(themeId)}
                >
                  <strong>{THEME_META[themeId].label}</strong>
                  <span>{THEME_META[themeId].description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="refuge-editor__section">
            <div className="refuge-editor__title"><FurnitureIcon itemKey="armchair" /><div><strong>Móveis</strong><span>Os móveis especiais são cosméticos adquiridos no Mercador.</span></div></div>
            <div className={cn("refuge-furniture-palette", styles.furniturePalette)}>
              {REFUGE_FURNITURE_KEYS.map((itemKey) => {
                const unlocked = isRefugeFurnitureUnlocked(itemKey, ownedItemKeys);
                return (
                  <button type="button" key={itemKey} disabled={!unlocked} onClick={() => addFurniture(itemKey)}>
                    <FurnitureIcon itemKey={itemKey} />
                    <span>{FURNITURE_LABELS[itemKey]}{unlocked ? "" : " · Mercador"}</span>
                  </button>
                );
              })}
            </div>

            {selectedFurniture ? (
              <div className="refuge-selected-tools">
                <strong>{FURNITURE_LABELS[selectedFurniture.itemKey]}</strong>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setFurniture((current) => current.map((item) =>
                    item.id === selectedFurniture.id
                      ? { ...item, rotation: nextRotation(item.rotation) }
                      : item
                  ))}
                >
                  <RotateCw /> Girar
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setFurniture((current) => current.filter((item) => item.id !== selectedFurniture.id));
                    setSelectedFurnitureId(null);
                  }}
                >
                  <Trash2 /> Remover
                </Button>
              </div>
            ) : null}
          </section>

          <footer className="refuge-editor__footer">
            <div>
              <strong>{source === "supabase" ? "Alterações serão salvas na sua conta." : "Alterações serão salvas neste aparelho."}</strong>
              {status ? <span role="status" aria-live="polite">{status}</span> : null}
            </div>
            <Button onClick={() => void saveRefuge()} disabled={!canPersist || saving}>
              <Save /> {saving ? "Salvando..." : "Salvar Refúgio"}
            </Button>
          </footer>
        </div>
      ) : (
        <div className="refuge-status">
          <Badge>Casa personalizada</Badge>
          <p><Lock /> Sua Lenda ativa descansa aqui entre as expedições. A decoração é individual para cada conta.</p>
          {status ? <p className="refuge-status__message">{status}</p> : null}
        </div>
      )}
    </section>
  );
}
