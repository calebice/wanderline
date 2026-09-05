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

test("greenhouse comparison restores its approved watercolor and architectural views", async ({ page }) => {
  await page.goto("/?subject=greenhouse&style=watercolor");
  await expect(page.getByRole("button", { name: /Greenhouse after rain/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByAltText(/Transparent watercolor of a warm glass greenhouse/)).toBeVisible();
  await page.getByRole("button", { name: /Architectural drawing/ }).click();
  await expect(page).toHaveURL(/subject=greenhouse&style=architectural/);
  await expect(page.getByAltText(/Elevated axonometric architectural drawing/)).toBeVisible();
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

test("Feeling First keeps its compact selector attached to the artwork", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1366, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/?view=feeling-first&emotion=pensive");
    const layout = await page.evaluate(() => {
      const selector = document.querySelector<HTMLElement>(".emotion-gallery__selector");
      const artwork = document.querySelector<HTMLElement>(".emotion-gallery__artwork");
      if (!selector || !artwork) return null;
      const selectorRect = selector.getBoundingClientRect();
      const artworkRect = artwork.getBoundingClientRect();
      return {
        selectorPosition: getComputedStyle(selector).position,
        gap: artworkRect.top - selectorRect.bottom,
        artworkTop: artworkRect.top,
        viewportHeight: window.innerHeight,
      };
    });

    expect(layout).not.toBeNull();
    expect(layout!.selectorPosition).toBe("sticky");
    expect(layout!.gap).toBeLessThanOrEqual(20);
    expect(layout!.artworkTop).toBeLessThan(layout!.viewportHeight);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?view=feeling-first&emotion=pensive");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.getByRole("button", { name: "Joy" }).click();
  await expect(page).toHaveURL(/emotion=joy/);
  const artworkIsVisible = await page.locator(".emotion-gallery__artwork").evaluate((artwork) => {
    const rect = artwork.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  });
  expect(artworkIsVisible).toBe(true);
});

test("Feeling First copy remains inside its panel with enlarged text", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  for (const emotion of ["sad", "heaviness", "pensive", "awed", "joy"]) {
    await page.goto(`/?view=feeling-first&emotion=${emotion}`);
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    const layout = await page.locator(".emotion-gallery__workspace").evaluate((workspace) => {
      const panel = workspace.querySelector<HTMLElement>("aside");
      if (!panel) return null;
      const workspaceRect = workspace.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      return {
        panelRight: panelRect.right,
        workspaceRight: workspaceRect.right,
        panelScrollWidth: panel.scrollWidth,
        panelClientWidth: panel.clientWidth,
        overflowingChildren: [...panel.children].filter((child) => {
          const rect = child.getBoundingClientRect();
          return rect.left < panelRect.left - 0.5 || rect.right > panelRect.right + 0.5;
        }).length,
      };
    });

    expect(layout).not.toBeNull();
    expect(layout!.panelRight).toBeLessThanOrEqual(layout!.workspaceRight + 0.5);
    expect(layout!.panelScrollWidth).toBeLessThanOrEqual(layout!.panelClientWidth);
    expect(layout!.overflowingChildren).toBe(0);
  }
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
