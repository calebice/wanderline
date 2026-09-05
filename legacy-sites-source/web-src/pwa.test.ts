import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("installable iPad shell", () => {
  it("declares a standalone manifest with maskable and Apple-sized icons", () => {
    const manifest = JSON.parse(readFileSync(resolve("public/manifest.webmanifest"), "utf8")) as {
      display: string;
      start_url: string;
      icons: Array<{ sizes: string; purpose: string }>;
    };
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("./library");
    expect(manifest.icons.some((icon) => icon.purpose.includes("maskable"))).toBe(true);
    expect(manifest.icons.some((icon) => icon.sizes === "180x180")).toBe(true);
    const shell = readFileSync(resolve("index.html"), "utf8");
    expect(shell).toContain("apple-touch-icon");
    expect(shell).toContain("main.tsx?theme=garden-v8");
  });

  it("caches the application shell but excludes APIs and private sketch images", () => {
    const worker = readFileSync(resolve("public/sw.js"), "utf8");
    expect(worker).toContain("wanderline-shell-garden-v18-brand-refresh");
    expect(worker).toContain("STYLE_GUIDE_THUMBNAILS");
    expect(worker).toContain("COASTAL_STAIRWAY_THUMBNAILS");
    expect(worker).toContain("ASTRONAUT_THUMBNAILS");
    expect(worker).toContain("CAMPER_VAN_THUMBNAILS");
    expect(worker).toContain("BOUQUET_THUMBNAILS");
    expect(worker).toContain("coastal-stairway/base-thumbnail.png");
    expect(worker).toContain("astronaut/base-thumbnail.png");
    expect(worker).toContain("style-guide/camper-van/${style}/thumbnail.png");
    expect(worker).toContain("style-guide/bouquet/${style}/thumbnail.png");
    expect(worker).toContain("style-guide/feeling-first/the-last-tree/thumbnail.webp");
    expect(worker).not.toContain("style-guide/feeling-first/the-last-tree/pensive.webp");
    expect(worker).toContain("anime-environment");
    expect(worker).toContain('url.pathname.includes("/src/")');
    expect(worker).toContain('url.pathname.includes("/@vite/")');
    expect(worker).toContain("manifest.webmanifest");
    expect(worker).toContain("request.mode === \"navigate\"");
    expect(worker).toContain('url.pathname.includes("/api/")');
    expect(worker).toContain('url.pathname.includes("/sketches/")');
  });
});
