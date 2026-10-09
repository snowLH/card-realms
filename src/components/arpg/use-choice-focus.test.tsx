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
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
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
  it("reveals a focused choice inside the list and adjusts after a smaller viewport", () => {
    let paneHeight = 100;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("arpg-room-choice__options")) return new DOMRect(0, 100, 300, paneHeight);
      const pane = this.closest<HTMLElement>(".arpg-room-choice__options");
      const y = this.textContent === "Equipar" ? 300 : 100;
      return new DOMRect(0, y - (pane?.scrollTop ?? 0), 300, 50);
    });
    function ScrolledChoices() {
      const ref = useChoiceFocus(true);
      return <div ref={ref}><div className="arpg-room-choice__options"><button disabled>Comprar</button><button>Manter</button><button>Equipar</button></div></div>;
    }
    const view = render(<ScrolledChoices />);
    const pane = view.container.querySelector<HTMLElement>(".arpg-room-choice__options")!;
    expect(pane.scrollTop).toBe(0);
    fireEvent.keyDown(window, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Equipar" })).toHaveFocus();
    expect(pane.scrollTop).toBe(150);
    paneHeight = 50;
    fireEvent(window, new Event("resize"));
    expect(pane.scrollTop).toBe(200);
    fireEvent.keyDown(window, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Manter" })).toHaveFocus();
    expect(pane.scrollTop).toBe(0);
  });
});
