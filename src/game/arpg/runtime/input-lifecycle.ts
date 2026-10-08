import type { ArpgRuntimeBridge } from "../domain/types";

import { NATIVE_SUSPEND_EVENT } from "@/lib/native-events";

/** Native WebViews may hide the page without delivering pointerup or keyup. */
export function bindInputLifecycle(bridge: Pick<ArpgRuntimeBridge, "clearGameplayInput">, onSuspend?: () => void) {
  const suspend = () => {
    bridge.clearGameplayInput();
    onSuspend?.();
  };
  const onVisibility = () => { if (document.hidden) suspend(); };
  window.addEventListener("blur", suspend);
  window.addEventListener("pagehide", suspend);
  window.addEventListener(NATIVE_SUSPEND_EVENT, suspend);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    window.removeEventListener("blur", suspend);
    window.removeEventListener("pagehide", suspend);
    window.removeEventListener(NATIVE_SUSPEND_EVENT, suspend);
    document.removeEventListener("visibilitychange", onVisibility);
    bridge.clearGameplayInput();
  };
}
