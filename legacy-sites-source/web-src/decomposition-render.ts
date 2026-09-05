import type { DecompositionGeometry, DecompositionGuide, ImageDecomposition } from "./api";

export function geometryCenter(geometry: DecompositionGeometry) {
  if (geometry.type === "rect") {
    return { x: geometry.x + geometry.width / 2, y: geometry.y + geometry.height / 2 };
  }
  if (geometry.type === "ellipse" || geometry.type === "rotated_rect") {
    return { x: geometry.cx, y: geometry.cy };
  }
  const count = Math.max(1, geometry.points.length);
  return {
    x: geometry.points.reduce((sum, point) => sum + point.x, 0) / count,
    y: geometry.points.reduce((sum, point) => sum + point.y, 0) / count,
  };
}

function safeColor(color: string) {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : "#b7b1a5";
}

function geometryMarkup(geometry: DecompositionGuide, width: number, height: number) {
  if (geometry.type === "rect") {
    return `<rect x="${geometry.x * width}" y="${geometry.y * height}" width="${geometry.width * width}" height="${geometry.height * height}"/>`;
  }
  if (geometry.type === "ellipse") {
    const cx = geometry.cx * width;
    const cy = geometry.cy * height;
    return `<ellipse cx="${cx}" cy="${cy}" rx="${geometry.rx * width}" ry="${geometry.ry * height}" transform="rotate(${geometry.rotation} ${cx} ${cy})"/>`;
  }
  if (geometry.type === "line") {
    return `<line x1="${geometry.x1 * width}" y1="${geometry.y1 * height}" x2="${geometry.x2 * width}" y2="${geometry.y2 * height}"/>`;
  }
  return `<polygon points="${geometry.points.map((point) => `${point.x * width},${point.y * height}`).join(" ")}"/>`;
}

export function renderDecompositionSvg(
  decomposition: ImageDecomposition,
  visibleIds: string[],
  labels: boolean,
  guides: boolean,
) {
  const visible = new Set(visibleIds);
  const shapes = decomposition.shapes.filter((shape) => visible.has(shape.id));
  const { width, height } = decomposition.image;
  const shapeMarkup = shapes.map((shape) => (
    `<g fill="${safeColor(shape.color)}" fill-opacity=".72">${geometryMarkup(shape.geometry, width, height)}</g>`
  )).join("");
  const guideMarkup = guides ? decomposition.construction_hints
    .filter((hint) => hint.member_shape_ids.some((id) => visible.has(id)))
    .flatMap((hint) => hint.guides)
    .map((guide) => geometryMarkup(guide, width, height))
    .join("") : "";
  const labelMarkup = labels ? shapes.map((shape, index) => {
    const center = geometryCenter(shape.geometry);
    return `<text x="${center.x * width}" y="${center.y * height}">${index + 1} · ${shape.kind.replaceAll("_", " ")}</text>`;
  }).join("") : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#f7f4eb"/><g stroke="#30342e" stroke-width="${Math.max(2, Math.round(Math.min(width, height) / 260))}" stroke-linejoin="round">${shapeMarkup}</g><g fill="none" stroke="#b45e45" stroke-width="${Math.max(2, Math.round(Math.min(width, height) / 340))}" stroke-dasharray="12 10">${guideMarkup}</g><g fill="#30342e" stroke="none" font-family="system-ui,sans-serif" font-size="${Math.max(14, Math.round(Math.min(width, height) / 38))}" font-weight="700">${labelMarkup}</g></svg>`;
}
