// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NumberField } from "./number-field";

afterEach(cleanup);
const props = { id: "test-number", label: "Порог", min: 0, max: 10, step: 0.5, value: 2 };
describe("number field editing", () => {
  it("keeps a draft until blur and commits it once", () => {
    const onCommit = vi.fn(); render(<NumberField {...props} onCommit={onCommit} />);
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "3.5" } });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.blur(input); expect(onCommit).toHaveBeenCalledExactlyOnceWith(3.5);
  });
  it("steps from the current draft and respects the declared bounds", () => {
    const onCommit = vi.fn(); render(<NumberField {...props} value={9.5} onCommit={onCommit} />);
    fireEvent.click(screen.getByRole("button", { name: "Увеличить: Порог" }));
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("10");
    fireEvent.click(screen.getByRole("button", { name: "Увеличить: Порог" }));
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("10");
  });
  it("restores an empty or cancelled draft without committing", () => {
    const onCommit = vi.fn(); render(<NumberField {...props} onCommit={onCommit} />);
    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } }); fireEvent.blur(input);
    expect(input.value).toBe("2");
    fireEvent.change(input, { target: { value: "5" } }); fireEvent.keyDown(input, { key: "Escape" });
    expect(input.value).toBe("2"); expect(onCommit).not.toHaveBeenCalled();
  });
});
