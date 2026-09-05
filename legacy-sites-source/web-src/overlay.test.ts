import { afterEach, describe, expect, it, vi } from "vitest";

import type { LibraryAttempt, LibraryExercise } from "./api";
import {
  MAX_OVERLAY_PIXELS,
  OVERLAY_PRESETS,
  overlayFilename,
  renderOverlayPng,
  renderOverlaySvg,
  validateOverlaySize,
} from "./overlay";

const baseExercise = {
  id: "test-exercise",
  title: "Test exercise",
  visual_kind: "one-point",
} as Pick<LibraryExercise, "id" | "title" | "visual_kind">;

const baseAttempt = {
  variant_seed: 451234,
  variant_data: { horizon_y: 0.5, vanishing_x: 0.42 },
} as Pick<LibraryAttempt, "variant_seed" | "variant_data">;

const settings = {
  width: 2732,
  height: 2048,
  color: "#1689a8",
  opacity: 0.7,
  lineWeight: 5,
  labels: false,
};

afterEach(() => vi.restoreAllMocks());

describe("Procreate overlay renderer", () => {
  it("renders deterministic transparent SVG at exact dimensions", () => {
    const first = renderOverlaySvg({ exercise: baseExercise, attempt: baseAttempt, settings });
    const second = renderOverlaySvg({ exercise: baseExercise, attempt: baseAttempt, settings });
    expect(first).toBe(second);
    expect(first).toContain('width="2732" height="2048"');
    expect(first).toContain("fill:none");
    expect(first).not.toContain("background");
    expect(first).toContain("#1689a8");
  });

  it.each([
    ["one-point", { horizon_y: 0.38, vanishing_x: 0.61 }],
    ["two-point", { horizon_y: 0.62, left_vp: -0.2, right_vp: 1.2 }],
    ["rotating", { primitive: "cone", rotations: [-35, 0, 35] }],
    ["draw-through", { primitive: "box" }],
    ["cross-contour", { primitive: "sphere" }],
    ["object", { object_template: "mug" }],
    ["hatch-ladder", { hatch_angle: 60 }],
    ["hatch-form", { primitive: "sphere", hatch_angle: 45 }],
    ["light-logic", { primitive: "sphere", light_direction: "upper-right" }],
    ["head-construction", { view: "three-quarter", tilt: -6 }],
  ])("has a vector adapter for %s", (kind, variant) => {
    const svg = renderOverlaySvg({ exercise: { ...baseExercise, visual_kind: kind }, attempt: { ...baseAttempt, variant_data: variant }, settings });
    expect(svg).toContain("<svg");
    expect(svg.length).toBeGreaterThan(600);
  });

  it("keeps instructional labels opt-in", () => {
    const head = { ...baseExercise, visual_kind: "head-construction" };
    const attempt = { ...baseAttempt, variant_data: { view: "front", tilt: 0 } };
    expect(renderOverlaySvg({ exercise: head, attempt, settings })).not.toContain("brow</text>");
    expect(renderOverlaySvg({ exercise: head, attempt, settings: { ...settings, labels: true } })).toContain("brow</text>");
  });

  it("validates presets and the iPad memory ceiling", () => {
    expect(OVERLAY_PRESETS).toHaveLength(4);
    for (const preset of OVERLAY_PRESETS) expect(validateOverlaySize(preset.width, preset.height)).toBeNull();
    expect(validateOverlaySize(255, 2048)).toMatch(/at least 256/);
    expect(validateOverlaySize(MAX_OVERLAY_PIXELS + 1, 1)).not.toBeNull();
    expect(validateOverlaySize(5000, 4000)).toMatch(/16.8 megapixels/);
  });

  it("creates stable variation and dimension filenames", () => {
    expect(overlayFilename("two-point-boxes", 451234, 2732, 2048)).toMatch(/^wanderline-two-point-boxes-[0-9a-f]{4}-2732x2048\.png$/);
  });

  it("rasterizes onto a transparent exact-size canvas", async () => {
    class ReadyImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    }
    vi.stubGlobal("Image", ReadyImage);
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:svg") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const clearRect = vi.fn();
    const drawImage = vi.fn();
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      if (tag !== "canvas") return originalCreate(tag);
      return {
        width: 0,
        height: 0,
        getContext: () => ({ clearRect, drawImage }),
        toBlob: (callback: BlobCallback) => callback(new Blob(["png"], { type: "image/png" })),
      } as unknown as HTMLCanvasElement;
    }) as typeof document.createElement);
    const png = await renderOverlayPng({ exercise: baseExercise, attempt: baseAttempt, settings });
    expect(png.type).toBe("image/png");
    expect(clearRect).toHaveBeenCalledWith(0, 0, 2732, 2048);
    expect(drawImage).toHaveBeenCalled();
  });
});
