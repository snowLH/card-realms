// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ARPG_LOADOUT } from "@/game/arpg/content/mata-encantada";
import { ARPG_WEAPONS } from "@/game/arpg/content/equipment";
import { DEFAULT_AVATAR_CONFIG } from "@/game/save/local-progress";
import { ArpgLoadoutView } from "./loadout-view";

afterEach(cleanup);

function renderLoadout(overrides: Partial<Parameters<typeof ArpgLoadoutView>[0]> = {}) {
  const props = {
    focus: "cards" as const,
    loadout: DEFAULT_ARPG_LOADOUT,
    inventoryItemKeys: [],
    ownedLegendIds: ["curupira" as const],
    coins: 500,
    avatarConfig: DEFAULT_AVATAR_CONFIG,
    pendingLegendId: null,
    onChange: vi.fn(),
    onSelectLegend: vi.fn(),
    onPurchaseLegend: vi.fn().mockResolvedValue(undefined),
    onToggleFavoriteLegend: vi.fn(),
    onBack: vi.fn(),
    onPlay: vi.fn(),
    ...overrides,
  };
  return { ...render(<ArpgLoadoutView {...props} />), props };
}

describe("ArpgLoadoutView", () => {
  it("shows exactly two signature attacks and no companion selection", () => {
    renderLoadout();

    const attacks = screen.getByRole("region", { name: "Os dois ataques de Curupira" });
    expect(within(attacks).getAllByRole("article")).toHaveLength(2);
    expect(within(attacks).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/Suportes|companheiros|Santuário/i)).not.toBeInTheDocument();
  });

  it("keeps signature attacks bundled with the selected legend", () => {
    renderLoadout();

    expect(screen.getByText(/vêm com a carta da lenda/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /comprar.*poder|comprar.*ataque/i })).not.toBeInTheDocument();
    expect(screen.getByText("Raízes do Curupira")).toBeInTheDocument();
    expect(screen.getByText("Flecha de Brasa")).toBeInTheDocument();
  });

  it("does not expose a separate power price when coins are unavailable", () => {
    renderLoadout({ coins: 0 });

    expect(screen.queryByText("Saldo disponível:")).not.toBeInTheDocument();
    expect(screen.queryByText(/Faltam \d+ moedas/i)).not.toBeInTheDocument();
  });

  it("keeps the selected legend attacks visible in Arsenal", () => {
    renderLoadout({ focus: "all" });

    expect(screen.getByText("Os dois ataques de Curupira")).toBeInTheDocument();
    expect(screen.getByText("Raízes do Curupira")).toBeInTheDocument();
    expect(screen.getByText("Flecha de Brasa")).toBeInTheDocument();
    expect(screen.queryByText("Saldo disponível:")).not.toBeInTheDocument();
  });

  it("hides legacy armor from the Arsenal while preserving it in loadout edits", () => {
    const legacyLoadout = { ...DEFAULT_ARPG_LOADOUT, armorId: "leather-armor" };
    const nextWeapon = ARPG_WEAPONS.find((weapon) => weapon.id !== legacyLoadout.weaponId)!;
    const { props } = renderLoadout({
      focus: "all",
      loadout: legacyLoadout,
      inventoryItemKeys: ["leather-armor", nextWeapon.id],
    });

    expect(screen.getByText(/entra sem armadura/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button").every((button) => !/armadura|armor/i.test(button.textContent ?? ""))).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: new RegExp(nextWeapon.name) }));
    expect(props.onChange).toHaveBeenCalledWith({ ...legacyLoadout, weaponId: nextWeapon.id });
  });

  it("shows playable folklore legends and a direct route back to the Guilda", () => {
    const { props } = renderLoadout({ focus: "legend" });
    expect(screen.getByRole("heading", { level: 2, name: "Escolha sua lenda" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Curupira" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Voltar à Guilda/i }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });
});
