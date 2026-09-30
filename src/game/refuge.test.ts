import { describe, expect, it } from "vitest";
import { resolveRefugeResident } from "./refuge";

describe("regra de residente do Refúgio", () => {
  it("mantém a lenda salva quando ela pertence à coleção", () => {
    expect(resolveRefugeResident("iara", ["iara", "curupira"])).toBe("iara");
  });

  it("não mostra uma lenda que o jogador não possui", () => {
    expect(resolveRefugeResident("boto-cor-de-rosa", ["iara"])).toBe("iara");
  });

  it("fica vazio quando a conta ainda não possui nenhuma lenda", () => {
    expect(resolveRefugeResident("boto-cor-de-rosa", [])).toBeNull();
  });
});
