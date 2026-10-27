// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SettingsDisclosure } from "./settings-disclosure";

afterEach(cleanup);

describe("settings disclosures", () => {
  it("shows the updated parameter in the closed summary", () => {
    const { rerender } = render(<SettingsDisclosure title="Оценка шума" value="окно 3 нм"><input aria-label="Окно" /></SettingsDisclosure>);
    expect(screen.getByText("окно 3 нм").closest("details")?.open).toBe(false);
    rerender(<SettingsDisclosure title="Оценка шума" value="окно 4 нм"><input aria-label="Окно" /></SettingsDisclosure>);
    expect(screen.getByText("окно 4 нм")).toBeTruthy();
  });

  it("keeps a failed edit open until it is corrected", () => {
    const editor = <input aria-label="Окно" defaultValue="3" />;
    const { rerender } = render(<SettingsDisclosure title="Оценка шума" status="ready">{editor}</SettingsDisclosure>);
    const details = screen.getByText("Оценка шума").closest("details")!;
    details.open = true;
    fireEvent.change(screen.getByLabelText("Окно"), { target: { value: "-1" } });
    rerender(<SettingsDisclosure title="Оценка шума" status="error" error="Некорректное окно">{editor}</SettingsDisclosure>);
    details.open = false;
    fireEvent(details, new Event("toggle"));
    expect(details.open).toBe(true);
    fireEvent.change(screen.getByLabelText("Окно"), { target: { value: "4" } });
    rerender(<SettingsDisclosure title="Оценка шума" status="ready">{editor}</SettingsDisclosure>);
    details.open = false;
    fireEvent(details, new Event("toggle"));
    expect(details.open).toBe(false);
  });

  it("does not expand untouched parameters for an unrelated error", () => {
    const { rerender } = render(<SettingsDisclosure title="Оценка шума" status="ready"><input aria-label="Окно" /></SettingsDisclosure>);
    rerender(<SettingsDisclosure title="Оценка шума" status="error" error="Ошибка другого параметра"><input aria-label="Окно" /></SettingsDisclosure>);
    expect(screen.getByText("Оценка шума").closest("details")?.open).toBe(false);
  });
});
