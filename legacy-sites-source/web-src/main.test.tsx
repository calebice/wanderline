import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./main";

const lesson = {
  id: "confident-lines-001",
  title: "Confident Lines",
  skill: "line_control",
  difficulty: 1,
  duration_minutes: 15,
  instructions: ["Place pairs of dots.", "Ghost each path.", "Draw once."],
  completion_requirements: { reflection: true },
  reference_mode: "diagram",
  sequence_index: 1,
  week_number: 1,
  objective: "Make deliberate straight marks.",
  concept: "Plan with the whole arm before touching the page.",
  why_it_matters: "Clear lines support every later shape.",
  common_mistake: "Correcting a line repeatedly.",
  materials: ["Paper", "Pen"],
  timed_phases: [
    { label: "Prepare", minutes: 2, instruction: "Place pairs of dots." },
    { label: "Practice", minutes: 10, instruction: "Ghost, then draw." },
    { label: "Notice", minutes: 3, instruction: "Circle three clear lines." },
  ],
  visual_kind: "lines",
  three_d_config: null,
  replay_variation: "Use shorter dot pairs.",
};

const progress = {
  learner_name: "Artist",
  weekly_target: 3,
  weekly_completed: 0,
  total_completed_lessons: 0,
  total_lessons: 1,
  recommended_exercise_id: lesson.id,
  current_milestone: "Week 1 · Make confident marks",
  lessons: [{
    exercise: lesson,
    status: "not_started",
    active_session_id: null,
    completed_sessions: 0,
    last_completed_at: null,
  }],
  milestones: [{
    week_number: 1,
    title: "Make confident marks",
    completed_lessons: 0,
    total_lessons: 1,
    status: "current",
  }],
  recent_reflections: [],
};

const session = {
  id: "9f82d79d-3c75-44a1-9803-f1129725be31",
  exercise_id: lesson.id,
  status: "in_progress",
  difficulty_response: null,
  takeaway: null,
  practice_medium: "paper",
  last_overlay_exported_at: null,
  started_at: "2026-08-10T10:00:00Z",
  completed_at: null,
};

const libraryExercise = {
  id: "five-value-hatch-ladder",
  title: "Five-Value Hatch Ladder",
  track: "hatching_light",
  difficulty: 1,
  duration_minutes: 12,
  objective: "Create five distinct values by changing hatch spacing, not pressure.",
  concept: "Consistent strokes become darker when they are placed closer together.",
  common_mistake: "Changing pressure and spacing at the same time.",
  materials: ["Paper", "Pencil or fineliner"],
  instructions: ["Study the hatch angle.", "Fill five boxes.", "Reveal and compare."],
  timed_phases: [
    { label: "Observe", minutes: 2, instruction: "Study the hatch angle." },
    { label: "Practice", minutes: 7, instruction: "Fill five boxes." },
    { label: "Check", minutes: 3, instruction: "Reveal and compare." },
  ],
  visual_kind: "hatch-ladder",
  visual_config: { mode: "diagram" },
  self_checks: [
    { id: "distinct-values", label: "All five values stay distinct." },
    { id: "spacing", label: "Spacing creates the main value change." },
    { id: "stroke-family", label: "Strokes remain parallel." },
  ],
  sequence_index: 7,
  attempt_count: 0,
  active_attempt_id: null,
  last_completed_at: null,
};

const libraryAttempt = {
  id: "20d0bd64-f65a-494d-a46e-3585f0173fe1",
  exercise_slug: libraryExercise.id,
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

function jsonResponse(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
}

vi.mock("@react-three/fiber", () => ({
  Canvas: () => <canvas aria-label="3D canvas" />,
}));
vi.mock("@react-three/drei", () => ({
  ContactShadows: () => null,
  Edges: () => null,
  OrbitControls: () => null,
  RoundedBox: () => null,
}));

function renderApp(path = "/") {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  localStorage.clear();
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Wanderline", () => {
  it("uses one navigation shell with a route-aware active state", () => {
    renderApp("/upload");
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sketch critique" })).toHaveAttribute("aria-current", "page");
  });

  it("renders one clear recommended lesson and weekly goal", async () => {
    vi.mocked(fetch).mockImplementation(() => jsonResponse(progress));
    renderApp();
    expect(await screen.findByRole("heading", { name: "Confident Lines" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start today's lesson" })).toBeInTheDocument();
    expect(screen.getByLabelText("0 of 3 practices completed this week")).toBeInTheDocument();
  });

  it("starts and restores a guided practice session", async () => {
    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith("/api/v1/progress")) return jsonResponse(progress);
      if (url.endsWith("/api/v1/practice-sessions") && init?.method === "POST") return jsonResponse(session, 201);
      if (url.endsWith(`/api/v1/exercises/${lesson.id}`)) return jsonResponse(lesson);
      if (url.endsWith(`/api/v1/practice-sessions/${session.id}`)) return jsonResponse(session);
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    renderApp();
    await userEvent.click(await screen.findByRole("button", { name: "Start today's lesson" }));
    expect(await screen.findByRole("heading", { name: "Prepare" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start timer" })).toBeInTheDocument();
    await waitFor(() =>
      expect(fetch).toHaveBeenLastCalledWith(
        `/api/v1/practice-sessions/${session.id}`,
      ),
    );
  });

  it("reflects timer motion states without exposing decoration", async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith(`/api/v1/exercises/${lesson.id}`)) return jsonResponse(lesson);
      if (url.endsWith("/api/v1/progress")) return jsonResponse(progress);
      if (url.endsWith(`/api/v1/practice-sessions/${session.id}`)) return jsonResponse(session);
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    const { container } = renderApp(`/practice/${lesson.id}?session=${session.id}`);
    await screen.findByRole("heading", { name: "Prepare" });

    const timer = container.querySelector(".practice-timer");
    const decoration = container.querySelector(".timer-motion");
    expect(timer).toHaveAttribute("data-timer-state", "idle");
    expect(decoration).toHaveAttribute("aria-hidden", "true");

    await userEvent.click(screen.getByRole("button", { name: "Start timer" }));
    expect(timer).toHaveAttribute("data-timer-state", "running");
    await userEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(timer).toHaveAttribute("data-timer-state", "paused");
  });

  it("uses a calm final-minute timer state for restored sessions", async () => {
    localStorage.setItem(`drawcoach-timer-${session.id}`, JSON.stringify({ phaseIndex: 0, secondsRemaining: 60 }));
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith(`/api/v1/exercises/${lesson.id}`)) return jsonResponse(lesson);
      if (url.endsWith("/api/v1/progress")) return jsonResponse(progress);
      if (url.endsWith(`/api/v1/practice-sessions/${session.id}`)) return jsonResponse(session);
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    const { container } = renderApp(`/practice/${lesson.id}?session=${session.id}`);
    await screen.findByRole("heading", { name: "Prepare" });
    await userEvent.click(screen.getByRole("button", { name: "Start timer" }));
    expect(container.querySelector(".practice-timer")).toHaveAttribute("data-timer-state", "final-minute");
  });

  it("offers a gentler replay after a too-hard reflection", async () => {
    const completedProgress = {
      ...progress,
      weekly_completed: 1,
      total_completed_lessons: 1,
      lessons: [{ ...progress.lessons[0], status: "completed", completed_sessions: 1 }],
    };
    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith(`/api/v1/exercises/${lesson.id}`)) return jsonResponse(lesson);
      if (url.endsWith("/api/v1/progress")) return jsonResponse(progress);
      if (url.endsWith(`/api/v1/practice-sessions/${session.id}/complete`) && init?.method === "POST") {
        return jsonResponse({
          session: { ...session, status: "completed", difficulty_response: "too_hard", completed_at: "2026-08-10T10:15:00Z" },
          progress: completedProgress,
        });
      }
      if (url.endsWith(`/api/v1/practice-sessions/${session.id}`)) return jsonResponse(session);
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    renderApp(`/practice/${lesson.id}?session=${session.id}`);
    await userEvent.click(await screen.findByRole("button", { name: "Finish early" }));
    await userEvent.click(screen.getByRole("button", { name: "Too hard" }));
    await userEvent.type(screen.getByLabelText(/What did you notice/), "Long lines felt shaky.");
    await userEvent.click(screen.getByRole("button", { name: "Complete lesson" }));
    expect(await screen.findByRole("heading", { name: "Same idea, smaller step." })).toBeInTheDocument();
    expect(screen.getByText("Use shorter dot pairs.")).toBeInTheDocument();
  });

  it("renders the reusable scene breakdown studio", () => {
    renderApp("/studio/3d");
    expect(screen.getByRole("heading", { name: "See the scene. Build the drawing." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /One cube, clearly understood/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /A small studio still life/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sunset sail, built from shapes/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "whole study guide" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Scene studio" })).toHaveAttribute("aria-current", "page");
  });

  it("teaches an illustrated scene in color or three values", async () => {
    renderApp("/studio/3d");
    await userEvent.click(screen.getByRole("button", { name: /Sunset sail, built from shapes/ }));

    expect(screen.getByRole("img", { name: "Original illustrated sailboat scene, limited-color view" })).toBeInTheDocument();
    expect(screen.getByText("What makes this scene readable at thumbnail size?")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Color is the finish, not the foundation." })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "3 values" }));
    expect(screen.getByRole("img", { name: "Original illustrated sailboat scene, three-value view" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3 values" })).toHaveAttribute("aria-pressed", "true");
  });

  it("walks through predict, reveal, draw, compare, and restores scene progress", async () => {
    const firstRender = renderApp("/studio/3d");
    expect(screen.getByRole("button", { name: "Make a prediction first" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "The main subject" }));
    await userEvent.click(screen.getByRole("button", { name: "Reveal the visual guide" }));
    expect(screen.getByText("What to notice")).toBeInTheDocument();
    expect(screen.getByText("On your page")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Whole" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "I drew this stage" }));
    expect(screen.getByText("13%")).toBeInTheDocument();
    expect(localStorage.getItem("drawcoach-scene-study-single-cube-v1")).toContain('"whole"');

    firstRender.unmount();
    renderApp("/studio/3d");
    expect(screen.getByText("13%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "✓ Stage practiced" })).toBeInTheDocument();
  });

  it("shows a paper-first completion prompt after every scene layer is practiced", () => {
    const layers = ["whole", "composition", "shape-masses", "perspective", "primitives", "measurements", "lighting", "reconstruct"];
    localStorage.setItem("drawcoach-scene-study-single-cube-v1", JSON.stringify({
      stepIndex: 7,
      predictions: {},
      revealed: layers,
      practiced: layers,
    }));
    renderApp("/studio/3d");
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "You turned one scene into eight clear decisions." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Redraw from memory" })).toBeInTheDocument();
  });

  it("opens a built-in drawing reference from the reference finder", async () => {
    renderApp("/references");
    expect(screen.getByRole("heading", { name: "Find something worth noticing." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Four ways to start seeing." })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open Wild poppy" }));
    expect(screen.getByRole("heading", { name: "Wild poppy" })).toBeInTheDocument();
    expect(screen.getByText(/Find the gesture of the stem first/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Break down this reference" })).toBeInTheDocument();
  });

  it("searches community references and preserves source details", async () => {
    vi.mocked(fetch).mockImplementation(() => jsonResponse({
      results: [{
        id: "blue-bicycle",
        title: "Blue bicycle",
        thumbnail: "https://api.openverse.org/thumb/blue-bicycle",
        url: "https://images.example.test/blue-bicycle.jpg",
        foreign_landing_url: "https://commons.wikimedia.org/wiki/File:Blue_bicycle.jpg",
        creator: "Alex Example",
        license: "by",
        license_version: "4.0",
        source: "wikimedia",
        category: "photograph",
        filetype: "jpg",
        fields_matched: ["title", "tags.name"],
        tags: [{ name: "bicycle" }, { name: "blue" }],
      }],
    }));
    renderApp("/references");
    await userEvent.type(screen.getByLabelText("What would you like to draw?"), "blue bicycle");
    await userEvent.click(screen.getByRole("button", { name: "Find references" }));
    expect(await screen.findByRole("heading", { name: "Blue bicycle" })).toBeInTheDocument();
    const preview = screen.getByAltText("Blue bicycle");
    expect(preview).toHaveAttribute("src", "https://api.openverse.org/thumb/blue-bicycle");
    fireEvent.error(preview);
    expect(preview).toHaveAttribute("src", "https://images.example.test/blue-bicycle.jpg");
    await userEvent.click(screen.getByRole("button", { name: "Open Blue bicycle" }));
    expect(screen.getByText(/Reference by Alex Example via Wikimedia Commons/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View source/ })).toHaveAttribute("href", "https://commons.wikimedia.org/wiki/File:Blue_bicycle.jpg");
  });

  it("filters weak text-only matches and applies repository search controls", async () => {
    vi.mocked(fetch).mockImplementation(() => jsonResponse({
      results: [
        {
          id: "garden-fox",
          title: "Garden fox",
          thumbnail: "https://api.openverse.org/thumb/garden-fox",
          foreign_landing_url: "https://example.test/garden-fox",
          creator: "Example Artist",
          license: "by",
          license_version: "4.0",
          source: "wikimedia",
          category: "illustration",
          filetype: "png",
          fields_matched: ["title"],
          tags: [{ name: "fox" }, { name: "garden" }],
        },
        {
          id: "county-map",
          title: "Red Fox County locator map",
          thumbnail: "https://api.openverse.org/thumb/map",
          fields_matched: ["title", "tags.name"],
          tags: [{ name: "red" }, { name: "fox" }],
        },
      ],
    }));

    renderApp("/references");
    await userEvent.type(screen.getByLabelText("What would you like to draw?"), "garden fox");
    await userEvent.click(screen.getByRole("button", { name: "Find references" }));
    expect(await screen.findByRole("heading", { name: "Garden fox" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Red Fox County locator map" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Illustrations" }));
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([input]) => String(input).includes("category=illustration"))).toBe(true));
    await userEvent.click(screen.getByRole("button", { name: "Wikimedia only" }));
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([input]) => String(input).includes("source=wikimedia"))).toBe(true));
  });

  it("hands a community reference to image breakdown", async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.startsWith("https://api.openverse.org/v1/images/")) {
        return jsonResponse({
          results: [{
            id: "blue-bicycle",
            title: "Blue bicycle",
            thumbnail: "https://api.openverse.org/thumb/blue-bicycle",
            url: "https://images.example.test/blue-bicycle.jpg",
            foreign_landing_url: "https://commons.wikimedia.org/wiki/File:Blue_bicycle.jpg",
            creator: "Alex Example",
            license: "by",
            license_version: "4.0",
            source: "wikimedia",
            category: "photograph",
            filetype: "jpg",
            fields_matched: ["title", "tags.name"],
            tags: [{ name: "bicycle" }, { name: "blue" }],
          }],
        });
      }
      if (url === "https://api.openverse.org/thumb/blue-bicycle") {
        return Promise.resolve(new Response("thumbnail unavailable", { status: 503 }));
      }
      if (url === "https://images.example.test/blue-bicycle.jpg") {
        return Promise.resolve(new Response("jpeg bytes", { status: 200, headers: { "Content-Type": "image/jpeg" } }));
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    renderApp("/references?for=breakdown");
    expect(screen.getByText("Choose a strong subject match, then send it directly to Image Breakdown.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("What would you like to draw?"), "blue bicycle");
    await userEvent.click(screen.getByRole("button", { name: "Find references" }));
    await userEvent.click(await screen.findByRole("button", { name: "Open Blue bicycle" }));
    await userEvent.click(screen.getByRole("button", { name: "Break down this reference" }));

    expect((await screen.findByText(/Selected from Reference Finder:/)).closest("p")).toHaveTextContent("Blue bicycle · Alex Example");
    expect(screen.getByRole("link", { name: /View source/ })).toHaveAttribute("href", "https://commons.wikimedia.org/wiki/File:Blue_bicycle.jpg");
    expect(await screen.findByAltText("Selected reference preview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Break down image" })).toBeEnabled();
  });

  it("browses and filters the independent exercise library", async () => {
    const perspective = { ...libraryExercise, id: "one-point-box-field", title: "One-Point Box Field", track: "perspective", sequence_index: 1 };
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/api/v1/library/history")) return jsonResponse({ recent_attempts: [], exercises: [] });
      if (url.includes("track=perspective")) return jsonResponse([perspective]);
      if (url.includes("/api/v1/library/exercises")) return jsonResponse([perspective, libraryExercise]);
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    renderApp("/library");
    expect(await screen.findByRole("heading", { name: "Choose today’s page." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "One-Point Box Field" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Five-Value Hatch Ladder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Portrait Foundations" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Figure & Creature" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Perspective" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Five-Value Hatch Ladder" })).not.toBeInTheDocument());
    expect(screen.getByText("1 unlocked exercise")).toBeInTheDocument();
  });

  it("renders a complete portrait construction reference and reveal guide", async () => {
    const portraitExercise = {
      ...libraryExercise,
      id: "head-as-form",
      title: "Head as a Turning Form",
      track: "portrait_foundations",
      visual_kind: "head-construction",
      visual_config: { mode: "diagram" },
      self_checks: [
        { id: "turn", label: "The center line describes the turn." },
        { id: "brow-wrap", label: "The brow wraps around the form." },
        { id: "jaw-attach", label: "The jaw attaches to the side plane." },
      ],
      sequence_index: 10,
    };
    const portraitAttempt = {
      ...libraryAttempt,
      id: "30d0bd64-f65a-494d-a46e-3585f0173fe2",
      exercise_slug: portraitExercise.id,
      variant_data: { kind: "head-construction", head_turn: 16, head_tilt: -8, face_shape: "oval" },
    };
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith(`/api/v1/library/exercises/${portraitExercise.id}`)) return jsonResponse(portraitExercise);
      if (url.endsWith(`/api/v1/library/attempts/${portraitAttempt.id}`)) return jsonResponse(portraitAttempt);
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    renderApp(`/library/${portraitExercise.id}/attempt/${portraitAttempt.id}`);
    expect(await screen.findByRole("img", { name: "head construction exercise reference" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Finish early" }));
    await userEvent.click(screen.getByRole("button", { name: "Reveal visual guides" }));
    expect(screen.getByTestId("reveal-overlay")).toBeInTheDocument();
  });

  it("runs a generated drill through reveal, self-check, and completion", async () => {
    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith(`/api/v1/library/exercises/${libraryExercise.id}`)) return jsonResponse(libraryExercise);
      if (url.endsWith("/api/v1/library/attempts") && init?.method === "POST") return jsonResponse(libraryAttempt);
      if (url.endsWith(`/api/v1/library/attempts/${libraryAttempt.id}/complete`) && init?.method === "POST") {
        return jsonResponse({
          ...libraryAttempt,
          status: "completed",
          self_check_responses: { "distinct-values": "met", spacing: "met", "stroke-family": "met" },
          difficulty_response: "just_right",
          completed_at: "2026-08-10T10:12:00Z",
        });
      }
      if (url.endsWith(`/api/v1/library/attempts/${libraryAttempt.id}`)) return jsonResponse(libraryAttempt);
      if (url.includes("/api/v1/library/exercises")) return jsonResponse([libraryExercise]);
      if (url.includes("/api/v1/library/history")) return jsonResponse({ recent_attempts: [], exercises: [] });
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    renderApp(`/library/${libraryExercise.id}`);
    await userEvent.click(await screen.findByRole("button", { name: "Begin this drill" }));
    expect(await screen.findByTestId("library-diagram-reference")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Finish early" }));
    expect(screen.getByRole("heading", { name: "Read your page, not a grade." })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reveal visual guides" }));
    expect(screen.getByTestId("reveal-overlay")).toBeInTheDocument();
    for (const button of screen.getAllByRole("button", { name: "I see it" })) await userEvent.click(button);
    await userEvent.click(screen.getByRole("button", { name: "Right level" }));
    await userEvent.click(screen.getByRole("button", { name: "Complete this study" }));
    expect(await screen.findByRole("heading", { name: "Notice what changed." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try another variation" })).toBeInTheDocument();
  });

  it("adjusts cube color and lighting controls", () => {
    renderApp("/studio/3d");
    const color = screen.getByLabelText("Cube color");
    const grid = screen.getByRole("button", { name: "Set light position on grid" });
    const height = screen.getByLabelText("Vertical light position");
    const intensity = screen.getByLabelText("Lighting intensity");
    const angle = screen.getByLabelText("Light beam angle");

    fireEvent.change(color, { target: { value: "#3366ff" } });
    vi.spyOn(grid, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, width: 120, height: 120, right: 120, bottom: 120,
      x: 0, y: 0, toJSON: () => ({}),
    });
    fireEvent.click(grid, { clientX: 20, clientY: 20 });
    fireEvent.change(height, { target: { value: "9" } });
    fireEvent.change(intensity, { target: { value: "2.4" } });
    fireEvent.change(angle, { target: { value: "65" } });

    expect(screen.getByText("#3366FF")).toBeInTheDocument();
    expect(screen.getByText("Light placed: left, back")).toBeInTheDocument();
    expect(intensity.closest("label")).toHaveTextContent("2.4");
    expect(angle.closest("label")).toHaveTextContent("65°");
  });

  it("uploads a sketch with subject context and renders actionable results", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({
        id: "analysis-1",
        provider: "local_cv",
        status: "completed",
        summary: "These are practice signals—not an objective grade.",
        strengths: ["Detected edges are relatively connected."],
        improvements: ["Try fewer, more deliberate strokes."],
        metrics: {
          dimensions: { width: 800, height: 600 },
          contrast_range: 0.7,
          edge_density: 0.08,
          stroke_fragmentation: 1.4,
          bounding_box_occupancy: 0.55,
          dominant_line_angles: [7.5],
          dominant_direction_share: 0.42,
          value_histogram: [0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.8],
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
            target: { label: "A ceramic mug", source: "user_declared", is_frontal: false },
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
        confidence: 0.68,
        sketch: {
          id: "sketch-1",
          content_type: "image/png",
          width: 800,
          height: 600,
          actual_subject: "A ceramic mug",
          uploaded_at: "2026-07-25T00:00:00Z",
        },
        subject_prediction: {
          label: null,
          confidence: 0,
          message: "Subject recognition is not enabled in the local provider.",
        },
      }), { status: 201, headers: { "Content-Type": "application/json" } }),
    );
    renderApp("/upload");
    const file = new File(["png"], "sketch.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText(/Choose a JPEG, PNG, or HEIC/), file);
    await userEvent.type(screen.getByLabelText(/What were you trying to draw/), "A ceramic mug");
    const submit = screen.getByRole("button", { name: "Analyze sketch" });
    fireEvent.submit(submit.closest("form")!);

    expect(await screen.findByRole("heading", { name: "Your practice signals" })).toBeInTheDocument();
    expect(screen.getByText("Try fewer, more deliberate strokes.")).toBeInTheDocument();
    expect(screen.getByText(/You identified this as:/)).toHaveTextContent("A ceramic mug");
    expect(screen.getByAltText("Uploaded sketch with selectable analysis indicators"))
      .toHaveAttribute("src", "/api/v1/sketches/sketch-1/image");
    expect(screen.getByRole("button", { name: /Drawing footprint/ }))
      .toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("meter", { name: "Penmanship estimate" }))
      .toHaveAttribute("value", "76");
    expect(screen.getByRole("heading", { name: "Your three focus areas" }))
      .toBeInTheDocument();
  });

  it("uploads a reference and explores its local shape decomposition", async () => {
    vi.mocked(fetch).mockImplementationOnce(() => jsonResponse({
      id: "decomposition-12345678",
      status: "completed",
      provider: "local_cv_shapes",
      algorithm_version: "local_cv_shapes_v1",
      summary: "This local geometric study describes geometry only.",
      confidence: 0.88,
      image: {
        id: "image-1",
        content_type: "image/png",
        width: 800,
        height: 600,
        uploaded_at: "2026-08-21T00:00:00Z",
      },
      shapes: [{
        id: "shape-1",
        kind: "rectangle",
        geometry: { type: "rect", x: 0.2, y: 0.3, width: 0.6, height: 0.5 },
        color: "#bd765e",
        importance: 0.9,
        confidence: 0.94,
        z_index: 0,
        source: "fitted",
      }, {
        id: "shape-2",
        kind: "triangle",
        geometry: { type: "polygon", points: [{ x: 0.15, y: 0.32 }, { x: 0.5, y: 0.08 }, { x: 0.85, y: 0.32 }] },
        color: "#627c69",
        importance: 0.72,
        confidence: 0.91,
        z_index: 1,
        source: "fitted",
      }],
      construction_hints: [],
      levels: { simple: ["shape-1"], medium: ["shape-1", "shape-2"], detailed: ["shape-1", "shape-2"] },
      drawing_steps: [
        { order: 1, shape_id: "shape-1", instruction: "Place the rectangle mass first." },
        { order: 2, shape_id: "shape-2", instruction: "Place the triangle mass." },
      ],
      warnings: [],
      limitations: "Classical computer vision does not identify subject parts.",
    }, 201));
    renderApp("/breakdown");
    expect(screen.getByRole("link", { name: "Image breakdown" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Use Reference Finder/ })).toHaveAttribute("href", "/references?for=breakdown");
    const file = new File(["png"], "house.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText(/Choose a JPEG, PNG, or HEIC reference/), file);
    const submit = screen.getByRole("button", { name: "Break down image" });
    fireEvent.submit(submit.closest("form")!);

    expect(await screen.findByRole("heading", { name: "Build it from the largest shapes." })).toBeInTheDocument();
    expect(screen.getByAltText("Uploaded reference with geometric overlay"))
      .toHaveAttribute("src", "/api/v1/images/image-1");
    expect(screen.getByRole("button", { name: /block-in/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("checkbox", { name: "Show geometry labels" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Show construction guides" })).not.toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: /^Shapes/ }));
    expect(screen.getByText("2. triangle")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider", { name: "Photo opacity" }), { target: { value: "25" } });
    expect(screen.getByAltText("Uploaded reference with geometric overlay")).toHaveStyle({ opacity: "0.25" });
  });
});
