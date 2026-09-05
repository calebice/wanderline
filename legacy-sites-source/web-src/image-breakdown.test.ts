import { describe, expect, it } from "vitest";

import type { ImageDecomposition } from "./api";
import { renderDecompositionSvg } from "./decomposition-render";

const decomposition: ImageDecomposition = {
  id: "decomposition-12345678",
  status: "completed",
  provider: "local_cv_shapes",
  algorithm_version: "local_cv_shapes_v1",
  summary: "Geometry only.",
  confidence: 0.9,
  image: {
    id: "image-1",
    content_type: "image/png",
    width: 800,
    height: 600,
    uploaded_at: "2026-08-21T00:00:00Z",
  },
  shapes: [{
    id: "shape-1",
    kind: "rectangle",
    geometry: { type: "rect", x: 0.2, y: 0.3, width: 0.6, height: 0.5 },
    color: "#bd765e",
    importance: 0.9,
    confidence: 0.94,
    z_index: 0,
    source: "fitted",
  }],
  construction_hints: [],
  levels: { simple: ["shape-1"], medium: ["shape-1"], detailed: ["shape-1"] },
  drawing_steps: [{ order: 1, shape_id: "shape-1", instruction: "Place the rectangle mass first." }],
  warnings: [],
  limitations: "No semantics.",
};

describe("shape reconstruction export", () => {
  it("creates a private, scalable SVG containing only selected geometry", () => {
    const svg = renderDecompositionSvg(decomposition, ["shape-1"], true, true);

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"');
    expect(svg).toContain('<rect x="160" y="180" width="480" height="300"/>');
    expect(svg).toContain("1 · rectangle");
    expect(svg).not.toContain("/api/v1/images/image-1");
    expect(svg).not.toContain("<image");
  });
});
