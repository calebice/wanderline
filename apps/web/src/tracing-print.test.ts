import { describe, expect, it } from "vitest";
import { inkBounds, tracingSize } from "./tracing-print";

describe("tracing print sizing", () => {
  it("measures faint ink and excludes surrounding white space", () => {
    const data = new Uint8ClampedArray(100 * 100 * 4).fill(255);
    for (const [x, y] of [[20, 10], [79, 89]]) { const i = (y * 100 + x) * 4; data[i] = data[i + 1] = data[i + 2] = 240; }
    expect(inkBounds(data, 100, 100)).toEqual({ x: 20, y: 10, width: 60, height: 80 });
    expect(inkBounds(new Uint8ClampedArray(400).fill(255), 10, 10)).toBeNull();
  });
  for (const paper of ["A4", "Letter"] as const) {
    it(`preserves selected size and fits wide and square subjects on ${paper}`, () => {
      const medium = tracingSize({ x: 0, y: 0, width: 300, height: 600 }, 6, paper);
      expect(medium.actualInches).toBeCloseTo(6);
      const wide = tracingSize({ x: 0, y: 0, width: 600, height: 300 }, 8, paper);
      expect(wide.landscape).toBe(true); expect(wide.actualInches).toBeCloseTo(8);
      const square = tracingSize({ x: 0, y: 0, width: 600, height: 600 }, 8, paper);
      expect(square.actualInches).toBeLessThan(8);
      expect(square.widthMM).toBeLessThanOrEqual(paper === "A4" ? 186 : 191.9);
    });
  }
});
