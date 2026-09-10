import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { PaintingLesson } from "../src/lesson-model";
const apple = JSON.parse(readFileSync(new URL("./fixtures/simple-recipe-v1/apple.json", import.meta.url), "utf8")) as PaintingLesson;

for (const width of [390, 1440]) {
  test(`approved recipe v1 at ${width}px`, async ({ page }) => {
    const mutations: string[] = [];
    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      if (request.method() !== "GET") mutations.push(request.url());
      const asset = apple.assets.find((item) => request.url().endsWith(item.image_url));
      if (asset) return route.fulfill({ contentType: "image/png", body: readFileSync(new URL(`./fixtures/simple-recipe-v1/${asset.role === "target_reference" ? "painting" : "outline"}.png`, import.meta.url)) });
      if (request.url().endsWith(`/painting-lessons/${apple.id}`)) return route.fulfill({ json: apple });
      return route.fulfill({ json: [] });
    });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`/?view=lesson&lesson=${apple.id}`);
    const sheet = page.getByRole("region", { name: "Simple painting recipe" });
    await expect(page.getByAltText("Simple finished watercolor painting")).toBeVisible();
    await expect(sheet).toHaveScreenshot(`apple-${width}.png`, { animations: "disabled" });
    await page.getByRole("button", { name: "Print Outline", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Print Outline" });
    await expect(page.getByRole("combobox", { name: "Tracing size", exact: true })).toHaveValue("6");
    await expect(page.getByRole("combobox", { name: "Paper", exact: true })).toHaveValue("A4");
    await expect(page.getByRole("button", { name: "Print tracing outline" })).toBeEnabled();
    await expect(dialog).toHaveScreenshot(`print-${width}.png`);
    await page.addStyleTag({ content: "html { font-size: 200%; }" });
    expect(await dialog.evaluate((node) => [...node.querySelectorAll("*")].filter((child) => { const r = child.getBoundingClientRect(); return r.width > 0 && (r.left < 0 || r.right > innerWidth + 1 || child.scrollWidth > child.clientWidth + 1); }).map((child) => child.className))).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Print Outline", exact: true })).toBeFocused();
    await page.reload();
    await expect(sheet).toBeVisible();
    expect(mutations).toEqual([]);
  });
}
