// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { InfoTooltip, InfoTooltipProvider } from "./info-tooltip";

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

afterAll(() => vi.unstubAllGlobals());

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("InfoTooltip", () => {
  it("opens on pointer hover and keeps the tooltip text out of the field name", async () => {
    vi.useFakeTimers();
    render(
      <InfoTooltipProvider>
        <div>
          <span>
            <label htmlFor="noise-window">Окно оценки шума</label>
            <InfoTooltip label="Окно оценки шума" content="Локальная оценка MAD первых разностей" />
          </span>
          <input id="noise-window" type="number" />
        </div>
      </InfoTooltipProvider>,
    );

    const field = screen.getByRole("spinbutton", { name: "Окно оценки шума" });
    expect(field).toBeTruthy();
    expect(screen.queryByRole("spinbutton", { name: /MAD/ })).toBeNull();

    fireEvent.pointerMove(screen.getByRole("button", { name: "Подсказка: Окно оценки шума" }), { pointerType: "mouse" });
    await act(async () => vi.advanceTimersByTimeAsync(300));

    expect(screen.getByRole("tooltip").textContent).toContain("Локальная оценка MAD первых разностей");
  });

  it("opens on focus, closes on Escape and replaces another open tooltip", () => {
    render(
      <InfoTooltipProvider>
        <InfoTooltip label="Первый термин" content="Первая подсказка" />
        <InfoTooltip label="Второй термин" content="Вторая подсказка" />
      </InfoTooltipProvider>,
    );

    const first = screen.getByRole("button", { name: "Подсказка: Первый термин" });
    const second = screen.getByRole("button", { name: "Подсказка: Второй термин" });

    fireEvent.focus(first);
    expect(screen.getByRole("tooltip").textContent).toContain("Первая подсказка");

    fireEvent.focus(second);
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
    expect(screen.getByRole("tooltip").textContent).toContain("Вторая подсказка");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
