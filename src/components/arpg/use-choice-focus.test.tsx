// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useChoiceFocus } from "./use-choice-focus";
import { NATIVE_BACK_EVENT } from "@/lib/native-events";

function Choices() {
  const ref = useChoiceFocus(true);
  return <div ref={ref} role="dialog"><button disabled>Comprar</button><button>Manter</button><button>Equipar</button></div>;
}
afterEach(cleanup);
describe("dungeon decision focus", () => {
  it("cycles only enabled choices with Tab and Shift+Tab", () => {
    render(<Choices />);
    expect(screen.getByRole("button", { name: "Manter" })).toHaveFocus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "Equipar" })).toHaveFocus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Manter" })).toHaveFocus();
  });
  it("preserves an unresolved reward on native Back or Escape", () => {
    const outsideBack = vi.fn();
    window.addEventListener(NATIVE_BACK_EVENT, outsideBack);
    const view = render(<Choices />);
    const back = new Event(NATIVE_BACK_EVENT, { cancelable: true });
    window.dispatchEvent(back);
    expect(back.defaultPrevented).toBe(true);
    expect(outsideBack).not.toHaveBeenCalled();
    expect(fireEvent.keyDown(window, { key: "Escape" })).toBe(false);
    view.unmount();
    window.dispatchEvent(new Event(NATIVE_BACK_EVENT));
    expect(outsideBack).toHaveBeenCalledOnce();
    window.removeEventListener(NATIVE_BACK_EVENT, outsideBack);
  });
  it("returns focus to the previous connected control after a decision", () => {
    const previous = document.createElement("button");
    document.body.append(previous);
    previous.focus();
    const view = render(<Choices />);
    view.unmount();
    expect(previous).toHaveFocus();
    previous.remove();
  });
});
