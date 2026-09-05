import type { LibraryAttempt, LibraryExercise } from "./api";

export const MAX_OVERLAY_PIXELS = 16_800_000;
export const OVERLAY_PRESETS = [
  { label: "Square", width: 2048, height: 2048 },
  { label: "iPad landscape", width: 2732, height: 2048 },
  { label: "iPad portrait", width: 2048, height: 2732 },
  { label: "A4 portrait", width: 2480, height: 3508 },
] as const;

export type OverlaySettings = {
  width: number;
  height: number;
  color: string;
  opacity: number;
  lineWeight: number;
  labels: boolean;
};

type OverlayInput = {
  exercise: Pick<LibraryExercise, "id" | "title" | "visual_kind">;
  attempt: Pick<LibraryAttempt, "variant_seed" | "variant_data">;
  settings: OverlaySettings;
};

function escapeText(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function number(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function label(x: number, y: number, text: string, enabled: boolean) {
  return enabled ? `<text x="${x}" y="${y}" class="label">${escapeText(text)}</text>` : "";
}

function primitiveGuide(variant: Record<string, unknown>, kind: string, labels: boolean) {
  const primitive = String(variant.primitive ?? "box");
  const hidden = `<path class="hidden" d="M250 670 L750 330 M250 330 L750 670 M500 180 V820"/>`;
  if (kind === "object") {
    const object = String(variant.object_template ?? "mug");
    if (object === "bottle") return `<ellipse cx="500" cy="310" rx="115" ry="42"/><path d="M385 310 V690 M615 310 V690"/><ellipse cx="500" cy="690" rx="115" ry="42"/><path d="M435 310 V205 M565 310 V205"/><ellipse cx="500" cy="205" rx="65" ry="24"/><path class="axis" d="M500 150 V760"/>${label(525, 175, "shared axis", labels)}`;
    if (object === "stool") return `<path d="M280 330 L500 220 L720 330 L500 450 Z M280 330 V430 L500 545 V450 M500 545 L720 430 V330"/><path d="M315 445 L345 800 M685 445 L655 800 M445 555 L430 800 M555 555 L570 800"/><path class="hidden" d="M345 800 L655 800 M430 800 L570 800"/>${label(500, 190, "seat box", labels)}`;
    return `<ellipse cx="455" cy="300" rx="145" ry="50"/><path d="M310 300 V700 M600 300 V700"/><ellipse cx="455" cy="700" rx="145" ry="50"/><ellipse cx="625" cy="490" rx="125" ry="165"/><ellipse class="hidden" cx="625" cy="490" rx="75" ry="112"/><path class="axis" d="M455 205 V790"/>${label(480, 230, "cylinder axis", labels)}`;
  }
  let form = "";
  if (primitive === "sphere") form = `<circle cx="500" cy="500" r="285"/>`;
  else if (primitive === "cylinder") form = `<ellipse cx="500" cy="260" rx="205" ry="72"/><path d="M295 260 V735 M705 260 V735"/><ellipse cx="500" cy="735" rx="205" ry="72"/>`;
  else if (primitive === "cone") form = `<ellipse cx="500" cy="745" rx="240" ry="75"/><path d="M260 745 L500 185 L740 745"/>`;
  else form = `<path d="M245 350 L500 210 L755 350 L500 500 Z M245 350 V665 L500 805 V500 M500 805 L755 665 V350"/>`;
  const contours = kind === "cross-contour" ? `<path class="guide" d="M300 385 C400 455 600 455 700 385 M270 500 C390 575 610 575 730 500 M300 615 C400 685 600 685 700 615"/>` : "";
  return `${form}${hidden}${contours}${label(525, 160, kind === "cross-contour" ? "wrap around the form" : "draw through", labels)}`;
}

function perspectiveGuide(kind: string, variant: Record<string, unknown>, labels: boolean) {
  const horizon = number(variant.horizon_y, 0.5) * 1000;
  if (kind === "one-point") {
    const vp = number(variant.vanishing_x, 0.52) * 1000;
    return `<path class="axis" d="M60 ${horizon} H940"/><circle class="point" cx="${vp}" cy="${horizon}" r="10"/><path d="M210 300 H390 V500 H210 Z M210 300 L${vp} ${horizon} M390 300 L${vp} ${horizon} M210 500 L${vp} ${horizon} M390 500 L${vp} ${horizon} M610 610 H790 V790 H610 Z M610 610 L${vp} ${horizon} M790 610 L${vp} ${horizon} M610 790 L${vp} ${horizon} M790 790 L${vp} ${horizon}"/>${label(vp + 18, horizon - 18, "vanishing point", labels)}${label(75, horizon - 18, "horizon", labels)}`;
  }
  const left = 70;
  const right = 930;
  return `<path class="axis" d="M60 ${horizon} H940"/><circle class="point" cx="${left}" cy="${horizon}" r="10"/><circle class="point" cx="${right}" cy="${horizon}" r="10"/><path d="M500 310 V660 M500 310 L${left} ${horizon} M500 310 L${right} ${horizon} M500 660 L${left} ${horizon} M500 660 L${right} ${horizon} M355 390 V590 M650 390 V590 M355 390 L${right} ${horizon} M650 390 L${left} ${horizon}"/>${label(left + 18, horizon - 18, "left VP", labels)}${label(right - 90, horizon - 18, "right VP", labels)}${label(75, horizon + 38, "horizon", labels)}`;
}

function hatchGuide(kind: string, variant: Record<string, unknown>, labels: boolean) {
  const angle = number(variant.hatch_angle, 45);
  if (kind === "hatch-ladder") {
    const boxes = [0, 1, 2, 3, 4].map((step) => {
      const x = 105 + step * 175;
      const spacing = 48 - step * 8;
      const lines = Array.from({ length: 15 }, (_, index) => `<path d="M${x + index * spacing - 120} 690 L${x + index * spacing + 160} 310"/>`).join("");
      return `<clipPath id="clip-${step}"><rect x="${x}" y="350" width="135" height="300" rx="8"/></clipPath><rect x="${x}" y="350" width="135" height="300" rx="8"/><g clip-path="url(#clip-${step})" transform="rotate(${angle - 45} ${x + 67} 500)">${step ? lines : ""}</g>${label(x + 55, 690, String(step + 1), labels)}`;
    }).join("");
    return `${boxes}${label(105, 300, "light → dark by spacing", labels)}`;
  }
  const lightRight = String(variant.light_side ?? variant.light_direction ?? "left").includes("right");
  const hatch = Array.from({ length: 20 }, (_, index) => {
    const y = 295 + index * 25;
    const inset = Math.abs(500 - y) * 0.35;
    return `<path class="guide" d="M${270 + inset} ${y} C410 ${y + 45} 590 ${y + 45} ${730 - inset} ${y}"/>`;
  }).join("");
  if (kind === "hatch-form") return `<circle cx="500" cy="500" r="275"/>${hatch}<path class="axis" d="M500 215 V785"/>${label(525, 245, "turn strokes around form", labels)}`;
  return `<circle cx="500" cy="465" r="265"/><path class="guide" d="M500 205 C${lightRight ? 395 : 605} 340 ${lightRight ? 395 : 605} 590 500 730"/><ellipse class="hidden" cx="${lightRight ? 360 : 640}" cy="790" rx="230" ry="55"/><path class="arrow" d="M${lightRight ? 800 : 200} 140 L${lightRight ? 665 : 335} 270"/>${label(lightRight ? 705 : 185, 120, "light", labels)}${label(lightRight ? 310 : 565, 500, "core shadow", labels)}${label(430, 870, "cast shadow", labels)}`;
}

function headGuide(variant: Record<string, unknown>, labels: boolean) {
  const view = String(variant.view ?? "three-quarter");
  const centerX = view === "profile" ? 575 : view === "three-quarter" ? 555 : 500;
  const tilt = number(variant.tilt, 0);
  return `<g transform="rotate(${tilt} 500 500)"><ellipse cx="500" cy="430" rx="245" ry="285"/><path d="M285 465 C300 650 375 790 500 840 C625 790 700 650 715 465"/><path class="axis" d="M${centerX} 165 C${centerX + (view === "profile" ? 70 : 15)} 380 ${centerX + (view === "profile" ? 45 : -10)} 650 500 840"/><path class="guide" d="M285 410 C410 365 590 365 715 410 M305 500 C420 465 580 465 695 500 M335 610 C430 585 570 585 665 610 M390 705 C455 690 545 690 610 705"/><ellipse class="guide" cx="270" cy="510" rx="38" ry="75"/><ellipse class="guide" cx="730" cy="510" rx="38" ry="75"/>${label(720, 390, "brow", labels)}${label(690, 490, "eyes", labels)}${label(650, 600, "nose", labels)}${label(600, 695, "mouth", labels)}</g>`;
}

export function validateOverlaySize(width: number, height: number): string | null {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 256 || height < 256) return "Use whole-number dimensions of at least 256 pixels.";
  if (width * height > MAX_OVERLAY_PIXELS) return "Keep the canvas at or below 16.8 megapixels for reliable iPad export.";
  return null;
}

export function overlayFilename(exerciseSlug: string, seed: number, width: number, height: number) {
  const suffix = Math.abs(seed).toString(16).slice(-4).padStart(4, "0");
  return `wanderline-${exerciseSlug}-${suffix}-${width}x${height}.png`;
}

export function renderOverlaySvg({ exercise, attempt, settings }: OverlayInput) {
  const { width, height } = settings;
  const error = validateOverlaySize(width, height);
  if (error) throw new Error(error);
  const color = /^#[0-9a-f]{6}$/i.test(settings.color) ? settings.color : "#d94f35";
  const opacity = Math.max(0.1, Math.min(1, settings.opacity));
  const lineWeight = Math.max(1, Math.min(12, settings.lineWeight));
  const kind = exercise.visual_kind;
  let drawing: string;
  if (kind === "one-point" || kind === "two-point") drawing = perspectiveGuide(kind, attempt.variant_data, settings.labels);
  else if (kind === "hatch-ladder" || kind === "hatch-form" || kind === "light-logic") drawing = hatchGuide(kind, attempt.variant_data, settings.labels);
  else if (kind === "head-construction") drawing = headGuide(attempt.variant_data, settings.labels);
  else drawing = primitiveGuide(attempt.variant_data, kind, settings.labels);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet"><style>path,ellipse,circle,rect{fill:none;stroke:${color};stroke-width:${lineWeight};stroke-linecap:round;stroke-linejoin:round;opacity:${opacity}}.axis{stroke-dasharray:18 13}.hidden{stroke-dasharray:11 13;opacity:${opacity * 0.58}}.guide{stroke-width:${lineWeight * 0.78}}.point{fill:${color}}.arrow{marker-end:url(#arrow)}.label{fill:${color};font:600 28px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;opacity:${opacity}}text{stroke:none}</style><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="${color}" stroke="none" opacity="${opacity}"/></marker></defs><g transform="translate(60 60) scale(.88)">${drawing}</g></svg>`;
}

export async function renderOverlayPng(input: OverlayInput): Promise<Blob> {
  const svg = renderOverlaySvg(input);
  const source = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("The overlay preview could not be rendered."));
      element.src = source;
    });
    const canvas = document.createElement("canvas");
    canvas.width = input.settings.width;
    canvas.height = input.settings.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PNG export is not available in this browser.");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG export failed.")), "image/png"));
  } finally {
    URL.revokeObjectURL(source);
  }
}
