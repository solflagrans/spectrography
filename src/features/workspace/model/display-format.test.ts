import { describe, expect, it } from "vitest";

import { formatCount, formatDecimal, formatSignedDecimal, pluralizeRu } from "./display-format";

describe("Russian display formatting", () => {
  it("uses the correct noun forms", () => {
    expect(formatCount(1, "линия", "линии", "линий")).toBe("1 линия");
    expect(formatCount(2, "линия", "линии", "линий")).toBe("2 линии");
    expect(formatCount(5, "линия", "линии", "линий")).toBe("5 линий");
    expect(formatCount(21, "группа", "группы", "групп")).toBe("21 группа");
    expect(pluralizeRu(12, "пик", "пика", "пиков")).toBe("пиков");
  });

  it("normalizes negative zero and uses a comma decimal separator", () => {
    expect(formatSignedDecimal(-0.0004, 3)).toBe("0,000");
    expect(formatDecimal(-0, 2)).toBe("0,00");
    expect(formatDecimal(238_290_407_526.29, 2)).toBe("238 290 407 526,29");
    expect(formatSignedDecimal(0.125, 3)).toBe("+0,125");
    expect(formatSignedDecimal(-0.125, 3)).toBe("-0,125");
  });
});
