import { describe, expect, it } from "vitest";

import { createRaw8Fixture } from "@/fixtures/raw8-test-fixture";

import { parseAvaSoftRaw8 } from "./parse-avasoft-raw8";

describe("AvaSoft RAW8 import", () => {
  it("parses an AVS84 single-channel scope container", () => {
    const parsed = parseAvaSoftRaw8(createRaw8Fixture());

    expect(parsed.dataset).toEqual({
      wavelengths: [420.5, 480.25, 530.75, 640],
      intensities: [100, 250, 175, 90],
    });
    expect(parsed.auxiliaryData).toEqual({
      dark: [4, 5, 6, 7],
      reference: [900, 901, 902, 903],
    });
    expect(parsed.metadata).toEqual({
      serialNumber: "2107079U2",
      integrationTimeMs: 4,
      averages: 1,
      channelCount: 1,
      startPixel: 10,
      stopPixel: 13,
    });
  });

  it("rejects an invalid signature", () => {
    const data = createRaw8Fixture();
    new DataView(data).setUint8(0, "X".charCodeAt(0));
    expect(() => parseAvaSoftRaw8(data)).toThrow(/неверная сигнатура/);
  });

  it("rejects an unsupported container version", () => {
    const data = createRaw8Fixture();
    new DataView(data).setUint8(4, "3".charCodeAt(0));
    expect(() => parseAvaSoftRaw8(data)).toThrow(/версия контейнера «AVS83»/);
  });

  it("rejects multiple channels", () => {
    const data = createRaw8Fixture();
    new DataView(data).setUint8(5, 2);
    expect(() => parseAvaSoftRaw8(data)).toThrow(/поддерживается только один канал/);
  });

  it("rejects a non-scope measurement variant", () => {
    expect(() => parseAvaSoftRaw8(createRaw8Fixture({ measurementMode: 2 }))).toThrow(/RWD8 пока не поддерживается/);
  });

  it("rejects non-finite channel values", () => {
    const data = createRaw8Fixture();
    new DataView(data).setFloat32(328 + 4 * Float32Array.BYTES_PER_ELEMENT, Number.NaN, true);
    expect(() => parseAvaSoftRaw8(data)).toThrow(/массив scope, значение 1/);
  });

  it("rejects a truncated file", () => {
    const data = createRaw8Fixture();
    expect(() => parseAvaSoftRaw8(data.slice(0, data.byteLength - 24))).toThrow(/файл обрезан/);
  });
});
