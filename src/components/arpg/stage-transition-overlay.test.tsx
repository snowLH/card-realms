// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArpgBridge } from "@/game/arpg/runtime/bridge";
import { StageTransitionOverlay } from "./stage-transition-overlay";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("StageTransitionOverlay (transição temática de fases)", () => {
  it("renderiza o banner com detalhes da nova zona ao receber transição do bridge", () => {
    vi.useFakeTimers();
    const bridge = new ArpgBridge();
    render(<StageTransitionOverlay bridge={bridge} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    act(() => {
      bridge.emitStageTransition({
        previousStage: null,
        stage: {
          index: 2,
          total: 3,
          id: "mata-boitata",
          name: "Travessia do Boitatá",
          subtitle: "Margens Pantanosas & Leito Fluvial",
          description: "Águas escuras cortam a floresta.",
          folkloreQuote: "Não olhe fixo para a serpente de fogo.",
          accentColor: "#4f7d8c",
          badge: "Zona 2/3",
          environmentalDetail: "Cursos de água mística e pontes",
        },
        roomId: "room-2",
      });
    });

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Travessia do Boitatá")).toBeInTheDocument();
    expect(screen.getByText("Margens Pantanosas & Leito Fluvial")).toBeInTheDocument();
    expect(screen.getByText("Zona 2/3")).toBeInTheDocument();
    expect(screen.getByText(/Não olhe fixo para a serpente de fogo/)).toBeInTheDocument();

    // Auto-dismiss after 4.2s
    act(() => {
      vi.advanceTimersByTime(4300);
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("permite fechar manualmente a notificação ao clicar", () => {
    const bridge = new ArpgBridge();
    render(<StageTransitionOverlay bridge={bridge} />);

    act(() => {
      bridge.emitStageTransition({
        previousStage: null,
        stage: {
          index: 1,
          total: 3,
          id: "mata-borda",
          name: "Borda da Mata",
          subtitle: "Clareiras Vivas",
          description: "Entrada da floresta.",
          folkloreQuote: "Rastros do Curupira.",
          accentColor: "#78a95d",
          badge: "Zona 1/3",
          environmentalDetail: "Trilhas de terra",
        },
        roomId: "room-0",
      });
    });

    expect(screen.getByText("Borda da Mata")).toBeInTheDocument();
    const closeButton = screen.getByLabelText("Dispensar aviso de zona");
    fireEvent.click(closeButton);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
