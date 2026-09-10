import { Color, mix } from "spectral.js";
import type { Hue, Partner } from "./color-study-catalog";

type RGB = readonly [number, number, number];
export const STUDY_COLORS: readonly { id: Hue; name: string; rgb: RGB }[] = [
  { id: "red", name: "Red", rgb: [205, 67, 72] },
  { id: "orange", name: "Orange", rgb: [223, 136, 66] },
  { id: "yellow", name: "Yellow", rgb: [226, 196, 86] },
  { id: "lime", name: "Lime", rgb: [168, 184, 90] },
  { id: "green", name: "Green", rgb: [74, 137, 101] },
  { id: "mint", name: "Mint", rgb: [86, 169, 146] },
  { id: "cyan", name: "Cyan", rgb: [77, 159, 173] },
  { id: "azure", name: "Azure", rgb: [80, 139, 191] },
  { id: "blue", name: "Blue", rgb: [64, 86, 185] },
  { id: "violet", name: "Violet", rgb: [135, 104, 180] },
  { id: "magenta", name: "Magenta", rgb: [170, 91, 150] },
  { id: "rose", name: "Rose", rgb: [204, 113, 139] },
];

export const WASHES = ["Pale", "Light", "Medium", "Rich"] as const;
const strengths = [.22, .43, .7, 1];
const paper: RGB = [250, 248, 242];
export const rgb = (c: RGB) => `rgb(${c.join(",")})`;
export const partnerColor = (p: Partner): RGB => p.rgb ?? STUDY_COLORS.find(c => c.id === p.hue)!.rgb;
export function washColor(color: RGB, wash: number): RGB {
  return color.map((c, i) => Math.round(paper[i] + (c - paper[i]) * strengths[wash])) as unknown as RGB;
}
export function pigmentMix(a: RGB, b: RGB, ratio: number, wash: number): string {
  const t = Math.max(0, Math.min(1, ratio));
  const hex = t === 0 ? rgb(a) : t === 1 ? rgb(b) : mix([new Color([...a]), 1-t], [new Color([...b]), t]).toString();
  const c = hex.startsWith("#") ? [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)) as unknown as RGB : t === 0 ? a : b;
  return rgb(washColor(c, wash));
}
