// @vitest-environment jsdom
import { useEffect, useState } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ accountId: undefined as string | null | undefined }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("./auth-provider", () => ({ useAuth: () => session }));
vi.mock("./login-dialog", () => ({ LoginDialog: () => <button>Entrar</button> }));
import { GameSessionBoundary } from "./game-session-boundary";
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe("game session boundary", () => {
  it("waits for session verification and keeps offline/account access available", () => {
    session.accountId = undefined;
    render(<GameSessionBoundary accountId="a"><button>Comprar</button></GameSessionBoundary>);
    expect(screen.queryByText("Comprar")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Carregando");
    expect(screen.getByRole("link").getAttribute("href")).toBe("/offline");
    expect(router.refresh).not.toHaveBeenCalled();
  });
  it("unmounts the previous game's writers immediately and discards its delayed receipt", async () => {
    session.accountId = "a";
    const stop = vi.fn();
    const persist = vi.fn();
    let receipt!: (value: string) => void;
    const pending = new Promise<string>((resolve) => { receipt = resolve; });
    function Journey() {
      const [value, setValue] = useState("a-cache");
      useEffect(() => { void pending.then(setValue); return stop; }, []);
      useEffect(() => { persist(value); }, [value]);
      return <button>Comprar</button>;
    }
    const view = render(<GameSessionBoundary accountId="a"><Journey /></GameSessionBoundary>);
    expect(persist).toHaveBeenCalledExactlyOnceWith("a-cache");
    session.accountId = "b";
    view.rerender(<GameSessionBoundary accountId="a"><Journey /></GameSessionBoundary>);
    expect(stop).toHaveBeenCalledOnce();
    expect(screen.queryByText("Comprar")).toBeNull();
    await act(async () => receipt("b-receipt"));
    expect(persist).toHaveBeenCalledOnce();
    view.rerender(<GameSessionBoundary accountId="b"><button>Nova jornada</button></GameSessionBoundary>);
    expect(screen.getByText("Nova jornada")).toBeTruthy();
  });
  it("holds signed-out account state until a guest snapshot replaces it", () => {
    session.accountId = null;
    const view = render(<GameSessionBoundary accountId="a"><button>Conta A</button></GameSessionBoundary>);
    expect(screen.queryByText("Conta A")).toBeNull();
    view.rerender(<GameSessionBoundary accountId={null}><button>Visitante</button></GameSessionBoundary>);
    expect(screen.getByText("Visitante")).toBeTruthy();
  });
  it("refreshes a mismatched initial session once, without polling stale server props", () => {
    session.accountId = "b";
    const view = render(<GameSessionBoundary accountId="a"><button>Conta A</button></GameSessionBoundary>);
    expect(router.refresh).toHaveBeenCalledOnce();
    view.rerender(<GameSessionBoundary accountId="a"><button>Conta A</button></GameSessionBoundary>);
    expect(router.refresh).toHaveBeenCalledOnce();
  });
});
