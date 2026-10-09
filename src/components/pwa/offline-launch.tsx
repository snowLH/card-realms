"use client";

import { useEffect, useRef, useState } from "react";

type PackState = { ready: boolean; completed: number; total: number; error?: string };

export function OfflineLaunch({ offlineMode = false }: { offlineMode?: boolean }) {
  const [state, setState] = useState<PackState>({ ready: false, completed: 0, total: 0 });
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState(false);
  const preparationPort = useRef<MessagePort | null>(null);

  useEffect(() => () => { preparationPort.current?.close(); }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let closed = false;
    let statusPort: MessagePort | null = null;
    const query = (worker: ServiceWorker | null) => {
      if (closed || !worker) return;
      statusPort?.close();
      const channel = new MessageChannel();
      statusPort = channel.port1;
      channel.port1.onmessage = (event: MessageEvent<PackState>) => {
        if (!closed) {
          setState(event.data);
          setAvailable(true);
        }
        channel.port1.close();
      };
      worker.postMessage({ type: "OFFLINE_STATUS" }, [channel.port2]);
    };
    // Existing players may still be controlled by a worker that predates the
    // offline pack protocol. Enable preparation only after the new one replies.
    const onControllerChange = () => query(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    void navigator.serviceWorker.ready.then((registration) => {
      query(registration.active);
    }).catch(() => {});
    return () => {
      closed = true;
      statusPort?.close();
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const prepare = async () => {
    if (!("serviceWorker" in navigator)) {
      setState((s) => ({ ...s, error: "Este navegador não permite guardar o jogo offline." }));
      return;
    }
    if (!navigator.onLine) {
      setState((s) => ({ ...s, error: "Conecte à internet para preparar o jogo uma vez." }));
      return;
    }
    let registration: ServiceWorkerRegistration | undefined;
    try { registration = await navigator.serviceWorker.getRegistration("/"); }
    catch {
      setState((s) => ({ ...s, error: "Não foi possível iniciar o download. Tente novamente." }));
      return;
    }
    if (!registration?.active) {
      setState((s) => ({ ...s, error: "A preparação está iniciando. Tente novamente em instantes." }));
      return;
    }
    setBusy(true);
    setState({ ready: false, completed: 0, total: 0 });
    const channel = new MessageChannel();
    preparationPort.current?.close();
    preparationPort.current = channel.port1;
    channel.port1.onmessage = (event: MessageEvent<PackState>) => {
      setState(event.data);
      if (event.data.ready || event.data.error) {
        setBusy(false);
        channel.port1.close();
        preparationPort.current = null;
      }
    };
    registration.active.postMessage({ type: "PREPARE_OFFLINE" }, [channel.port2]);
  };

  return (
    <div className="offline-launch">
      <a href={offlineMode ? "/" : "/offline"} className="offline-launch__play">
        {offlineMode ? "ONLINE COM AMIGOS" : "JOGAR OFFLINE"}
      </a>
      {!offlineMode ? <button type="button" onClick={() => void prepare()} disabled={busy || !available}>
        {busy ? `Preparando${state.total ? ` ${Math.round(state.completed / state.total * 100)}%` : "..."}`
          : state.ready ? "Atualizar jogo offline" : "Preparar jogo offline"}
      </button> : null}
      <p role="status" aria-live="polite">
        {state.error ?? (state.ready ? "Pronto para abrir e jogar sem internet."
          : offlineMode ? "Aventura local · progresso salvo neste aparelho."
            : "Prepare uma vez com internet para jogar desconectado.")}
      </p>
    </div>
  );
}
