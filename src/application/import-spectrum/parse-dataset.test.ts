import { describe, expect, it } from "vitest";

import { parseJsonPayload, parseManualColumns } from "./parse-dataset";

describe("spectrum import", () => {
  it("parses and sorts a JSON object payload", () => {
    expect(parseJsonPayload('{"wavelengths":[600,500],"intensities":[2,1]}')).toEqual({
      wavelengths: [500, 600],
      intensities: [1, 2],
    });
  });

  it("parses paired manual columns", () => {
    expect(parseManualColumns("486.13\n589.59", "72.4\n91.8")).toEqual({
      wavelengths: [486.13, 589.59],
      intensities: [72.4, 91.8],
    });
  });

  it("rejects columns of different lengths", () => {
    expect(() => parseManualColumns("486.13\n589.59", "72.4")).toThrow(
      "строка 2, колонка 2",
    );
  });
});
