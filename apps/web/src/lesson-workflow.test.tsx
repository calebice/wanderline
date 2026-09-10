import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { LEMON_LESSON, type PaintingLesson } from "./lesson-model";
import { StyleStudioApp } from "./style-lab";

function response(payload: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
}

function customLesson(): PaintingLesson {
  return {
    ...structuredClone(LEMON_LESSON),
    id: "photo-lesson-1",
    title: "Garden shadows",
    saved_at: null,
    is_demo: false,
    provider_mode: "openai",
    approved_target_asset_id: "target-1",
    active_render_set_id: "render-1",
    assets: [
      { ...LEMON_LESSON.assets[0], id: "asset-1", image_url: "/api/v1/lesson-assets/asset-1/image" },
      { ...LEMON_LESSON.assets[0], id: "target-1", role: "target_reference", is_primary: false, image_url: "/api/v1/lesson-assets/target-1/image", alt_text: "Painting preview" },
      ...LEMON_LESSON.content!.stages.map((stage, index) => ({
        ...LEMON_LESSON.assets[0],
        id: `stage-image-${index + 1}`,
        role: "stage_image" as const,
        is_primary: false,
        stage_id: stage.id,
        render_set_id: "render-1",
        image_url: `/api/v1/lesson-assets/stage-image-${index + 1}/image`,
        alt_text: `Stage ${index + 1}`,
      })),
    ],
  };
}

function checkpointLesson(stageCount = 3): PaintingLesson {
  const lesson = customLesson();
  const stages = lesson.content!.stages.slice(0, stageCount).map((stage, index) => ({
    ...stage,
    title: ["Garden mass", "Flower structure", "Focal accents", "Finish edges"][index] || `Checkpoint ${index + 1}`,
    short_title: ["Mass", "Structure", "Accents", "Finish"][index] || `Pass ${index + 1}`,
    checkpoint_action: [
      "Build one soft, cool garden mass around the reserved flower and vase.",
      "Place the flower and vase structure without closing every edge.",
      "Resolve the focal accents and leave the surrounding garden quiet.",
      "Use the approved target as the finished checkpoint.",
    ][index] || "Bring the painting to this checkpoint.",
    approach_steps: ["Lightly place the structural drawing.", "Join broad washes around the reserved shapes.", "Let the paper settle before adding the next shape."],
  }));
  const finalStage = stages[stages.length - 1];
  return {
    ...lesson,
    schema_version: "painting-lesson.v2",
    generation_brief: { ...lesson.generation_brief, stage_count: stageCount },
    content: { ...lesson.content!, stages },
    assets: [
      { ...lesson.assets[0], id: "asset-1", image_url: "/api/v1/lesson-assets/asset-1/image", alt_text: "Original garden photo" },
      ...stages.slice(0, -1).map((stage, index) => ({
        ...lesson.assets[0],
        id: `checkpoint-${index + 1}`,
        role: "stage_image" as const,
        is_primary: false,
        stage_id: stage.id,
        render_set_id: "render-v2",
        image_url: `/api/v1/lesson-assets/checkpoint-${index + 1}/image`,
        alt_text: `Checkpoint ${index + 1}`,
      })),
      { ...lesson.assets[0], id: "target-v2", role: "target_reference", is_primary: false, stage_id: finalStage.id, render_set_id: null, image_url: "/api/v1/lesson-assets/target-v2/image", alt_text: "Approved finished target" },
    ],
    approved_target_asset_id: "target-v2",
    active_render_set_id: "render-v2",
  };
}

function layerStudyLesson(stageCount = 3): PaintingLesson {
  const lesson = checkpointLesson(stageCount);
  const phaseSets = {
    1: ["finished_target"],
    2: ["drawing_map", "finished_target"],
    3: ["drawing_map", "light_and_middle_washes", "finished_target"],
    4: ["drawing_map", "light_wash", "middle_values", "finished_target"],
    5: ["drawing_map", "light_wash", "middle_values", "dark_forms", "finished_target"],
  } as const;
  return {
    ...lesson,
    source_mode: "prompt",
    scene_prompt: "A sunflower in a blue-green vase",
    sequence_style_configured: true,
    generation_brief: { ...lesson.generation_brief, source_mode: "prompt", scene_prompt: "A sunflower in a blue-green vase", sequence_style: "layer_study" },
    content: { ...lesson.content!, stages: lesson.content!.stages.map((stage, index) => ({ ...stage, process_phase: phaseSets[stageCount as keyof typeof phaseSets][index] })) },
    assets: [
      ...lesson.assets.filter((asset) => asset.role !== "original_reference"),
      { ...lesson.assets[0], id: "process-sheet", role: "process_sheet", is_primary: false, stage_id: null, render_set_id: "render-v2", image_url: "/api/v1/lesson-assets/process-sheet/image", alt_text: "Layer-by-layer watercolor process sheet" },
    ],
  };
}

function generationRun(overrides: Record<string, unknown> = {}) {
  return {
    id: "run-1",
    lesson_id: "photo-lesson-1",
    scope: "full",
    section_key: null,
    status: "queued",
    result: null,
    error_message: null,
    progress: { phase: "lesson_text", completed: 1, total: 5, items: [] },
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn((input) => {
    if (String(input).endsWith("/painting-lessons/capabilities")) return response({ image_generation_available: true });
    return Promise.reject(new Error(`Unexpected request: ${String(input)}`));
  }));
  vi.stubGlobal("confirm", vi.fn(() => true));
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:preview") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("image-first lesson workflow", () => {
  it("keeps a simple recipe selected when starting with basics", async () => {
    const lesson = checkpointLesson();
    const requests: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn((input, init) => {
      const url = String(input);
      if (url.endsWith("/capabilities")) return response({ image_generation_available: true });
      if (url.endsWith("/painting-lessons") && init?.method === "POST") {
        requests.push(JSON.parse(init.body)); return response(lesson);
      }
      if (url.includes("target-generations")) return response(generationRun({ scope: "target" }));
      return response(lesson);
    }));
    render(<MemoryRouter initialEntries={["/?view=lesson-create"]}><StyleStudioApp /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Describe an idea" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Describe an idea" }));
    fireEvent.change(screen.getByLabelText("What’s in your imagination?"), { target: { value: "A little pear" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Simple painting recipe/ }));
    fireEvent.click(screen.getByRole("button", { name: "Just stick to basics" }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].generation_brief).toMatchObject({ sequence_style: "simple_recipe", scene_prompt: "A little pear", stage_count: 3 });
  });

  it("shows the matching outline and numbered recipe without intermediate-image retries", async () => {
    const lesson = checkpointLesson();
    lesson.generation_brief.sequence_style = "simple_recipe";
    lesson.content!.recipe = { finishing: { instruction: "Add a little brown to the shadow.", mix: { ...lesson.content!.palette[0], id: "optional-brown", name: "Brown", consistency: "watery", ingredients: [{ color: "red", parts: 2 }, { color: "brown", parts: 1 }] } } };
    lesson.content!.stages.forEach((stage) => { stage.approach_steps = []; });
    lesson.assets.push({ ...lesson.assets[0], id: "outline", role: "tracing_outline", stage_id: lesson.approved_target_asset_id, image_url: "/outline.png" });
    vi.stubGlobal("fetch", vi.fn(() => response(lesson)));
    render(<MemoryRouter initialEntries={[`/?view=lesson-review&lesson=${lesson.id}`]}><StyleStudioApp /></MemoryRouter>);
    const sheet = await screen.findByRole("region", { name: "Simple painting recipe" });
    fireEvent.click(within(sheet).getByRole("button", { name: /^Print Outline$/ }));
    expect(within(sheet).getByAltText(/Matching outline to trace/)).toHaveAttribute("src", expect.stringContaining("/outline.png"));
    expect(sheet.querySelectorAll(".recipe-sheet__steps > li")).toHaveLength(3);
    expect(sheet.querySelector(".recipe-sheet__steps h2")).toBeNull();
    expect(within(sheet).getByText("Try a little more").closest("details")).not.toHaveAttribute("open");
    expect(within(sheet).getByRole("region", { name: "How to mix your colors" })).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Print tracing outline" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(screen.queryByRole("button", { name: "Retry remaining images" })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Save session" })[0]);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`/painting-lessons/${lesson.id}`), expect.objectContaining({ method: "PUT" })));
    expect(screen.queryByText("Every step needs one action and two or three approach steps.")).not.toBeInTheDocument();
  });

  it("starts with an accessible three-stage slider and calm guided choices", () => {
    render(<MemoryRouter initialEntries={["/?view=lesson-create"]}><StyleStudioApp /></MemoryRouter>);
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Make it yours" }));
    const slider = screen.getByRole("slider", { name: "Number of session steps" });
    expect(slider).toHaveValue("3");
    expect(screen.getAllByRole("button", { name: "As shown", pressed: true }).length).toBe(2);
    expect(screen.getByText("A few more touches")).toBeInTheDocument();
    fireEvent.change(slider, { target: { value: "5" } });
    expect(slider).toHaveValue("5");
    fireEvent.click(screen.getAllByRole("button", { name: "Something else" })[0]);
    expect(screen.getByLabelText("What is the mood? custom direction")).toBeInTheDocument();
  });

  it("keeps uploads and text prompts exclusive and validates both paths", async () => {
    render(<MemoryRouter initialEntries={["/?view=lesson-create"]}><StyleStudioApp /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Just stick to basics" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Add at least one photo");
    await waitFor(() => expect(screen.getByRole("button", { name: "Describe an idea" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Describe an idea" }));
    fireEvent.click(screen.getByRole("button", { name: "Make it yours" }));
    expect(screen.queryByLabelText(/Drop a photo that inspires you/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Layer-by-layer images/, pressed: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Individual step images/ }));
    expect(screen.getByRole("button", { name: /Individual step images/, pressed: true })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Let Wanderline decide" }).length).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Just stick to basics" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Describe the scene you’d like to paint");
  });

  it("previews uploads, changes the primary reference, and removes files", () => {
    render(<MemoryRouter initialEntries={["/?view=lesson-create"]}><StyleStudioApp /></MemoryRouter>);
    const picker = screen.getByLabelText(/Drop a photo that inspires you/i);
    fireEvent.change(picker, { target: { files: [new File(["first"], "garden.jpg", { type: "image/jpeg" }), new File(["second"], "angle.webp", { type: "image/webp" })] } });
    expect(screen.getByAltText("Preview of garden.jpg")).toBeInTheDocument();
    const primaryChoices = screen.getAllByRole("radio", { name: "Main inspiration" });
    fireEvent.click(primaryChoices[1]);
    expect(primaryChoices[1]).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Simple painting recipe/ })).not.toBeChecked();
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(screen.queryByAltText("Preview of garden.jpg")).not.toBeInTheDocument();
  });

  it("shows original and generated target before lesson generation", async () => {
    const lesson = customLesson();
    vi.mocked(fetch).mockImplementation(() => response(lesson));
    render(<MemoryRouter initialEntries={["/?view=lesson-target&lesson=photo-lesson-1"]}><StyleStudioApp /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Does this feel like you?" })).toBeInTheDocument();
    expect(screen.getByText("Original photo")).toBeInTheDocument();
    expect(screen.getByText("Painting preview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use this image →" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Try a change" }));
    fireEvent.click(screen.getByRole("button", { name: "Joyous" }));
    expect(screen.getByText(/Create a new preview/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use this image →" })).toBeDisabled();
  });

  it("leads review with the stage carousel and keeps the full editor collapsed", async () => {
    const lesson = customLesson();
    let savedPayload: { expected_revision: number; content: typeof lesson.content } | null = null;
    vi.mocked(fetch).mockImplementation((_input, init) => {
      if (init?.method === "PUT") {
        savedPayload = JSON.parse(String(init.body));
        return response({ ...lesson, content: savedPayload!.content, saved_at: "2026-09-07T12:00:00Z", revision: 2 });
      }
      return response(lesson);
    });
    render(<MemoryRouter initialEntries={["/?view=lesson-review&lesson=photo-lesson-1"]}><StyleStudioApp /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Review the painting journey." })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Review session steps" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Stage 1" })).toBeInTheDocument();
    expect(screen.getByText("Make it yours", { selector: "strong" }).closest("details")).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("Make it yours", { selector: "strong" }));
    const title = screen.getByLabelText("Session title");
    fireEvent.change(title, { target: { value: "Quieter garden shadows" } });
    const stages = screen.getByRole("heading", { name: "Edit the steps." }).closest("section")!;
    const cards = within(stages).getAllByText(/Step [1-4]/).map((label) => label.closest("article")!);
    fireEvent.click(within(cards[1]).getByRole("button", { name: "Move up" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Save session" })[0]);
    await waitFor(() => expect(savedPayload).not.toBeNull());
    expect(savedPayload!.content!.stages.map((stage) => stage.id).slice(0, 2)).toEqual(["wash", "plan"]);
  });

  it("renders new lessons checkpoint-first while keeping support drawers closed", async () => {
    vi.mocked(fetch).mockImplementation(() => response(checkpointLesson()));
    render(<MemoryRouter initialEntries={["/?view=lesson&lesson=photo-lesson-1"]}><StyleStudioApp /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Garden shadows" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Session steps" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Checkpoint 1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Build one soft, cool garden mass/ })).toBeInTheDocument();
    expect(screen.getByText("Lightly place the structural drawing.")).toBeInTheDocument();
    expect(screen.getByText("Palette details", { selector: "strong" }).closest("details")).not.toHaveAttribute("open");
    for (const label of ["More painting tips", "All your painting notes"]) {
      expect(screen.getByText(label, { selector: "strong" }).closest("details")).not.toHaveAttribute("open");
    }
  });

  it("keeps layer-study image views and palette next to the active checkpoint", async () => {
    vi.mocked(fetch).mockImplementation(() => response(layerStudyLesson()));
    render(<MemoryRouter initialEntries={["/?view=lesson&lesson=photo-lesson-1"]}><StyleStudioApp /></MemoryRouter>);

    expect(await screen.findByRole("button", { name: "Current step", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Process sheet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finished painting" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Original photo" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Palette for this step" })).toBeInTheDocument();
    expect(screen.getByText("Palette details", { selector: "strong" }).closest("details")).not.toHaveAttribute("open");

    fireEvent.click(screen.getByRole("button", { name: "Process sheet" }));
    expect(screen.getByRole("region", { name: "All watercolor steps" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Palette for step 1" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Finished painting" }));
    expect(screen.getByRole("img", { name: "Approved finished target" })).toBeInTheDocument();
  });

  it("previews the same layer-study views during review", async () => {
    vi.mocked(fetch).mockImplementation(() => response(layerStudyLesson()));
    render(<MemoryRouter initialEntries={["/?view=lesson-review&lesson=photo-lesson-1"]}><StyleStudioApp /></MemoryRouter>);

    expect(await screen.findByRole("button", { name: "Current step", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Palette for this step" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Process sheet" }));
    expect(screen.getByRole("region", { name: "All watercolor steps" })).toBeInTheDocument();
  });

  it("previews concise v2 guidance, locks structure, and redirects final adjustments", async () => {
    const lesson = checkpointLesson();
    vi.mocked(fetch).mockImplementation(() => response(lesson));
    render(<MemoryRouter initialEntries={["/?view=lesson-review&lesson=photo-lesson-1"]}><StyleStudioApp /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: lesson.content!.stages[0].checkpoint_action! })).toBeInTheDocument();
    expect(screen.getByText("Lightly place the structural drawing.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Make it yours", { selector: "strong" }));
    expect(screen.getAllByLabelText("Step action")[0]).toHaveValue(lesson.content!.stages[0].checkpoint_action);
    expect(screen.queryByRole("button", { name: "Add step" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Move up" })).not.toBeInTheDocument();
    expect(screen.getByText(/order and count are locked/i)).toBeInTheDocument();

    const stageNavigation = screen.getByRole("navigation", { name: "Review session steps" });
    fireEvent.click(within(stageNavigation).getAllByRole("button")[lesson.content!.stages.length - 1]);
    expect(screen.getByRole("link", { name: "Adjust finished painting →" })).toHaveAttribute("href", "/?view=lesson-target&lesson=photo-lesson-1");
    expect(screen.queryByRole("button", { name: /Repaint/ })).not.toBeInTheDocument();
  });

  it("resumes an assembly run from its URL and retries a recoverable failure", async () => {
    const lesson = customLesson();
    let runReads = 0;
    let retryCalls = 0;
    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes("/painting-lessons/photo-lesson-1")) return response(lesson);
      if (url.includes("/lesson-generations/run-1/retry") && init?.method === "POST") {
        retryCalls += 1;
        return response(generationRun());
      }
      if (url.includes("/lesson-generations/run-1")) {
        runReads += 1;
        if (runReads === 1) return response(generationRun({ status: "failed", error_message: "The provider is busy; retry shortly.", progress: { phase: "stage_images", completed: 2, total: 5, items: [] } }));
        return new Promise<Response>(() => undefined);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    render(<MemoryRouter initialEntries={["/?view=lesson-build&lesson=photo-lesson-1&run=run-1&next=review"]}><StyleStudioApp /></MemoryRouter>);
    expect(await screen.findByText("The provider is busy; retry shortly.")).toBeInTheDocument();
    expect(screen.getByText(/draft is safe/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resume preparation" }));
    await waitFor(() => expect(retryCalls).toBe(1));
  });

  it("loads saved lessons only when requested", async () => {
    vi.mocked(fetch).mockImplementation(() => response([customLesson()]));
    render(<MemoryRouter initialEntries={["/"]}><StyleStudioApp /></MemoryRouter>);
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("link", { name: "Painting sessions" }));
    await screen.findByRole("heading", { name: "Garden shadows" });
  });
});
