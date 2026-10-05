import { describe, expect, it, vi } from "vitest";
import { runAfterPersistingLoadout } from "./loadout-navigation";

describe("navegação com loadout", () => {
  it("espera o loadout remoto ser salvo antes de abrir outra tela", async () => {
    let saved = false;
    const action = vi.fn(() => {
      expect(saved).toBe(true);
    });

    await expect(runAfterPersistingLoadout(
      true,
      async () => {
        saved = true;
        return true;
      },
      action,
    )).resolves.toBe(true);

    expect(action).toHaveBeenCalledOnce();
  });

  it("não navega se o salvamento falhar", async () => {
    const action = vi.fn();

    await expect(runAfterPersistingLoadout(true, async () => false, action)).resolves.toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  it("não chama o servidor quando o loadout já está salvo", async () => {
    const persist = vi.fn(async () => true);
    const action = vi.fn();

    await runAfterPersistingLoadout(false, persist, action);
    expect(persist).not.toHaveBeenCalled();
    expect(action).toHaveBeenCalledOnce();
  });
});
