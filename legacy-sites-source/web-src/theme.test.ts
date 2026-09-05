import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { sceneTheme } from "./theme";

describe("interchangeable visual theme", () => {
  it("selects a named document theme and defines semantic interface roles", () => {
    const shell = readFileSync(resolve("index.html"), "utf8");
    const theme = readFileSync(resolve("src/themes/garden-studio.css"), "utf8");

    expect(shell).toContain('data-theme="garden-studio"');
    expect(theme).toContain('--surface-page:');
    expect(theme).toContain('--interactive-primary:');
    expect(theme).toContain('--track-perspective:');
  });

  it("centralizes non-CSS scene pigments", () => {
    expect(sceneTheme.canvas).toBe("#f1efe6");
    expect(sceneTheme.coral).toBe("#d97666");
    expect(sceneTheme.blue).toBe("#4d89ba");
  });
});
