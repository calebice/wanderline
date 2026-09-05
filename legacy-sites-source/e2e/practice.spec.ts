import { expect, test } from "@playwright/test";

const lesson = {
  id: "boxes-cylinders-001",
  title: "Boxes & Cylinders",
  skill: "form_construction",
  difficulty: 2,
  duration_minutes: 15,
  instructions: ["Orbit the reference.", "Draw three boxes.", "Add aligned cylinders."],
  completion_requirements: { reflection: true },
  reference_mode: "3d",
  sequence_index: 7,
  week_number: 3,
  objective: "Turn flat shapes into forms that feel solid.",
  concept: "A form has volume and turns through space.",
  why_it_matters: "Boxes and cylinders construct many everyday subjects.",
  common_mistake: "Drawing each edge independently.",
  materials: ["Paper", "Pen"],
  timed_phases: [
    { label: "Explore", minutes: 3, instruction: "Rotate the reference." },
    { label: "Construct", minutes: 9, instruction: "Draw two chosen views." },
    { label: "Check", minutes: 3, instruction: "Compare edge families." },
  ],
  visual_kind: "forms",
  three_d_config: { shape: "box-cylinder", controls: ["orbit", "reset"] },
  replay_variation: "Draw one box and one cylinder.",
};

const progress = {
  learner_name: "Artist",
  weekly_target: 3,
  weekly_completed: 1,
  total_completed_lessons: 6,
  total_lessons: 12,
  recommended_exercise_id: lesson.id,
  current_milestone: "Week 3 · Build solid forms",
  lessons: [{ exercise: lesson, status: "not_started", active_session_id: null, completed_sessions: 0, last_completed_at: null }],
  milestones: [{ week_number: 3, title: "Build solid forms", completed_lessons: 0, total_lessons: 3, status: "current" }],
  recent_reflections: [],
};

const session = {
  id: "9f82d79d-3c75-44a1-9803-f1129725be31",
  exercise_id: lesson.id,
  status: "in_progress",
  difficulty_response: null,
  takeaway: null,
  started_at: "2026-08-10T10:00:00Z",
  completed_at: null,
};

test("starts the recommended lesson and restores its guided timer", async ({ page }) => {
  await page.route("**/api/v1/progress", (route) => route.fulfill({ json: progress }));
  await page.route(`**/api/v1/exercises/${lesson.id}`, (route) => route.fulfill({ json: lesson }));
  await page.route("**/api/v1/practice-sessions", (route) =>
    route.fulfill({ status: 201, json: session }),
  );
  await page.route(`**/api/v1/practice-sessions/${session.id}`, (route) => route.fulfill({ json: session }));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Boxes & Cylinders" })).toBeVisible();
  await expect(page.getByLabel("1 of 3 practices completed this week")).toBeVisible();
  await page.getByRole("button", { name: "Start today's lesson" }).click();
  await expect(page.getByRole("heading", { name: "Explore" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Turn the form, then draw what changes." })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Turn right" }).click();
  await page.getByRole("button", { name: "Start timer" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Explore" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start timer" })).toBeVisible();
});

test("keeps active lessons calm and contained with reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/v1/progress", (route) => route.fulfill({ json: progress }));
  await page.route(`**/api/v1/exercises/${lesson.id}`, (route) => route.fulfill({ json: lesson }));
  await page.route(`**/api/v1/practice-sessions/${session.id}`, (route) => route.fulfill({ json: session }));

  await page.goto(`/practice/${lesson.id}?session=${session.id}`);
  await expect(page.getByRole("heading", { name: "Explore" })).toBeVisible();
  await expect(page.locator(".visual-ambient").first()).toHaveCSS("display", "none");
  await expect(page.locator(".timer-motion")).toHaveCSS("display", "none");
  const sizes = await page.evaluate(() => ({
    viewport: window.innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
});

test("keeps the recommended action usable on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/v1/progress", (route) => route.fulfill({ json: progress }));
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Draw one thing. Learn one thing." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start today's lesson" })).toBeVisible();
  const sizes = await page.evaluate(() => ({
    viewport: window.innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
});

test("keeps the static style guide usable on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const apiCalls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/style")) apiCalls.push(request.url());
  });
  await page.goto("/style-lab");

  await expect(page.getByRole("heading", { name: "Style reference studio." })).toBeVisible();
  const subjects = page.getByRole("group", { name: /Choose a subject/ });
  const styles = page.getByRole("group", { name: /Choose a drawing language/ });
  await expect(subjects.getByRole("button")).toHaveCount(5);
  await subjects.getByRole("button", { name: /Bouquets & vessels/ }).click();
  await styles.getByRole("button", { name: /Watercolor/ }).click();
  await expect(page.getByAltText(/Luminous transparent watercolor/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Open full image/ })).toHaveAttribute(
    "href",
    "/style-guide/bouquet/watercolor/reference.png",
  );
  const homeSizes = await page.evaluate(() => ({ viewport: window.innerWidth, content: document.documentElement.scrollWidth }));
  expect(homeSizes.content).toBeLessThanOrEqual(homeSizes.viewport);

  await page.goto("/style-lab/styles/watercolor");
  await expect(page.getByRole("heading", { name: "Watercolor", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "From blank page to finish." })).toBeVisible();
  await expect(page.getByRole("link", { name: /Anime environment/ })).toBeVisible();
  const detailSizes = await page.evaluate(() => ({ viewport: window.innerWidth, content: document.documentElement.scrollWidth }));
  expect(detailSizes.content).toBeLessThanOrEqual(detailSizes.viewport);
  expect(apiCalls).toEqual([]);
});

test("moves through the emotional space gallery on desktop and mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/style-lab/feeling-first/the-last-tree");

  const slider = page.getByRole("slider", { name: "Emotional interpretation" });
  await expect(slider).toHaveAttribute("aria-valuetext", "Pensive: Camp Beyond the Map");
  await expect(page.getByAltText(/tiny traveler rests beside a warm campfire/)).toBeVisible();
  await expect(page.locator(".emotion-gallery__artwork")).toHaveCSS("animation-name", "none");

  await slider.press("ArrowLeft");
  await expect(page).toHaveURL(/emotion=heaviness/);
  await expect(slider).toHaveAttribute("aria-valuetext", "Heaviness: The Pull");
  await expect(page.getByRole("heading", { name: "The Pull" })).toBeVisible();

  await page.getByRole("button", { name: "Joy" }).click();
  await expect(page).toHaveURL(/emotion=joy/);
  await expect(page.getByAltText(/healthy upright tree/)).toBeVisible();
  const sizes = await page.evaluate(() => ({ viewport: window.innerWidth, content: document.documentElement.scrollWidth }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
});

test("never clips emotional gallery copy inside its rounded panel", async ({ page }) => {
  const emotions = ["sad", "heaviness", "pensive", "awed", "joy"];

  for (const width of [280, 320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const emotion of emotions) {
      await page.goto(`/style-lab/feeling-first/the-last-tree?emotion=${emotion}`);
      await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
      const layout = await page.locator(".emotion-gallery__workspace").evaluate((workspace) => {
        const panel = workspace.querySelector<HTMLElement>("aside");
        if (!panel) return null;
        const workspaceRect = workspace.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const overflowingChildren = [...panel.children].filter((child) => {
          const rect = child.getBoundingClientRect();
          return rect.left < panelRect.left - 0.5 || rect.right > panelRect.right + 0.5;
        }).length;
        return {
          panelRight: panelRect.right,
          workspaceRight: workspaceRect.right,
          panelScrollWidth: panel.scrollWidth,
          panelClientWidth: panel.clientWidth,
          overflowingChildren,
        };
      });

      expect(layout).not.toBeNull();
      expect(layout!.panelRight).toBeLessThanOrEqual(layout!.workspaceRight + 0.5);
      expect(layout!.panelScrollWidth).toBeLessThanOrEqual(layout!.panelClientWidth);
      expect(layout!.overflowingChildren).toBe(0);
    }
  }
});

test("keeps the shared-subject card clear of the title at medium desktop widths", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto("/style-lab");

  const placement = await page.evaluate(() => {
    const title = document.querySelector(".style-guide-hero h1")?.getBoundingClientRect();
    const card = document.querySelector(".style-guide-hero aside")?.getBoundingClientRect();
    return {
      titleBottom: title?.bottom ?? 0,
      cardTop: card?.top ?? 0,
      viewport: window.innerWidth,
      content: document.documentElement.scrollWidth,
    };
  });
  expect(placement.cardTop).toBeGreaterThan(placement.titleBottom);
  expect(placement.content).toBeLessThanOrEqual(placement.viewport);
});

test("keeps all five style-reference subjects in one consistent desktop row", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/style-lab");

  const boxes = await page.getByRole("group", { name: /Choose a subject/ })
    .getByRole("button")
    .evaluateAll((buttons) => buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return { top: Math.round(box.top), width: Math.round(box.width) };
    }));

  expect(boxes).toHaveLength(5);
  expect(new Set(boxes.map((box) => box.top)).size).toBe(1);
  expect(Math.max(...boxes.map((box) => box.width)) - Math.min(...boxes.map((box) => box.width))).toBeLessThanOrEqual(1);
});

test("keeps long style-guide titles clear of the medium tile on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const style of ["architectural", "watercolor", "anime-environment"]) {
    await page.goto(`/style-lab/styles/${style}`);
    const layout = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>(".style-guide-detail__header");
      const title = header?.querySelector<HTMLElement>("h1");
      const mediumTile = header?.querySelector<HTMLElement>("aside");
      return {
        headerWidth: header?.getBoundingClientRect().width ?? 0,
        titleClientWidth: title?.clientWidth ?? 0,
        titleScrollWidth: title?.scrollWidth ?? 0,
        mediumTileRight: mediumTile?.getBoundingClientRect().right ?? 0,
        headerRight: header?.getBoundingClientRect().right ?? 0,
      };
    });

    expect(layout.headerWidth).toBeGreaterThan(1000);
    expect(layout.titleScrollWidth).toBeLessThanOrEqual(layout.titleClientWidth);
    expect(layout.mediumTileRight).toBeLessThanOrEqual(layout.headerRight);
  }
});

test("keeps long gallery descriptions inside the preview panel on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const style of ["architectural", "watercolor", "anime-environment"]) {
    await page.goto(`/style-lab?subject=camper-van&style=${style}`);
    const layout = await page.evaluate(() => {
      const workspace = document.querySelector<HTMLElement>(".style-reference-workspace");
      const description = workspace?.querySelector<HTMLElement>("aside");
      const workspaceRight = workspace?.getBoundingClientRect().right ?? 0;
      const overflowingChildren = description
        ? [...description.children].filter(
            (child) => child.getBoundingClientRect().right > workspaceRight + 0.5,
          ).length
        : 0;
      return {
        descriptionClientWidth: description?.clientWidth ?? 0,
        descriptionScrollWidth: description?.scrollWidth ?? 0,
        overflowingChildren,
      };
    });

    expect(layout.descriptionScrollWidth).toBeLessThanOrEqual(layout.descriptionClientWidth);
    expect(layout.overflowingChildren).toBe(0);
  }
});

test("guides and restores a scene breakdown study at iPad width", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/studio/3d");

  await expect(page.getByRole("heading", { name: "See the scene. Build the drawing." })).toBeVisible();
  await page.getByRole("button", { name: /A small studio still life/ }).click();
  await page.getByRole("button", { name: "The main subject" }).click();
  await page.getByRole("button", { name: "Reveal the visual guide" }).click();
  await expect(page.locator(".scene-study-overlay.is-visible")).toBeVisible();
  await page.getByRole("button", { name: "I drew this stage" }).click();
  await expect(page.getByText("13%")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: /A small studio still life/ }).click();
  await expect(page.getByText("13%")).toBeVisible();
  const sizes = await page.evaluate(() => ({ viewport: window.innerWidth, content: document.documentElement.scrollWidth }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
});

test("breaks a private reference into selectable shapes and exports SVG", async ({ page }) => {
  const decomposition = {
    id: "decomposition-12345678",
    status: "completed",
    provider: "local_cv_shapes",
    algorithm_version: "local_cv_shapes_v1",
    summary: "This local geometric study describes geometry only.",
    confidence: 0.9,
    image: { id: "image-1", content_type: "image/png", width: 800, height: 600, uploaded_at: "2026-08-21T00:00:00Z" },
    shapes: [
      { id: "shape-1", kind: "rectangle", geometry: { type: "rect", x: .2, y: .3, width: .6, height: .5 }, color: "#bd765e", importance: .9, confidence: .94, z_index: 0, source: "fitted" },
      { id: "shape-2", kind: "triangle", geometry: { type: "polygon", points: [{ x: .15, y: .32 }, { x: .5, y: .08 }, { x: .85, y: .32 }] }, color: "#627c69", importance: .72, confidence: .91, z_index: 1, source: "fitted" },
    ],
    construction_hints: [],
    levels: { simple: ["shape-1"], medium: ["shape-1", "shape-2"], detailed: ["shape-1", "shape-2"] },
    drawing_steps: [
      { order: 1, shape_id: "shape-1", instruction: "Place the rectangle mass first." },
      { order: 2, shape_id: "shape-2", instruction: "Place the triangle mass." },
    ],
    warnings: [],
    limitations: "Classical computer vision does not identify subject parts.",
  };
  await page.route("**/api/v1/image-decompositions", (route) => route.fulfill({ status: 201, json: decomposition }));
  await page.route("**/api/v1/images/image-1", (route) => route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"/>' }));
  await page.goto("/breakdown");
  await page.getByLabel(/Choose a JPEG, PNG, or HEIC reference/).setInputFiles({ name: "house.png", mimeType: "image/png", buffer: Buffer.from("reference") });
  await page.getByRole("button", { name: "Break down image" }).click();

  await expect(page.getByRole("heading", { name: "Build it from the largest shapes." })).toBeVisible();
  await page.getByRole("button", { name: /^Shapes/ }).click();
  await expect(page.getByLabel(/2\. triangle/)).toBeChecked();
  await page.getByRole("slider", { name: "Photo opacity" }).fill("25");
  await expect(page.getByAltText("Uploaded reference with geometric overlay")).toHaveCSS("opacity", "0.25");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download SVG" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("wanderline-breakdown-decompos.svg");
});

test("opens an orbitable generated perspective drill", async ({ page }) => {
  const exercise = {
    id: "rotating-primitives",
    title: "Rotating Primitives",
    track: "perspective",
    difficulty: 2,
    duration_minutes: 15,
    objective: "Draw one primitive from three generated viewpoints.",
    concept: "Rotation changes the proportion and direction of visible faces.",
    common_mistake: "Redrawing a memorized symbol.",
    materials: ["Paper", "Pencil or fineliner"],
    instructions: ["Compare views.", "Draw three times.", "Reveal axes."],
    timed_phases: [
      { label: "Observe", minutes: 3, instruction: "Compare views." },
      { label: "Practice", minutes: 9, instruction: "Draw three times." },
      { label: "Check", minutes: 3, instruction: "Reveal axes." },
    ],
    visual_kind: "rotating",
    visual_config: { mode: "3d" },
    self_checks: [
      { id: "view-change", label: "Each drawing changes viewpoint." },
      { id: "axis", label: "The axis stays consistent." },
      { id: "proportion", label: "Visible faces change proportion." },
    ],
    sequence_index: 3,
    attempt_count: 0,
    active_attempt_id: null,
    last_completed_at: null,
  };
  const attempt = {
    id: "91a9543c-7940-486d-81b9-5cf6975f5532",
    exercise_slug: exercise.id,
    status: "in_progress",
    variant_seed: 847233,
    variant_version: "library_v1",
    variant_data: { kind: "rotating", primitive: "cylinder", elevation: 18, rotations: [-35, 0, 35] },
    self_check_responses: null,
    difficulty_response: null,
    takeaway: null,
    practice_medium: "paper",
    last_overlay_exported_at: null,
    started_at: "2026-08-10T10:00:00Z",
    completed_at: null,
  };
  await page.route(`**/api/v1/library/exercises/${exercise.id}`, (route) => route.fulfill({ json: exercise }));
  await page.route(`**/api/v1/library/attempts/${attempt.id}`, (route) => route.fulfill({ json: attempt }));
  await page.goto(`/library/${exercise.id}/attempt/${attempt.id}`);
  await expect(page.getByRole("heading", { name: "Rotating Primitives" })).toBeVisible();
  await expect(page.getByTestId("library-3d-reference")).toBeVisible();
  await expect(page.getByTestId("library-3d-reference").locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: /Use in Procreate/ }).click();
  await expect(page.getByRole("heading", { name: "Place the construction on your canvas." })).toBeVisible();
  await page.getByRole("button", { name: /iPad landscape/ }).click();
  await expect(page.getByLabel("Overlay width")).toHaveValue("2732");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save PNG" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^wanderline-rotating-primitives-[0-9a-f]{4}-2732x2048\.png$/);
});

test("reveals drawing checks in a narrow hatching drill", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const exercise = {
    id: "five-value-hatch-ladder",
    title: "Five-Value Hatch Ladder",
    track: "hatching_light",
    difficulty: 1,
    duration_minutes: 12,
    objective: "Create five distinct values through spacing.",
    concept: "Closer marks create darker values.",
    common_mistake: "Changing pressure and spacing together.",
    materials: ["Paper", "Fineliner"],
    instructions: ["Study the angle.", "Fill five boxes.", "Reveal and compare."],
    timed_phases: [
      { label: "Observe", minutes: 2, instruction: "Study the angle." },
      { label: "Practice", minutes: 7, instruction: "Fill five boxes." },
      { label: "Check", minutes: 3, instruction: "Reveal and compare." },
    ],
    visual_kind: "hatch-ladder",
    visual_config: { mode: "diagram" },
    self_checks: [
      { id: "distinct-values", label: "Values stay distinct." },
      { id: "spacing", label: "Spacing creates the change." },
      { id: "stroke-family", label: "Strokes remain parallel." },
    ],
    sequence_index: 7,
    attempt_count: 0,
    active_attempt_id: null,
    last_completed_at: null,
  };
  const attempt = {
    id: "f8e16457-f204-4f6a-bdc0-2b05da69fe08",
    exercise_slug: exercise.id,
    status: "in_progress",
    variant_seed: 451234,
    variant_version: "library_v1",
    variant_data: { kind: "hatch-ladder", hatch_angle: 45, steps: 5 },
    self_check_responses: null,
    difficulty_response: null,
    takeaway: null,
    practice_medium: "paper",
    last_overlay_exported_at: null,
    started_at: "2026-08-10T10:00:00Z",
    completed_at: null,
  };
  await page.route(`**/api/v1/library/exercises/${exercise.id}`, (route) => route.fulfill({ json: exercise }));
  await page.route(`**/api/v1/library/attempts/${attempt.id}`, (route) => route.fulfill({ json: attempt }));
  await page.goto(`/library/${exercise.id}/attempt/${attempt.id}`);
  await page.getByRole("button", { name: "Finish early" }).click();
  await page.getByRole("button", { name: "Reveal visual guides" }).click();
  await expect(page.getByTestId("reveal-overlay")).toBeVisible();
  await page.getByRole("button", { name: /Use in Procreate/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText(/Drag this preview into Procreate/)).toBeVisible();
  const sizes = await page.evaluate(() => ({ viewport: window.innerWidth, content: document.documentElement.scrollWidth }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
});

test("prepares the planned face-construction adapter for Procreate", async ({ page }) => {
  const exercise = {
    id: "construct-a-head",
    title: "Construct a Head",
    track: "portrait_foundations",
    difficulty: 1,
    duration_minutes: 18,
    objective: "Build a head with stable landmarks.",
    concept: "A head is a volume crossed by shared landmarks.",
    common_mistake: "Placing features before the head turns in space.",
    materials: ["Paper", "Pencil or iPad"],
    instructions: ["Place the head mass.", "Wrap the center line.", "Place landmarks."],
    timed_phases: [
      { label: "Build", minutes: 6, instruction: "Place the head mass." },
      { label: "Landmark", minutes: 9, instruction: "Wrap the center line and landmarks." },
      { label: "Check", minutes: 3, instruction: "Compare the turn." },
    ],
    visual_kind: "head-construction",
    visual_config: { mode: "diagram" },
    self_checks: [{ id: "center-line", label: "The center line wraps around the head." }],
    sequence_index: 10,
    attempt_count: 0,
    active_attempt_id: null,
    last_completed_at: null,
  };
  const attempt = {
    id: "17b57cb1-252e-4b18-b0af-9857c9ad7119",
    exercise_slug: exercise.id,
    status: "in_progress",
    variant_seed: 71234,
    variant_version: "library_v1",
    variant_data: { kind: "head-construction", view: "three-quarter", tilt: -6, head_shape: "oval" },
    self_check_responses: null,
    difficulty_response: null,
    takeaway: null,
    practice_medium: "paper",
    last_overlay_exported_at: null,
    started_at: "2026-08-11T08:00:00Z",
    completed_at: null,
  };
  await page.route(`**/api/v1/library/exercises/${exercise.id}`, (route) => route.fulfill({ json: exercise }));
  await page.route(`**/api/v1/library/attempts/${attempt.id}`, (route) => route.fulfill({ json: attempt }));
  await page.goto(`/library/${exercise.id}/attempt/${attempt.id}`);
  await expect(page.getByRole("heading", { name: "Construct a Head" })).toBeVisible();
  await page.getByRole("button", { name: /Use in Procreate/ }).click();
  const labels = page.getByRole("checkbox", { name: "Include short instructional labels" });
  await expect(labels).not.toBeChecked();
  await labels.check();
  await expect(labels).toBeChecked();
  await expect(page.getByAltText("Construct a Head transparent overlay preview")).toBeVisible();
});

test("uploads a sketch and presents uncertainty-aware stroke feedback", async ({ page }) => {
  await page.route("**/api/v1/analyses", (route) =>
    route.fulfill({
      status: 201,
      json: {
        id: "455a5caf-e7ec-46d4-b95d-dd707b4f8f28",
        sketch: {
          id: "8a3c94ec-ddf6-4726-a356-014ef7764c8f",
          content_type: "image/png",
          width: 640,
          height: 480,
          actual_subject: "A coffee mug",
          uploaded_at: "2026-07-25T19:00:00Z",
        },
        provider: "local_cv",
        status: "completed",
        summary: "Your marks use the page clearly. These measurements describe the image, not artistic quality.",
        strengths: ["The sketch has a readable range between light and dark marks."],
        improvements: ["Try one pass of longer, deliberate strokes before adding corrections."],
        metrics: {
          dimensions: { width: 640, height: 480 },
          contrast_range: 0.82,
          edge_density: 0.12,
          stroke_fragmentation: 0.43,
          bounding_box_occupancy: 0.67,
          dominant_line_angles: [45, 90],
          dominant_direction_share: 0.42,
          value_histogram: [0.1, 0.2, 0.3, 0.4],
          visual_center: { x: 0.48, y: 0.52 },
          center_offset: 0.04,
          left_right_balance: 0.84,
          top_bottom_balance: 0.71,
          mirror_similarity: 0.63,
          annotations: [{
            id: "drawing-footprint",
            label: "Drawing footprint",
            detail: "The outer area containing sustained edge activity.",
            tone: "positive",
            geometry: { type: "rect", x: 0.2, y: 0.1, width: 0.6, height: 0.8 },
          }],
          coaching_profile: {
            calculation_version: "local_cv_coaching_v1",
            target: {
              label: "A coffee mug",
              source: "user_declared",
              is_frontal: false,
            },
            scores: [{
              id: "penmanship",
              label: "Penmanship",
              score: 76,
              confidence: 0.62,
              evidence: "Fragmentation 1.4; edge density 8.0%.",
              meaning: "Estimated cleanliness, continuity, and economy of visible marks.",
            }],
            style_signals: [{
              label: "Contour-led",
              basis: "Most of the image remains open around a relatively small edge signal.",
            }],
            focus_areas: [{
              id: "linework",
              label: "Linework",
              score: 76,
              priority: 1,
              rationale: "Some contour segments appear as multiple corrections.",
              action: "Ghost the outer contour before drawing.",
              annotation_id: "drawing-footprint",
            }],
            subject_checks: [],
            limitations: "Scores estimate visible mark patterns.",
          },
        },
        subject_prediction: {
          label: null,
          confidence: 0,
          message: "Semantic subject recognition is not enabled for local analysis.",
        },
        confidence: 0.58,
        created_at: "2026-07-25T19:00:01Z",
      },
    }),
  );

  await page.goto("/upload");
  await page.locator('input[type="file"]').setInputFiles({
    name: "mug-study.png",
    mimeType: "image/png",
    buffer: Buffer.from("browser-test-image"),
  });
  await page.getByLabel("What were you trying to draw?").fill("A coffee mug");
  await page.getByRole("button", { name: "Analyze sketch" }).click();

  await expect(page.getByRole("heading", { name: "Your practice signals" })).toBeVisible();
  await expect(page.getByText(/Try one pass of longer, deliberate strokes/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "A coffee mug" })).toBeVisible();
  await expect(page.getByLabel("Penmanship estimate")).toHaveAttribute("value", "76");
  await expect(page.getByRole("heading", { name: "Your three focus areas" })).toBeVisible();
  await expect(page.getByText(/Semantic subject recognition is not enabled/)).toBeVisible();
});
