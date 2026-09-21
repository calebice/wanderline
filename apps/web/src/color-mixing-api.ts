import { request } from "./lesson-api";

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
