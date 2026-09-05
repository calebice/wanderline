import { afterEach, describe, expect, it, vi } from "vitest";

import { getLibraryExercise, recordLibraryDigitalExport, syncPendingDigitalExports, type LibraryAttempt, type LibraryExercise } from "./api";
import { cacheLibraryExercise, getCachedLibraryAttempt, getPendingDigitalExports } from "./offline";

const exercise = {
  id: "offline-one-point",
  title: "Offline one point",
  track: "perspective",
  difficulty: 1,
  duration_minutes: 12,
  objective: "Practice depth.",
  concept: "Edges converge.",
  common_mistake: "Parallel depth edges.",
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
  id: "offline-attempt-17",
  exercise_slug: exercise.id,
  status: "in_progress",
  variant_seed: 17,
  variant_version: "library_v1",
  variant_data: { kind: "one-point", horizon_y: 0.5, vanishing_x: 0.5 },
  self_check_responses: null,
  difficulty_response: null,
  takeaway: null,
  practice_medium: "paper",
  last_overlay_exported_at: null,
  started_at: "2026-08-11T08:00:00Z",
  completed_at: null,
} satisfies LibraryAttempt;

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

describe("library offline support", () => {
  it("restores a previously opened exercise when the network is unavailable", async () => {
    await cacheLibraryExercise(exercise);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    expect(await getLibraryExercise(exercise.id)).toEqual(exercise);
  });

  it("collapses offline export tracking and synchronizes after reconnect", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    const first = await recordLibraryDigitalExport(attempt);
    const second = await recordLibraryDigitalExport(first);
    expect(second.practice_medium).toBe("digital");
    expect((await getCachedLibraryAttempt(attempt.id))?.last_overlay_exported_at).not.toBeNull();
    expect((await getPendingDigitalExports()).filter((item) => item.id === attempt.id)).toHaveLength(1);

    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    const serverAttempt = { ...second, last_overlay_exported_at: "2026-08-11T09:00:00Z" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(serverAttempt), { status: 200, headers: { "Content-Type": "application/json" } })));
    await syncPendingDigitalExports();
    expect((await getPendingDigitalExports()).filter((item) => item.id === attempt.id)).toHaveLength(0);
  });
});
