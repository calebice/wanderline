import { apiUrl, request } from "./lesson-api";

export type ColorMixPaint = { name: string; color: string };
export type ColorMixFamily = { id: string; name: string; color: string };
export type ColorMixRecipe = {
  id: string;
  family: string;
  name: string;
  color: string;
  ingredients: Array<{ paint: string; amount: string; role: string }>;
  water: string;
  correction: { label: string; paint: string; instruction: string };
};
export type ColorMixCatalog = {
  schema_version: "color-mix-catalog.v1";
  version: number;
  palette: { id: string; name: string; paints: ColorMixPaint[] };
  families: ColorMixFamily[];
  recipes: ColorMixRecipe[];
  guidance_status: "illustrative";
  guidance_note: string;
};
export type ColorMixTrial = {
  id: string;
  recipe: ColorMixRecipe;
  catalog_version: number;
  adjustments: string[];
  notes: string;
  revision: number;
  created_at: string;
  updated_at: string;
};

export type ColorSwatchSourceType = "single_paint" | "catalog_mix" | "custom_mix";
export type ColorSwatchIngredient = { paint: string; parts: number };
export type ColorSwatchEditable = {
  name: string;
  ingredients: ColorSwatchIngredient[];
  paper: { brand: string; product: string; weight_texture: string };
  capture: { card_brand: string; card_model: string; lighting: "indirect_daylight" | "neutral_artificial" | "other"; other_lighting: string; card_visible: boolean };
  appearance: { value: "light" | "mid" | "dark"; temperature: "warm" | "neutral" | "cool"; chroma: "muted" | "moderate" | "vivid" };
  traits: { transparency: "" | "transparent" | "semi_transparent" | "opaque"; granulation: "" | "none" | "some" | "strong"; lifting: "" | "lifts_easily" | "lifts_some" | "staining"; water_notes: string; drying_notes: string };
  comparison: null | { value: "lighter" | "same" | "darker"; temperature: "cooler" | "same" | "warmer"; chroma: "duller" | "same" | "brighter"; close: boolean };
  notes: string;
  tested_on: string;
};
export type ColorSwatch = ColorSwatchEditable & {
  id: string;
  schema_version: "color-swatch.v1";
  source_type: ColorSwatchSourceType;
  palette_id: string;
  catalog_version: number;
  family: string | null;
  source_snapshot: Record<string, unknown>;
  image_url: string;
  image_width: number;
  image_height: number;
  revision: number;
  created_at: string;
  updated_at: string;
};

export function getColorMixCatalog() {
  return request<ColorMixCatalog>("/api/v1/color-mixing/catalog");
}

export function listColorMixTrials() {
  return request<ColorMixTrial[]>("/api/v1/color-mixing/trials");
}

export function createColorMixTrial(recipeId: string, catalogVersion: number, adjustments: string[], notes: string) {
  return request<ColorMixTrial>("/api/v1/color-mixing/trials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipe_id: recipeId, catalog_version: catalogVersion, adjustments, notes }) });
}

export function updateColorMixTrial(trialId: string, expectedRevision: number, adjustments: string[], notes: string) {
  return request<ColorMixTrial>(`/api/v1/color-mixing/trials/${trialId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expected_revision: expectedRevision, adjustments, notes }) });
}

function hydrateSwatch(swatch: ColorSwatch): ColorSwatch {
  return { ...swatch, image_url: apiUrl(swatch.image_url) };
}

export async function listColorSwatches() {
  return (await request<ColorSwatch[]>("/api/v1/color-mixing/swatches")).map(hydrateSwatch);
}

export async function getColorSwatch(id: string) {
  return hydrateSwatch(await request<ColorSwatch>(`/api/v1/color-mixing/swatches/${id}`));
}

export async function createColorSwatch(metadata: ColorSwatchEditable & { source_type: ColorSwatchSourceType; palette_id: string; catalog_version: number; recipe_id: string | null }, image: File) {
  const body = new FormData();
  body.append("metadata", JSON.stringify(metadata));
  body.append("image", image);
  return hydrateSwatch(await request<ColorSwatch>("/api/v1/color-mixing/swatches", { method: "POST", body }));
}

export async function updateColorSwatch(id: string, metadata: ColorSwatchEditable, expectedRevision: number) {
  return hydrateSwatch(await request<ColorSwatch>(`/api/v1/color-mixing/swatches/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...metadata, expected_revision: expectedRevision }) }));
}

export async function replaceColorSwatchImage(id: string, image: File, expectedRevision: number) {
  const body = new FormData();
  body.append("expected_revision", String(expectedRevision));
  body.append("image", image);
  return hydrateSwatch(await request<ColorSwatch>(`/api/v1/color-mixing/swatches/${id}/image`, { method: "PUT", body }));
}

export async function deleteColorSwatch(id: string) {
  const response = await fetch(apiUrl(`/api/v1/color-mixing/swatches/${id}`), { method: "DELETE" });
  if (!response.ok) throw new Error("This swatch couldn’t be deleted. Try again.");
}
