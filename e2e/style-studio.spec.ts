import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test("root restores and updates a shareable comparison", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/?subject=bouquet&style=watercolor");
  await expect(page.getByRole("heading", { name: "Style reference studio." })).toBeVisible();
  await expect(page.getByRole("button", { name: /Bouquets & vessels/ })).toHaveAttribute("aria-pressed", "true");
  const styles = page.getByRole("group", { name: /Choose a drawing language/ });
  await expect(styles.getByRole("button", { name: /Watercolor/ })).toHaveAttribute("aria-pressed", "true");
  await styles.getByRole("button", { name: /Cartoon/ }).click();
  await expect(page).toHaveURL(/\?subject=bouquet&style=cartoon$/);
  await expect(page.getByAltText(/Playful high-angle cartoon illustration/)).toBeVisible();
  expect(requests.some((url) => url.includes("/api"))).toBe(false);
  expect(await page.evaluate(() => "serviceWorker" in navigator && Boolean(navigator.serviceWorker.controller))).toBe(false);
});

test("teaching guides restore, paginate, and retain accessible landmarks", async ({ page }) => {
  await page.goto("/?view=guide&style=watercolor");
  await expect(page.getByRole("heading", { name: "Watercolor", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Seven decisions behind the result." })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Browse style guides" })).toBeVisible();
  await page.getByRole("link", { name: /Anime environment/ }).click();
  await expect(page).toHaveURL(/view=guide&style=anime-environment/);
  await expect(page.getByRole("heading", { name: "Anime environment", level: 1 })).toBeVisible();
});

test("Feeling First restores all controls and survives reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?view=feeling-first&emotion=joy");
  await expect(page.getByRole("heading", { name: "Feeling First", level: 1 })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Emotional interpretation" })).toHaveAttribute("aria-valuetext", "Joy: Skyward");
  await page.getByRole("button", { name: "Pensive" }).click();
  await expect(page).toHaveURL(/emotion=pensive/);
  await expect(page.getByAltText(/tiny traveler rests beside a warm campfire/)).toBeVisible();
});

for (const viewport of [
  { name: "phone", width: 390, height: 844 },
  { name: "iPad", width: 820, height: 1180 },
  { name: "laptop", width: 1366, height: 900 },
  { name: "wide desktop", width: 1680, height: 1050 },
]) {
  test(`${viewport.name} layout has no horizontal clipping`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Style reference studio." })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.goto("/?view=guide&style=anime-environment");
    await expect(page.getByRole("heading", { name: "Anime environment", level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}
