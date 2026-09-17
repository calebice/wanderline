import { describe, expect, it } from "vitest";
import { COLOR_FAMILIES, EMILY_LEX_PAINTS, MIXING_EXAMPLES } from "./color-mixing-examples";

describe("Emily Lex color construction examples", () => {
  it("covers ten families with a bounded set of shades and unique targets", () => {
    expect(MIXING_EXAMPLES).toHaveLength(36);
    expect(new Set(MIXING_EXAMPLES.map((target) => target.id)).size).toBe(36);
    for (const family of COLOR_FAMILIES) {
      expect(MIXING_EXAMPLES.filter((target) => target.family === family.id)).toHaveLength(["browns", "grays"].includes(family.id) ? 6 : 3);
    }
  });
  it("uses one to three distinct available paints and available corrections", () => {
    const available = EMILY_LEX_PAINTS.map(([name]) => name);
    for (const target of MIXING_EXAMPLES) {
      expect(target.ingredients.length).toBeGreaterThanOrEqual(1);
      expect(target.ingredients.length).toBeLessThanOrEqual(3);
      expect(new Set(target.ingredients.map((item) => item.paint)).size).toBe(target.ingredients.length);
      for (const item of target.ingredients) {
        expect(available).toContain(item.paint);
        expect(item.amount.length).toBeGreaterThan(0);
        expect(item.role.length).toBeGreaterThan(0);
      }
      expect(available).toContain(target.correction.paint);
      expect(target.correction.instruction).toContain(target.correction.paint);
      expect(target.water).toMatch(/dry|dries/);
      expect(target.color).toMatch(/^#[\da-f]{6}$/i);
    }
  });
  it("constructs olive in the owner's requested order, with umber as a final small addition", () => {
    const olive = MIXING_EXAMPLES.find((target) => target.id === "olive-green")!;
    expect(olive.ingredients.map((item) => item.paint)).toEqual(["Lemon Yellow", "Green Deep", "Burnt Umber"]);
    expect(olive.ingredients[2].amount).toMatch(/tiny touch.*last/);
    expect(olive.ingredients[2].role).toContain("mutes");
  });
});
