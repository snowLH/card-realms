// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArpgToast } from "./arpg-toast";

afterEach(() => { cleanup(); vi.useRealTimers(); });
describe("temporary ARPG messages", () => {
  it("announces a message politely, fades after 2.5s and replaces it without accumulating notices", () => {
    vi.useFakeTimers();
    const view = render(<ArpgToast key={1} text="Rajada Dourada ativada." />);
    expect(screen.getByText("Rajada Dourada ativada.").parentElement).toHaveAttribute("aria-live", "polite");
    act(() => vi.advanceTimersByTime(2500));
    expect(view.container.querySelector(".arpg-toast")).not.toHaveClass("arpg-toast--visible");
    act(() => vi.advanceTimersByTime(180));
    expect(screen.queryByText("Rajada Dourada ativada.")).not.toBeInTheDocument();
    view.rerender(<ArpgToast key={2} text="Restauração concluída. Salvando progresso…" />);
    expect(screen.getByText("Restauração concluída. Salvando progresso…")).toBeInTheDocument();
    expect(view.container.querySelectorAll(".arpg-toast")).toHaveLength(1);
  });
});
