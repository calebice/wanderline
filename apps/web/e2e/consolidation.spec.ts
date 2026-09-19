import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const catalog = JSON.parse(readFileSync(new URL("../../api/app/color_mixing_catalog.json", import.meta.url), "utf8"));

function session(id: string, title: string, savedAt: string | null) {
  return {
    id,
    title,
    saved_at: savedAt,
    generation_status: "completed",
    generation_error: null,
    generation_brief: { stage_count: 3 },
    estimated_duration_minutes: 30,
    latest_run_id: null,
    latest_run_scope: null,
    content: { stages: [] },
    assets: [],
    approved_target_asset_id: null,
  };
}

test("home prioritizes the active session and reflows across primary viewports", async ({ page }) => {
  await page.route("**/api/v1/painting-lessons?state=all", (route) => route.fulfill({
    json: [session("active-session", "Rainy greenhouse", null), session("saved-session", "Little lemon", "2026-09-18T12:00:00Z")],
  }));

  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Rainy greenhouse" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open session", exact: true })).toHaveAttribute("href", "/sessions/active-session/edit");
    await expect(page.getByRole("heading", { name: "Little lemon" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start painting", exact: true }).first()).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
});

test("production color mixing saves and reopens versioned learner history", async ({ page }) => {
  let savedTrial: Record<string, unknown> | null = null;
  await page.route("**/api/v1/color-mixing/catalog", (route) => route.fulfill({ json: catalog }));
  await page.route("**/api/v1/color-mixing/trials", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: savedTrial ? [savedTrial] : [] });
    const body = route.request().postDataJSON();
    savedTrial = {
      id: "trial-1",
      recipe: catalog.recipes.find((recipe: { id: string }) => recipe.id === body.recipe_id),
      catalog_version: body.catalog_version,
      adjustments: body.adjustments,
      notes: body.notes,
      revision: 1,
      created_at: "2026-09-18T12:00:00Z",
      updated_at: "2026-09-18T12:00:00Z",
    };
    return route.fulfill({ status: 201, json: savedTrial });
  });

  await page.goto("/color-mixing");
  await expect(page.getByRole("heading", { name: "Mix a color", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Too brown" }).click();
  await page.getByLabel("Notes for next time").fill("Less umber on cotton paper.");
  await page.getByRole("button", { name: "Save color trial" }).click();
  await expect(page.getByRole("status")).toContainText("Color trial saved");
  await expect(page.getByText("Saved color trials (1)")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Notes for next time")).toHaveValue("Less umber on cotton paper.");
  await expect(page.getByRole("button", { name: "Update color trial" })).toBeVisible();
});
