import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LibraryAttempt, LibraryExercise } from "./api";
import { ProcreateOverlayEditor } from "./procreate";

const exercise = {
  id: "one-point-box-field",
  title: "One-Point Box Field",
  track: "perspective",
  difficulty: 1,
  duration_minutes: 12,
  objective: "Draw depth.",
  concept: "Converge edges.",
  common_mistake: "Parallel edges.",
  materials: ["iPad"],
  instructions: ["Draw."],
  timed_phases: [{ label: "Draw", minutes: 12, instruction: "Draw." }],
  visual_kind: "one-point",
  visual_config: { mode: "diagram" },
  self_checks: [{ id: "depth", label: "Depth converges." }],
  sequence_index: 1,
  attempt_count: 0,
  active_attempt_id: null,
  last_completed_at: null,
} satisfies LibraryExercise;

const attempt = {
  id: "attempt-1",
  exercise_slug: exercise.id,
  status: "in_progress",
  variant_seed: 451234,
  variant_version: "library_v1",
  variant_data: { kind: "one-point", horizon_y: 0.5, vanishing_x: 0.44 },
  self_check_responses: null,
  difficulty_response: null,
  takeaway: null,
  practice_medium: "paper",
  last_overlay_exported_at: null,
  started_at: "2026-08-11T08:00:00Z",
  completed_at: null,
} satisfies LibraryAttempt;

beforeEach(() => {
  class ReadyImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  }
  vi.stubGlobal("Image", ReadyImage);
  vi.stubGlobal("ClipboardItem", class { constructor(public data: Record<string, Blob>) {} });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn((blob: Blob) => blob.type.includes("svg") ? "blob:svg" : "blob:png") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { write: vi.fn().mockResolvedValue(undefined) } });
  const originalCreate = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
    if (tag !== "canvas") return originalCreate(tag);
    return {
      width: 0,
      height: 0,
      getContext: () => ({ clearRect: vi.fn(), drawImage: vi.fn() }),
      toBlob: (callback: BlobCallback) => callback(new Blob(["png"], { type: "image/png" })),
    } as unknown as HTMLCanvasElement;
  }) as typeof document.createElement);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
});

describe("Procreate overlay editor", () => {
  it("prepares, customizes, and copies an exact-size PNG", async () => {
    const onExport = vi.fn().mockResolvedValue(undefined);
    render(<ProcreateOverlayEditor exercise={exercise} attempt={attempt} onClose={vi.fn()} onExport={onExport} />);
    expect(screen.getByRole("heading", { name: "Place the construction on your canvas." })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Include short instructional labels" })).not.toBeChecked();

    await userEvent.click(screen.getByRole("button", { name: /iPad landscape/ }));
    expect(screen.getByLabelText("Overlay width")).toHaveValue(2732);
    expect(screen.getByLabelText("Overlay height")).toHaveValue(2048);
    await userEvent.click(screen.getByRole("checkbox", { name: "Include short instructional labels" }));
    expect(screen.getByRole("checkbox", { name: "Include short instructional labels" })).toBeChecked();

    const copy = screen.getByRole("button", { name: "Copy overlay" });
    await waitFor(() => expect(copy).toBeEnabled());
    await userEvent.click(copy);
    expect(navigator.clipboard.write).toHaveBeenCalledTimes(1);
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Switch to Procreate and choose Paste/)).toBeInTheDocument();
  });

  it("blocks oversized custom canvases before rendering", async () => {
    render(<ProcreateOverlayEditor exercise={exercise} attempt={attempt} onClose={vi.fn()} onExport={vi.fn()} />);
    const width = screen.getByLabelText("Overlay width");
    await userEvent.clear(width);
    await userEvent.type(width, "5000");
    const height = screen.getByLabelText("Overlay height");
    await userEvent.clear(height);
    await userEvent.type(height, "4000");
    expect(screen.getByRole("alert")).toHaveTextContent("16.8 megapixels");
    expect(screen.getByRole("button", { name: "Copy overlay" })).toBeDisabled();
  });
});
