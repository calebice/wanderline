import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const details = overflow > 1 ? await page.evaluate(() => [...document.querySelectorAll("body *")].filter((element) => { const r = element.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || (element.scrollWidth > element.clientWidth + 1)); }).map((element) => { const r = element.getBoundingClientRect(); return `${element.tagName}.${element.className} rect=${Math.round(r.left)}..${Math.round(r.right)} scroll=${element.scrollWidth}/${element.clientWidth}`; }).slice(0, 30)) : [];
  expect(overflow, JSON.stringify(details)).toBeLessThanOrEqual(1);
}

function checkpointLessonPayload() {
  const stages = Array.from({ length: 5 }, (_, index) => ({
    id: `stage-${index + 1}`,
    title: ["Garden mass", "Vase wash", "Flower structure", "Focal accents", "Finish edges"][index],
    short_title: ["Mass", "Vase", "Flower", "Accents", "Finish"][index],
    time: `${index * 4}–${index * 4 + 4} min`,
    water_state: index < 2 ? "Glossy" : "Damp",
    principle: "Protect the focal shape while the surrounding wash stays connected.",
    instruction: "Use broad connected washes and reserve the flower and vase before adding selective structure.",
    checkpoint_action: index === 0 ? "Build one soft, cool garden mass around the reserved flower and vase." : `Bring the watercolor to checkpoint ${index + 1} with one deliberate pass.`,
    approach_steps: ["Lightly place the structural drawing.", "Join broad washes around the reserved shapes.", "Let the paper settle before the next pass."],
    look_for: "A varied but unfocused background with clear reserved shapes.",
    move_on: "The wash is no longer shiny and the large shapes still read.",
    palette_mix_ids: ["garden"],
  }));
  const asset = (id: string, role: string, stageId: string | null, alt: string) => ({
    id, role, order_index: 0, is_primary: role === "original_reference", stage_id: stageId,
    render_set_id: role === "stage_image" ? "render-1" : null, is_current: true,
    original_content_type: "image/jpeg", display_content_type: "image/jpeg", width: 1536, height: 1024,
    filename: `${id}.jpg`, alt_text: alt, image_url: `/api/v1/lesson-assets/${id}/image`,
  });
  return {
    id: "checkpoint-e2e", schema_version: "painting-lesson.v2", template: "watercolor", medium: "watercolor",
    title: "Sunflowers in a blue-green vase", subject: "Sunflowers", artistic_context: null,
    difficulty: "intermediate", estimated_duration_minutes: 30, source_mode: "upload", scene_prompt: null,
    generation_brief: { source_mode: "upload", sequence_style: "illustrative", scene_prompt: null, stage_count: 5, mood: "as_shown", background: "as_shown", treatment: "natural", custom_mood: null, custom_background: null, custom_treatment: null, additional_direction: null },
    sequence_style_configured: false,
    approved_target_asset_id: "target", active_render_set_id: "render-1", image_generation_available: true,
    content: {
      overview: "A cumulative watercolor study.", learning_objective: "Keep a luminous flower against a quiet garden.",
      composition_crop: "Keep the vase low and the flower off center.", focal_point: "The sunflower face.", large_value_shapes: "Cool garden, pale vase, warm flower.",
      palette: [{ id: "garden", name: "Garden blue-green", swatch: "#5f8378", formula: "Ultramarine + ochre", dilution: "tea", water_parts: 6 }],
      light_shadow: "Reserve the light on the flower.", materials: ["Cold-press paper", "Large round brush", "Watercolors"], underdrawing: "Draw lightly.", wash_control: "Work glossy to damp.",
      edges: { hard: "Flower center", soft: "Garden", lost: "Vase edge" }, details: { preserve: ["Flower"], simplify: ["Garden"], exaggerate: ["Light"], omit: ["Tiny leaves"] },
      common_mistakes: [{ id: "detail", mistake: "Too much detail", correction: "Return to large shapes." }], stages,
      timed_study: { duration_minutes: 8, notice: "Prepare.", start: "Begin.", check: "Check values." }, teaching_guide: [{ id: "guide", title: "Stay broad", body: "Keep marks connected." }],
      reflection_prompts: ["Where did the wash stay luminous?"], completion_notes: "Notice the large relationships.", user_notes: "",
    },
    revision: 1, saved_at: null, generation_status: "completed", generation_error: null, provider_mode: "openai", is_demo: false,
    assets: [asset("original", "original_reference", null, "Original sunflower photo"), ...stages.slice(0, -1).map((stage, index) => asset(`checkpoint-${index + 1}`, "stage_image", stage.id, `Checkpoint ${index + 1}`)), asset("target", "target_reference", stages[4].id, "Approved finished target")],
    created_at: "2026-09-07T12:00:00Z", updated_at: "2026-09-07T12:00:00Z",
  };
}

test("simple recipe stays readable on phones, at enlarged text, and in print", async ({ page }) => {
  const lesson = checkpointLessonPayload();
  lesson.generation_brief.sequence_style = "simple_recipe";
  lesson.generation_brief.stage_count = 3;
  lesson.content.stages = lesson.content.stages.slice(0, 3);
  lesson.assets = lesson.assets.filter((asset) => asset.role === "target_reference");
  lesson.assets.push({ ...lesson.assets[0], id: "outline", role: "tracing_outline", stage_id: "target", image_url: "/api/v1/lesson-assets/outline/image" });
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024"><rect width="768" height="1024" fill="white"/><ellipse cx="384" cy="512" rx="180" ry="250" fill="none" stroke="#555" stroke-width="2"/></svg>';
  await page.route("**/api/v1/lesson-assets/*/image", (route) => route.fulfill({ contentType: "image/svg+xml", headers: route.request().resourceType() === "fetch" ? { "Access-Control-Allow-Origin": "*" } : {}, body: svg }));
  await page.route("**/api/v1/painting-lessons/checkpoint-e2e", (route) => route.fulfill({ json: lesson }));
  await page.goto("/?view=lesson&lesson=checkpoint-e2e");
  await expect(page.getByRole("region", { name: "Simple painting recipe" })).toBeVisible();
  expect(await page.locator(".recipe-sheet h1").evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeLessThanOrEqual(44);
  expect(await page.locator(".recipe-sheet__mixing h2").evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeLessThanOrEqual(18);
  await page.screenshot({ path: test.info().outputPath("simple-recipe.png"), fullPage: true });
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.addStyleTag({ content: "html { font-size: 200%; }" });
    const violations = await page.locator(".recipe-sheet").evaluate((sheet) => {
      const bounds = sheet.getBoundingClientRect();
      return [...sheet.querySelectorAll("*")].filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || node.scrollWidth > node.clientWidth + 1);
      }).map((node) => `${node.tagName}.${node.className}`);
    });
    expect(violations).toEqual([]);
    await expectNoHorizontalOverflow(page);
  }
  await page.addStyleTag({ content: "html { font-size: 100%; }" });
  await page.getByRole("button", { name: "Print Outline", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Print Outline" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Tracing size", exact: true })).toHaveValue("6");
  await expect(page.getByRole("combobox", { name: "Paper", exact: true })).toHaveValue("A4");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Print Outline", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Print Outline", exact: true }).click();
  await expect(page.getByRole("button", { name: "Print tracing outline" })).toBeEnabled();
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "Print tracing outline" })).not.toBeVisible();
  await expect(page.getByAltText("Sized tracing outline for printing")).toBeVisible();
  await expect(page.getByAltText("Simple finished watercolor painting")).not.toBeVisible();
  await expect(page.locator(".recipe-sheet__steps")).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Mix your colors" })).not.toBeVisible();
  expect(await page.getByAltText("Sized tracing outline for printing").evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThan(500);
  const pdf = await page.pdf({ preferCSSPageSize: true });
  expect(pdf.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(1);
  await page.emulateMedia({ media: "screen" });
  await page.getByRole("combobox", { name: "Paper", exact: true }).selectOption("Letter");
  await page.getByRole("combobox", { name: "Tracing size", exact: true }).selectOption("8");
  await page.emulateMedia({ media: "print" });
  const letterPdf = await page.pdf({ preferCSSPageSize: true });
  expect(letterPdf.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(1);
});

test("root restores and updates a shareable comparison", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/?subject=bouquet&style=watercolor");
  await expect(page.getByRole("heading", { name: "What will you make today?" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Bouquets & vessels/ })).toHaveAttribute("aria-pressed", "true");
  const styles = page.getByRole("group", { name: /Choose a style/ });
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
  await page.getByText("A few choices behind the painting", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Seven decisions behind the result." })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Browse style guides" })).toBeVisible();
  await page.getByRole("link", { name: /Anime environment/ }).click();
  await expect(page).toHaveURL(/view=guide&style=anime-environment/);
  await expect(page.getByRole("heading", { name: "Anime environment", level: 1 })).toBeVisible();
});

test("watercolor lesson advances through visual paper states", async ({ page }) => {
  await page.goto("/?view=watercolor-lesson");
  await expect(page.getByRole("heading", { name: "Understand the water." })).toBeVisible();
  await expect(page.getByAltText(/Draw the lemon/)).toBeVisible();

  await page.getByRole("button", { name: "Next step →" }).click();
  await expect(page.getByRole("heading", { name: "Make one luminous first wash." })).toBeVisible();
  await page.getByRole("button", { name: "Original photo" }).click();
  await expect(page.getByAltText(/Single yellow lemon/)).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Make one luminous first wash." })).toBeVisible();
});

test("v2 lesson opens on the active checkpoint and keeps secondary material closed", async ({ page }) => {
  await page.route("**/api/v1/painting-lessons/checkpoint-e2e", (route) => route.fulfill({ json: checkpointLessonPayload() }));
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/?view=lesson&lesson=checkpoint-e2e");
  await expect(page.getByRole("heading", { name: "Sunflowers in a blue-green vase" })).toBeVisible();
  const activeImage = page.getByAltText("Checkpoint 1");
  await expect(activeImage).toBeVisible();
  const imageBox = await activeImage.boundingBox();
  expect(imageBox).not.toBeNull();
  expect(imageBox!.y).toBeLessThan(900);
  expect(await page.locator(".checkpoint-lesson__drawers > details[open]").count()).toBe(0);
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await expect(page.getByRole("navigation", { name: "Session steps" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("layer study keeps image views and palette attached to the active checkpoint", async ({ page }, testInfo) => {
  const payload = checkpointLessonPayload();
  payload.source_mode = "prompt";
  payload.scene_prompt = "Sunflowers in a blue-green vase";
  payload.generation_brief.source_mode = "prompt";
  payload.generation_brief.scene_prompt = payload.scene_prompt;
  payload.generation_brief.sequence_style = "layer_study";
  payload.sequence_style_configured = true;
  payload.assets = payload.assets.filter((asset) => asset.role !== "original_reference");
  await page.route("**/api/v1/painting-lessons/checkpoint-e2e", (route) => route.fulfill({ json: payload }));
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/?view=lesson&lesson=checkpoint-e2e");

  await expect(page.getByRole("button", { name: "Current step", pressed: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Palette for this step" })).toBeVisible();
  await page.getByRole("button", { name: "Process sheet" }).click();
  await expect(page.getByRole("region", { name: "All watercolor steps" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Finished painting" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("layer-study-process-sheet.png"), fullPage: true });
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
    expect(layout!.selectorPosition).toBe("static");
    expect(layout!.gap).toBeLessThanOrEqual(20);
    expect(layout!.artworkTop).toBeLessThan(layout!.viewportHeight);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?view=feeling-first&emotion=pensive");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.getByRole("button", { name: "Joy" }).click();
  await expect(page).toHaveURL(/emotion=joy/);
  await expect(page.locator(".emotion-gallery__artwork")).toBeInViewport();
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
  test(`${viewport.name} layout has no horizontal clipping`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "What will you make today?" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.goto("/?view=guide&style=anime-environment");
    await expect(page.getByRole("heading", { name: "Anime environment", level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.goto("/?view=lesson-create");
    await expect(page.getByRole("heading", { name: "What would you love to paint?" })).toBeVisible();
    await page.getByRole("button", { name: "Make it yours" }).click();
    await expect(page.getByRole("slider", { name: "Number of session steps" })).toHaveValue("3");
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: testInfo.outputPath(`${viewport.name.replace(" ", "-")}-lesson-creator.png`),
      fullPage: true,
    });
  });
}

test("photo lesson controls retain focus visibility, enlarged text, and reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?view=lesson-create");
  const picker = page.getByLabel(/Drop a photo that inspires you/i);
  await picker.focus();
  const focusStyle = await picker.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  expect(focusStyle.outlineStyle).not.toBe("none");
  expect(focusStyle.outlineWidth).not.toBe("0px");
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await expectNoHorizontalOverflow(page);
});

async function mockStudio(page: Page) {
  await page.route("**/api/v1/painting-lessons/capabilities", (route) => route.fulfill({ json: { image_generation_available: true } }));
  await page.route("**/api/v1/painting-lessons?state=all", (route) => route.fulfill({ json: [] }));
}

test("creation dialog preserves the underlying selection and input through Escape and Back", async ({ page }) => {
  await mockStudio(page);
  let paidActions = 0;
  page.on("request", (request) => { if (request.method() === "POST") paidActions += 1; });
  await page.goto("/?subject=greenhouse&style=watercolor");
  const opener = page.getByRole("navigation", { name: "Wanderline navigation" }).getByRole("link", { name: "Start painting" });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Start a painting session" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Describe an idea" }).click();
  await dialog.getByRole("textbox", { name: "What’s in your imagination?" }).fill("A greenhouse in golden rain");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/subject=greenhouse&style=watercolor/);
  await expect(opener).toBeFocused();
  await opener.click();
  await expect(dialog.getByRole("textbox", { name: "What’s in your imagination?" })).toHaveValue("A greenhouse in golden rain");
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.goBack();
  await expect(dialog).not.toBeVisible();
  expect(paidActions).toBe(0);
});

test("basics resets customization and double submission queues only one preview", async ({ page }) => {
  await mockStudio(page);
  const payload = checkpointLessonPayload();
  let created: Record<string, unknown> | undefined;
  let previewCalls = 0;
  await page.route("**/api/v1/painting-lessons", async (route) => {
    created = route.request().postDataJSON();
    await route.fulfill({ json: { ...payload, content: null, assets: [] } });
  });
  await page.route("**/api/v1/painting-lessons/checkpoint-e2e/target-generations", async (route) => {
    previewCalls += 1;
    expect(route.request().postDataJSON().idempotency_key).toBeTruthy();
    await route.fulfill({ json: { id: "preview-run", status: "queued", scope: "target" } });
  });
  await page.route("**/api/v1/lesson-generations/preview-run", (route) => route.fulfill({ json: { id: "preview-run", status: "running", scope: "target", progress: { phase: "target", completed: 0, total: 1 } } }));
  await page.route("**/api/v1/painting-lessons/checkpoint-e2e", (route) => route.fulfill({ json: payload }));
  await page.goto("/?view=lesson-create");
  const dialog = page.getByRole("dialog", { name: "Start a painting session" });
  await dialog.getByRole("button", { name: "Describe an idea" }).click();
  await dialog.getByRole("textbox", { name: "What’s in your imagination?" }).fill("Sunflowers near a rainy window");
  await dialog.getByRole("button", { name: "Make it yours" }).click();
  await dialog.getByRole("slider", { name: "Number of session steps" }).fill("5");
  await dialog.getByRole("button", { name: "Joyous", exact: true }).click();
  await dialog.getByRole("button", { name: "Just stick to basics" }).dblclick();
  await expect(page).toHaveURL(/run=preview-run/);
  expect(created?.generation_brief).toMatchObject({ source_mode: "prompt", scene_prompt: "Sunflowers near a rainy window", stage_count: 3, sequence_style: "layer_study", mood: "as_shown", treatment: "natural" });
  expect(created).toMatchObject({ difficulty: "beginner", estimated_duration_minutes: 30, title: null });
  expect(previewCalls).toBe(1);
});

for (const source of ["photo", "idea", "recipe"]) {
test(`modal ${source} controls stay inside their components at 200 percent text`, async ({ page }) => {
  await mockStudio(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?view=lesson-create");
  await page.getByRole("button", { name: "Make it yours" }).click();
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  const dialog = page.getByRole("dialog", { name: "Start a painting session" });
  if (source !== "photo") await dialog.getByRole("button", { name: "Describe an idea" }).click();
  if (source === "recipe") await dialog.getByRole("checkbox", { name: /Simple painting recipe/ }).check();
  await dialog.getByText("A few more touches", { exact: true }).click();
  const overflows = await dialog.evaluate((element) => [...element.querySelectorAll("fieldset, input, textarea, button, label, p, span, section")].filter((child) => {
    const parent = child.parentElement;
    if (!parent) return false;
    const rect = child.getBoundingClientRect(), bounds = parent.getBoundingClientRect();
    return rect.width > 0 && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1);
  }).map((element) => element.tagName + ":" + element.className));
  expect(overflows).toEqual([]);
  await expectNoHorizontalOverflow(page);
});

}

test("Explore places artwork and a next action in the opening desktop viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/");
  await expect(page.locator(".style-reference-workspace__image")).toBeInViewport();
  await expect(page.getByRole("link", { name: "Start painting", exact: true }).first()).toBeInViewport();
});
