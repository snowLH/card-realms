// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ARPG_LOADOUT } from "@/game/arpg/content/mata-encantada";
import { STARTER_ARPG_ABILITY_IDS } from "@/game/arpg/content/ability-cards";
import { DEFAULT_AVATAR_CONFIG } from "@/game/save/local-progress";
import { ArpgLoadoutView } from "./loadout-view";

afterEach(cleanup);

function renderLoadout(overrides: Partial<Parameters<typeof ArpgLoadoutView>[0]> = {}) {
  const props = {
    focus: "cards" as const,
    loadout: DEFAULT_ARPG_LOADOUT,
    inventoryItemKeys: [],
    ownedAbilityCardIds: [...STARTER_ARPG_ABILITY_IDS],
    coins: 500,
    avatarConfig: DEFAULT_AVATAR_CONFIG,
    onChange: vi.fn(),
    onPurchaseAbilityCard: vi.fn().mockResolvedValue({ coins: 420, ownedAbilityIds: [...STARTER_ARPG_ABILITY_IDS, "caipora-arrow"] }),
    onSaveAvatar: vi.fn(),
    onBack: vi.fn(),
    onPlay: vi.fn(),
    ...overrides,
  };
  return { ...render(<ArpgLoadoutView {...props} />), props };
}

describe("ArpgLoadoutView", () => {
  it("shows exactly two attack spaces and no active companion selection", () => {
    renderLoadout();

    expect(screen.getByRole("list", { name: "Dois espaços de ataque" }).querySelectorAll("button")).toHaveLength(2);
    expect(screen.queryByText(/Suportes|companheiros|Santuário/i)).not.toBeInTheDocument();
  });

  it("purchases an available power through the supplied in-game purchase callback", async () => {
    const { props } = renderLoadout();
    fireEvent.click(screen.getByRole("button", { name: /Caipora, Flecha da Caipora: Comprar por 80 moedas/i }));

    await waitFor(() => expect(props.onPurchaseAbilityCard).toHaveBeenCalledWith("caipora-arrow"));
    expect(await screen.findByRole("status")).toHaveTextContent("foi adicionada à sua coleção");
  });

  it("shows the exact shortfall and disables a power the player cannot afford", () => {
    renderLoadout({ coins: 0 });

    expect(screen.getByRole("button", { name: /Caipora, Flecha da Caipora: Faltam 80 moedas/i })).toBeDisabled();
    expect(screen.getByText("Saldo disponível:").parentElement).toHaveTextContent("Saldo disponível: 0 moedas");
  });

  it("keeps purchases inside the Guilda archive and only shows owned attacks in Arsenal", () => {
    renderLoadout({ focus: "all" });

    expect(screen.getByText("Seus ataques")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Curupira, Raízes Ancestrais/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Caipora, Flecha da Caipora/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Saldo disponível:")).not.toBeInTheDocument();
  });

  it("lets the player choose two weapon slots and swap their positions", () => {
    const { props } = renderLoadout({ focus: "all" });

    fireEvent.click(screen.getByRole("button", { name: "Espaço 2 · Espada de Ferro" }));
    const weaponSection = screen.getByText("Duas armas").closest("section");
    expect(weaponSection).not.toBeNull();
    fireEvent.click(within(weaponSection as HTMLElement).getByRole("button", { name: /RaroArco da Mata/ }));

    expect(props.onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      weaponId: "iron-sword",
      secondaryWeaponId: "forest-bow",
      abilityIds: DEFAULT_ARPG_LOADOUT.abilityIds,
    }));
    expect(screen.getByRole("button", { name: "Espaço 2 · Espada de Ferro" })).toHaveAttribute("aria-pressed", "true");
  });

  it("reuses the shared avatar editor and gives a direct route back to the Guilda", async () => {
    const { props } = renderLoadout({ focus: "avatar" });
    expect(screen.getByRole("heading", { level: 2, name: "Seu personagem" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Salvar personagem/i }));

    await waitFor(() => expect(props.onSaveAvatar).toHaveBeenCalledWith(DEFAULT_AVATAR_CONFIG));
    fireEvent.click(screen.getByRole("button", { name: /Voltar à Guilda/i }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });
});
