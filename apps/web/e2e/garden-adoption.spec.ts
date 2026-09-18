import { expect, test } from "@playwright/test";

for (const width of [390, 768, 1440]) {
  test(`Feeling First selector is unchanged by adoption at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/?view=feeling-first&emotion=pensive");
    const selector = page.locator(".emotion-gallery__selector");
    await expect(selector).toBeVisible();
    const measure = () => selector.evaluate((root) => [root, ...root.querySelectorAll("*")].map((node) => {
      const css = getComputedStyle(node);
      return Object.fromEntries(["color", "backgroundColor", "backgroundImage", "fontSize", "fontFamily", "padding", "border", "borderRadius", "boxShadow", "width", "height", "position", "top", "gap"].map((key) => [key, css.getPropertyValue(key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`))]));
    }));
    const adopted = await measure();
    await page.evaluate(() => {
      const style = [...document.querySelectorAll<HTMLStyleElement>("style[data-vite-dev-id]")].find((node) => node.dataset.viteDevId?.endsWith("/garden-application.css"));
      if (!style?.sheet) throw new Error("Application style layer not found");
      style.sheet.disabled = true;
    });
    expect(adopted).toEqual(await measure());
  });
}

for (const width of [390, 768, 1440]) {
  test(`adopted pages reflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route("**/api/**", (route) => route.fulfill({ json: route.request().url().includes("/studio/usage") ? { currency: "USD", estimated_cost_usd: 0, unknown_calls: 0, untracked_runs: 0, groups: [] } : [] }));
    for (const query of ["", "view=guide&style=realism", "view=guide&style=cartoon", "view=guide&style=architectural", "view=guide&style=watercolor", "view=guide&style=anime-environment", "view=color-study", "view=feeling-first", "view=sessions", "view=settings", "view=watercolor-lesson", "view=lesson-create"]) {
      await page.goto(`/?${query}`);
      for (const size of [100, 200]) {
        await page.evaluate((value) => { document.documentElement.style.fontSize = `${value}%`; }, size);
        const failures = await page.locator(".site-shell.studio-aligned").evaluate((root) => [...root.querySelectorAll<HTMLElement>("h1,h2,h3,p,button,label")].filter((el) => {
          const box = el.getBoundingClientRect();
          if (!box.width || !box.height || el.closest('dialog:not([open]),[hidden],.emotion-gallery__selector') || getComputedStyle(el).position === "absolute") return false;
          const parent = el.parentElement!.getBoundingClientRect();
          const scrolls = getComputedStyle(el.parentElement!).overflowX === "auto";
          return el.scrollWidth > el.clientWidth + 2 || (!scrolls && (box.left < parent.left - 2 || box.right > parent.right + 2));
        }).map((el) => `${el.tagName}.${el.className}: ${el.textContent?.slice(0, 35)}`));
        expect(failures, `${query} at ${size}%`).toEqual([]);
      }
    }
  });
}
