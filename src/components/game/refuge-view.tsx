"use client";

import Image from "next/image";
import {
  Armchair,
  BookOpen,
  Flower2,
  Lightbulb,
  Lock,
  Map,
  Move,
  PackageOpen,
  PawPrint,
  RotateCw,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { CREATURE_BY_ID } from "@/game/catalog";
import type { ProgressSource, RemotePlayerSnapshot } from "@/game/player";
import {
  DEFAULT_REFUGE_FURNITURE,
  REFUGE_FURNITURE_KEYS,
  REFUGE_THEMES,
  isRefugeFurnitureKey,
  isRefugeFurnitureUnlocked,
  isRefugeTheme,
  resolveRefugeResident,
  type RefugeFurnitureKey,
  type RefugeFurniturePlacement,
  type RefugeSavePayload,
  type RefugeTheme,
} from "@/game/refuge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PixelCreature } from "./pixel-creature";

type RefugeHouse = RemotePlayerSnapshot["house"];

type RefugeViewProps = {
  ownedCatalogIds?: string[];
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
  if (itemKey === "armchair") return <Armchair />;
  if (itemKey === "lamp") return <Lightbulb />;
  if (itemKey === "plant") return <Flower2 />;
  if (itemKey === "books") return <BookOpen />;
  if (itemKey === "chest") return <PackageOpen />;
  return <Map />;
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
  ownedCatalogIds = [],
  ownedItemKeys = [],
  house = null,
  savedLayout,
  source = "local",
  onSave,
}: RefugeViewProps) {
  const ownedCreatures = useMemo(
    () => ownedCatalogIds
      .map((id) => CREATURE_BY_ID.get(id))
      .filter((creature): creature is NonNullable<typeof creature> => Boolean(creature)),
    [ownedCatalogIds],
  );
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [companionId, setCompanionId] = useState<string | null>(() =>
    resolveRefugeResident(house?.layout?.residentCreatureId ?? savedLayout?.companionId, ownedCatalogIds));
  const [theme, setTheme] = useState<RefugeTheme>(() => resolveTheme(house, savedLayout));
  const [furniture, setFurniture] = useState<RefugeFurniturePlacement[]>(() => parseFurniture(house, savedLayout));
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [status, setStatus] = useState("");


  const companion = companionId && ownedCatalogIds.includes(companionId)
    ? CREATURE_BY_ID.get(companionId)
    : undefined;
  const selectedFurniture = furniture.find((item) => item.id === selectedFurnitureId) ?? null;
  const canPersist = Boolean(onSave);

  function resetDraft() {
    setCompanionId(resolveRefugeResident(house?.layout?.residentCreatureId ?? savedLayout?.companionId, ownedCatalogIds));
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
    setStatus(`${FURNITURE_LABELS[itemKey]} adicionado. Clique no chão para posicionar.`);
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

  async function saveRefuge() {
    if (!onSave || !canPersist) return;
    setSaving(true);
    setStatus("");
    try {
      await onSave({ companionId, theme, furniture });
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
          <span className="view-eyebrow">Hub pessoal</span>
          <h1>Refúgio do Cartógrafo</h1>
          <p>Escolha uma lenda da sua coleção e personalize a casa que acompanha sua jornada.</p>
        </div>
        {editing ? (
          <Button variant="secondary" onClick={cancelEditing} disabled={saving}><X /> Cancelar</Button>
        ) : (
          <Button variant="secondary" onClick={startEditing}><Armchair /> Decorar</Button>
        )}
      </header>

      <div
        className={cn("refuge-room", `refuge-room--${theme}`, editing && "is-editing")}
        onPointerDown={placeSelected}
      >
        <Image
          src="/art/refuge-pixel.png"
          alt="Refúgio de cartógrafo em pixel art, com mapas, estantes, mesa e lareira"
          fill
          priority
          sizes="(max-width: 768px) 100vw, calc(100vw - 300px)"
          className="refuge-room__art object-cover [image-rendering:pixelated]"
        />
        <div className="refuge-room__tone" />

        {companion ? (
          <div className="refuge-companion">
            <PixelCreature sprite={companion.sprite} label={`${companion.name} descansando no refúgio`} />
            <span>{companion.name}</span>
          </div>
        ) : (
          <div className="refuge-companion-empty">
            <PawPrint />
            <span>Nenhuma lenda residente</span>
          </div>
        )}

        {furniture.map((item) => (
          <button
            type="button"
            key={item.id}
            className={cn(
              "refuge-furniture",
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
              if (editing) setSelectedFurnitureId(item.id);
            }}
            onClick={(event) => event.preventDefault()}
            tabIndex={editing ? 0 : -1}
            aria-label={`${FURNITURE_LABELS[item.itemKey]} no Refúgio`}
          >
            <FurnitureIcon itemKey={item.itemKey} />
          </button>
        ))}

        {editing ? (
          <div className="refuge-placement-hint">
            <Move />
            <span>{selectedFurniture ? "Clique no chão para mover o móvel selecionado" : "Escolha um móvel para posicionar"}</span>
          </div>
        ) : null}
      </div>

      {editing ? (
        <div className="refuge-editor">
          <section className="refuge-editor__section">
            <div className="refuge-editor__title"><PawPrint /><div><strong>Lenda residente</strong><span>Apenas cartas que você realmente possui aparecem aqui.</span></div></div>
            <div className="refuge-creature-picker">
              <button
                type="button"
                className={cn("refuge-creature-choice", companionId === null && "is-selected")}
                onClick={() => setCompanionId(null)}
              >
                <span className="refuge-creature-choice__empty"><PawPrint /></span>
                <strong>Nenhuma</strong>
              </button>
              {ownedCreatures.map((creature) => (
                <button
                  type="button"
                  key={creature.id}
                  className={cn("refuge-creature-choice", companionId === creature.id && "is-selected")}
                  onClick={() => setCompanionId(creature.id)}
                >
                  <PixelCreature sprite={creature.sprite} label="" />
                  <strong>{creature.name}</strong>
                </button>
              ))}
            </div>
            {ownedCreatures.length === 0 ? <small className="refuge-editor__note">Encontre sua primeira lenda para poder colocá-la no Refúgio.</small> : null}
          </section>

          <section className="refuge-editor__section">
            <div className="refuge-editor__title"><Sparkles /><div><strong>Estilo da casa</strong><span>Mude a atmosfera do mesmo Refúgio.</span></div></div>
            <div className="refuge-theme-picker">
              {REFUGE_THEMES.map((themeId) => (
                <button
                  type="button"
                  key={themeId}
                  className={cn("refuge-theme-choice", theme === themeId && "is-selected")}
                  onClick={() => setTheme(themeId)}
                >
                  <strong>{THEME_META[themeId].label}</strong>
                  <span>{THEME_META[themeId].description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="refuge-editor__section">
            <div className="refuge-editor__title"><Armchair /><div><strong>Móveis</strong><span>Os móveis especiais são cosméticos adquiridos no Mercador.</span></div></div>
            <div className="refuge-furniture-palette">
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
              {status ? <span>{status}</span> : null}
            </div>
            <Button onClick={() => void saveRefuge()} disabled={!canPersist || saving}>
              <Save /> {saving ? "Salvando..." : "Salvar Refúgio"}
            </Button>
          </footer>
        </div>
      ) : (
        <div className="refuge-status">
          <Badge>{companion ? `Residente: ${companion.name}` : "Sem lenda residente"}</Badge>
          <p><Lock /> O Refúgio usa somente criaturas da sua coleção. A decoração é individual para cada conta.</p>
          {status ? <p className="refuge-status__message">{status}</p> : null}
        </div>
      )}
    </section>
  );
}
