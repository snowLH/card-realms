/** Local development fault injection, before the real local save. Never grants
 * rewards or substitutes the persistence handler. Online runs cannot use it. */
export function createBossSaveQaDelay(search: string) {
  const params = new URLSearchParams(search);
  const delayMs = Math.max(0, Math.min(10000, Number(params.get("bossSaveDelayMs")) || 0));
  let failures = Math.max(0, Math.min(2, Number(params.get("bossSaveFailures")) || 0));
  return async () => {
    if (delayMs) await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    if (failures > 0) { failures--; throw new Error("Falha de persistência simulada para QA local."); }
  };
}
