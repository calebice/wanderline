import { expect, test, type Page } from "@playwright/test";

const patterns = ["Explore", "Artwork stage", "Painting recipe", "Sessions", "Form & dialog", "Settings", "Color mixing"];

async function selectPattern(page: Page, name: string) {
  await page.getByRole("group", { name: "Page pattern", exact: true }).getByRole("button", { name, exact: true }).click();
  return page.getByRole("region", { name: `${name} page example`, exact: true });
}

async function expectContentsFit(page: Page) {
  const violations = await page.locator(".design-reference").evaluate((root) => {
    return [...root.querySelectorAll<HTMLElement>("*")].filter((node) => {
      const bounds = node.getBoundingClientRect();
      if (!bounds.width || !bounds.height || node.closest("dialog:not([open])") || node.closest(".design-pigment-study")) return false;
      if (node.closest(".garden-table")) return false; // Explicit, labeled horizontal scroll region.
      const parent = node.parentElement!.getBoundingClientRect();
      return node.scrollWidth > node.clientWidth + 2 || bounds.left < parent.left - 2 || bounds.right > parent.right + 2;
    }).map((node) => `${node.tagName}.${node.className}`);
  });
  expect(violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

test("color mixing proposal preserves instructions while recording adjustments", async ({ page }) => {
  const apiRequests: string[] = [];
  await page.route("**/api/**", (route) => { apiRequests.push(route.request().url()); return route.abort(); });
  await page.goto("/internal/design-system");
  const example = await selectPattern(page, "Color mixing");
  await expect(example.locator(".mixing-proposal__palette li")).toHaveCount(18);
  const families = example.getByRole("group", { name: "Color family", exact: true });
  await expect(families.getByRole("button")).toHaveCount(10);
  await expect(example.getByRole("combobox")).toHaveCount(0);
  const bounds = await families.getByRole("button").evaluateAll((buttons) => buttons.map((button) => { const r = button.getBoundingClientRect(); return { left: r.left, top: r.top, bottom: r.bottom }; }));
  expect(bounds.every((r, i) => Math.abs(r.left - bounds[0].left) < 1 && (i === 0 || r.top >= bounds[i - 1].bottom))).toBe(true);
  await expect(example.getByRole("button", { name: "Olive green", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(example.locator(".is-used")).toHaveText([/Lemon Yellow1 · Start/, /Green Deep2 · Add/, /Burnt Umber3 · Add/]);
  await expect(example.locator(".mixing-proposal__steps li")).toHaveCount(3);
  await example.getByRole("group", { name: "Color family", exact: true }).getByRole("button", { name: "Grays", exact: true }).click();
  await expect(example.getByRole("group", { name: "Grays · 6 shades" }).getByRole("button")).toHaveCount(6);
  await expect(example.getByRole("button", { name: "Olive green", exact: true })).toHaveCount(0);
  await example.getByRole("button", { name: "Slate gray", exact: true }).click();
  await expect(example.locator(".is-used")).toHaveText([/Ultramarine/, /Burnt Umber/]);
  const startingSteps = await example.locator(".mixing-proposal__steps").innerText();
  await example.getByRole("button", { name: "Too blue", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(example.locator(".mixing-proposal__guidance")).toContainText("Burnt Umber");
  await expect(example.locator(".mixing-proposal__steps")).toHaveText(startingSteps, { useInnerText: true });
  await example.getByLabel("Notes for next time").fill("More brown worked.");
  await example.getByRole("button", { name: "Save example mix" }).click();
  await expect(example.getByRole("status")).toContainText("Example saved in memory");
  await example.getByRole("button", { name: "Slate gray", exact: true }).click();
  await expect(example.getByLabel("Notes for next time")).toHaveValue("More brown worked.");
  await example.getByRole("group", { name: "Color family", exact: true }).getByRole("button", { name: "Pinks", exact: true }).click();
  await example.getByRole("button", { name: "Soft rose", exact: true }).click();
  await expect(example.locator(".is-used")).toHaveCount(1);
  await expect(example.getByLabel("Notes for next time")).toHaveValue("");
  await expect(example.locator(".mixing-proposal__guidance")).toHaveCount(0);
  expect(apiRequests).toEqual([]);
});

test("reference patterns work locally and preserve the frozen recipe and modal behavior", async ({ page }) => {
  const apiRequests: string[] = [];
  await page.route("**/api/**", (route) => { apiRequests.push(route.request().url()); return route.abort(); });
  await page.goto("/internal/design-system");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Garden Studio");
  await expect(page.getByText("Approved design system", { exact: true })).toBeVisible();
  const explore = page.getByRole("region", { name: "Explore page example", exact: true });
  await explore.getByRole("button", { name: "Start painting", exact: true }).click();
  const recipe = page.getByRole("region", { name: "Simple painting recipe", exact: true });
  await expect(recipe.getByRole("listitem")).toHaveCount(6);
  await expect(recipe.getByText("Paint the apple light red, leaving the shine and stem unpainted.")).toBeVisible();
  const enlarge = recipe.getByRole("button", { name: "Enlarge painting", exact: true });
  await enlarge.focus();
  await page.keyboard.press("Enter");
  const artDialog = page.getByRole("dialog", { name: "Enlarged painting", exact: true });
  await expect(artDialog.getByRole("img", { name: "Enlarged painting reference" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(enlarge).toBeFocused();
  await recipe.getByRole("button", { name: "Print Outline", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Print Outline", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Print tracing outline", exact: true })).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(recipe.getByRole("button", { name: "Print Outline", exact: true })).toBeFocused();
  const artwork = await selectPattern(page, "Artwork stage");
  for (const feeling of ["Sad", "Heaviness", "Pensive", "Awed", "Joy"]) {
    await artwork.getByRole("button", { name: feeling, exact: true }).click();
    await expect(artwork.getByRole("button", { name: feeling, exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(await artwork.locator("img").evaluate((img: HTMLImageElement) => img.getAttribute("src"))).toContain(feeling.toLowerCase());
  }
  const sessions = await selectPattern(page, "Sessions");
  await sessions.getByRole("button", { name: "In progress", exact: true }).click();
  await expect(sessions.getByRole("heading", { name: "No sessions in progress" })).toBeVisible();
  const form = await selectPattern(page, "Form & dialog");
  await form.getByRole("button", { name: "Save example", exact: true }).click();
  await expect(form.getByLabel("Painting title", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(form.getByLabel("Painting title", { exact: true })).toHaveAccessibleDescription(/Enter a title/);
  const contrast = await form.getByLabel("Painting title", { exact: true }).evaluate((input) => {
    const luminance = (color: string) => {
      const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((value) => value / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
      return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    };
    const style = getComputedStyle(input);
    const values = [luminance(style.color), luminance(style.backgroundColor)].sort((a, b) => b - a);
    return (values[0] + .05) / (values[1] + .05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  await form.getByLabel("Painting title", { exact: true }).fill("Sunlight on paper");
  await form.getByRole("button", { name: "Save example", exact: true }).click();
  await expect(form.getByRole("status")).toContainText("Sunlight on paper");
  await form.getByRole("button", { name: "Outline options", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Example outline options", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Done", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close dialog" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(form.getByRole("button", { name: "Outline options", exact: true })).toBeFocused();
  const settings = await selectPattern(page, "Settings");
  await settings.getByLabel("Show operations").selectOption("layers");
  await expect(settings.getByRole("row")).toHaveCount(2);
  await page.getByRole("group", { name: "Feedback state" }).getByRole("button", { name: "Error", exact: true }).click();
  await page.getByRole("alert").getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("status")).toContainText("Your painting session is ready to reopen.");
  await page.getByRole("link", { name: "View foundations" }).click();
  await expect(page).toHaveURL(/\/internal\/design-system#design-foundations/);
  expect(apiRequests).toEqual([]);
});

for (const width of [390, 768, 1440]) {
  test(`reference layouts at ${width}px with enlarged text`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/internal/design-system");
    for (const textSize of [100, 200]) {
      await page.evaluate((size) => { document.documentElement.style.fontSize = `${size}%`; }, textSize);
      for (const name of patterns) {
        const region = await selectPattern(page, name);
        await expectContentsFit(page);
        if (name === "Artwork stage") {
          for (const feeling of ["Sad", "Heaviness", "Pensive", "Awed", "Joy"]) {
            await region.getByRole("button", { name: feeling, exact: true }).click();
            await expectContentsFit(page);
          }
        }
        if (name === "Color mixing") {
          for (const family of ["reds", "oranges", "yellows", "greens", "teals", "blues", "purples", "pinks", "browns", "grays"]) {
            await region.getByRole("group", { name: "Color family", exact: true }).getByRole("button", { name: new RegExp(`^${family}$`, "i") }).click();
            for (const target of await region.locator(".mixing-proposal__targets button").all()) {
              await target.click();
              await region.locator(".mixing-proposal__adjustments button").first().click();
              await expectContentsFit(page);
            }
          }
          await page.screenshot({ path: test.info().outputPath(`mixing-${width}-${textSize}.png`), fullPage: true });
        }
        if (name === "Form & dialog") {
          await region.getByRole("button", { name: "Outline options", exact: true }).click();
          const dialog = page.getByRole("dialog", { name: "Example outline options" });
          expect(await dialog.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
          await page.keyboard.press("Escape");
        }
      }
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    const button = page.getByRole("group", { name: "Page pattern" }).getByRole("button").first();
    expect(await button.evaluate((node) => getComputedStyle(node).transitionDuration)).toBe("0s");
    await page.evaluate(() => { document.documentElement.style.fontSize = "100%"; });
    await selectPattern(page, "Explore");
    await page.screenshot({ path: test.info().outputPath(`reference-${width}.png`), fullPage: true });
  });
}

for (const [width, height] of [[1366, 768], [1440, 900], [1024, 768], [768, 1024]]) {
  test(`complete compact recipe fits ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/internal/design-system");
    await selectPattern(page, "Painting recipe");
    const sheet = page.getByRole("region", { name: "Simple painting recipe", exact: true });
    await expect(sheet.getByRole("heading", { name: "Mix your colors" })).toBeInViewport();
    const bounds = await sheet.evaluate((node) => {
      const selectors = [".recipe-sheet__heading", ".recipe-sheet__art img", ".recipe-sheet__steps", ".recipe-sheet__mixing"];
      return selectors.map((selector) => {
        const element = node.querySelector(selector)!;
        const rect = element.getBoundingClientRect();
        return { selector, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
      });
    });
    for (const box of bounds) {
      expect(box.top, JSON.stringify(box)).toBeGreaterThanOrEqual(0);
      expect(box.bottom, JSON.stringify(box)).toBeLessThanOrEqual(height);
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(width);
    }
    const sizes = await sheet.locator(".recipe-sheet__steps > li, .recipe-sheet__mixing li div, .recipe-sheet__mixing > p").evaluateAll((nodes) => nodes.map((node) => parseFloat(getComputedStyle(node).fontSize)));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(16);
    expect(await sheet.locator(".recipe-sheet__art img").evaluate((node) => getComputedStyle(node).objectFit)).toBe("contain");
    await expectContentsFit(page);
    await page.screenshot({ path: test.info().outputPath(`compact-${width}x${height}.png`) });
  });
}
