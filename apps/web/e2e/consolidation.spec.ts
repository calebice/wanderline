import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const catalog = JSON.parse(readFileSync(new URL("../../api/app/color_mixing_catalog.json", import.meta.url), "utf8"));

function session(id: string, title: string, savedAt: string | null, updatedAt = "2026-09-18T12:00:00Z") {
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
    content: { stages: [{ id: "one" }] },
    assets: [{ id: `${id}-target`, role: "target_reference", image_url: "/watercolor-lesson/lemon/reference.jpg", alt_text: `${title} watercolor reference` }],
    approved_target_asset_id: `${id}-target`,
    updated_at: updatedAt,
  };
}

test("home offers a manual rail of ready references and reflows across primary viewports", async ({ page }) => {
  await page.route("**/api/v1/painting-lessons?state=all", (route) => route.fulfill({
    json: [session("older-reference", "Rainy greenhouse", "2026-09-18T12:00:00Z", "2026-09-17T12:00:00Z"), session("newer-reference", "Little lemon", "2026-09-18T12:00:00Z", "2026-09-18T12:00:00Z")],
  }));

  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Little lemon" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Paint this reference", exact: true }).first()).toHaveAttribute("href", "/sessions/newer-reference");
    await expect(page.getByRole("button", { name: "Next painting reference" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent sessions" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Start painting", exact: true }).first()).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }

  await page.getByRole("button", { name: "Next painting reference" }).click();
  await expect(page.getByText("Reference 2 of 2")).toBeAttached();
  await page.getByRole("region", { name: "Painting references" }).press("ArrowLeft");
  await expect(page.getByText("Reference 1 of 2")).toBeAttached();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const rail = page.locator(".reference-carousel__rail");
  const initialScroll = await rail.evaluate((element) => element.scrollLeft);
  await page.waitForTimeout(300);
  expect(await rail.evaluate((element) => element.scrollLeft)).toBe(initialScroll);
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect(await page.locator(".reference-carousel__slide:first-child h3, .reference-carousel__slide:first-child p, .reference-carousel__slide:first-child a").evaluateAll((elements) => elements.filter((element) => element.scrollWidth > element.clientWidth + 2).length)).toBe(0);
});

test("home keeps unfinished work outside the reference rail", async ({ page }) => {
  const unfinished = { ...session("unfinished", "Cloud study", null), content: null, approved_target_asset_id: null, assets: [], generation_status: "generating", latest_run_id: "run-1", latest_run_scope: "target" };
  const missingImage = { ...session("missing", "Missing artwork", null), assets: [] };
  await page.route("**/api/v1/painting-lessons?state=all", (route) => route.fulfill({ json: [unfinished, missingImage] }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "No painting references are ready yet." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue preparing Cloud study →" })).toHaveAttribute("href", "/sessions/unfinished/build/run-1?next=target");
  await expect(page.getByRole("region", { name: "Painting references" })).toHaveCount(0);
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
