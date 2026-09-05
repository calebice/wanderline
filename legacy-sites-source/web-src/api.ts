import { z } from "zod";

import {
  cacheLibraryAttempt,
  cacheLibraryExercise,
  cacheLibraryExercises,
  getCachedLibraryAttempt,
  getCachedLibraryExercise,
  getCachedLibraryExercises,
  getPendingDigitalExports,
  isOnline,
  queueDigitalExport,
  removePendingDigitalExport,
} from "./offline";

const exerciseSchema = z.object({
  id: z.string(),
  title: z.string(),
  skill: z.string(),
  difficulty: z.number().int(),
  duration_minutes: z.number().int(),
  instructions: z.array(z.string()),
  completion_requirements: z.record(z.string(), z.unknown()),
  reference_mode: z.string(),
  sequence_index: z.number().int(),
  week_number: z.number().int(),
  objective: z.string(),
  concept: z.string(),
  why_it_matters: z.string(),
  common_mistake: z.string(),
  materials: z.array(z.string()),
  timed_phases: z.array(z.object({
    label: z.string(),
    minutes: z.number().int().positive(),
    instruction: z.string(),
  })),
  visual_kind: z.string(),
  three_d_config: z.record(z.string(), z.unknown()).nullable(),
  replay_variation: z.string(),
});

export type Exercise = z.infer<typeof exerciseSchema>;

const practiceSessionSchema = z.object({
  id: z.string(),
  exercise_id: z.string(),
  status: z.string(),
  difficulty_response: z.string().nullable(),
  takeaway: z.string().nullable(),
  started_at: z.string(),
  completed_at: z.string().nullable(),
});

export type PracticeSession = z.infer<typeof practiceSessionSchema>;

const progressSchema = z.object({
  learner_name: z.string(),
  weekly_target: z.number().int(),
  weekly_completed: z.number().int(),
  total_completed_lessons: z.number().int(),
  total_lessons: z.number().int(),
  recommended_exercise_id: z.string(),
  current_milestone: z.string(),
  lessons: z.array(z.object({
    exercise: exerciseSchema,
    status: z.enum(["not_started", "in_progress", "completed"]),
    active_session_id: z.string().nullable(),
    completed_sessions: z.number().int(),
    last_completed_at: z.string().nullable(),
  })),
  milestones: z.array(z.object({
    week_number: z.number().int(),
    title: z.string(),
    completed_lessons: z.number().int(),
    total_lessons: z.number().int(),
    status: z.enum(["upcoming", "current", "completed"]),
  })),
  recent_reflections: z.array(z.object({
    session_id: z.string(),
    exercise_id: z.string(),
    exercise_title: z.string(),
    difficulty_response: z.string(),
    takeaway: z.string().nullable(),
    completed_at: z.string(),
  })),
});

export type Progress = z.infer<typeof progressSchema>;

const libraryExerciseSchema = z.object({
  id: z.string(),
  title: z.string(),
  track: z.enum(["perspective", "solid_form", "hatching_light", "portrait_foundations", "figure_creature"]),
  difficulty: z.number().int().min(1).max(3),
  duration_minutes: z.number().int(),
  objective: z.string(),
  concept: z.string(),
  common_mistake: z.string(),
  materials: z.array(z.string()),
  instructions: z.array(z.string()),
  timed_phases: z.array(z.object({
    label: z.string(),
    minutes: z.number().int().positive(),
    instruction: z.string(),
  })),
  visual_kind: z.string(),
  visual_config: z.record(z.string(), z.unknown()),
  self_checks: z.array(z.object({ id: z.string(), label: z.string() })),
  sequence_index: z.number().int(),
  attempt_count: z.number().int(),
  active_attempt_id: z.string().nullable(),
  last_completed_at: z.string().nullable(),
});

export type LibraryExercise = z.infer<typeof libraryExerciseSchema>;

const libraryAttemptSchema = z.object({
  id: z.string(),
  exercise_slug: z.string(),
  status: z.enum(["in_progress", "completed"]),
  variant_seed: z.number().int(),
  variant_version: z.string(),
  variant_data: z.record(z.string(), z.unknown()),
  self_check_responses: z.record(z.string(), z.string()).nullable(),
  difficulty_response: z.string().nullable(),
  takeaway: z.string().nullable(),
  practice_medium: z.enum(["paper", "digital"]),
  last_overlay_exported_at: z.string().nullable(),
  started_at: z.string(),
  completed_at: z.string().nullable(),
});

export type LibraryAttempt = z.infer<typeof libraryAttemptSchema>;

const libraryHistorySchema = z.object({
  recent_attempts: z.array(libraryAttemptSchema),
  exercises: z.array(z.object({
    exercise_slug: z.string(),
    title: z.string(),
    attempt_count: z.number().int(),
    last_completed_at: z.string().nullable(),
  })),
});

export type LibraryHistory = z.infer<typeof libraryHistorySchema>;

const apiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

const annotationGeometrySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("rect"),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
  z.object({ type: z.literal("point"), x: z.number(), y: z.number() }),
  z.object({
    type: z.literal("line"),
    x1: z.number(),
    y1: z.number(),
    x2: z.number(),
    y2: z.number(),
  }),
]);

const coachingProfileSchema = z.object({
  calculation_version: z.string(),
  target: z.object({
    label: z.string(),
    source: z.enum(["user_declared", "none"]),
    is_frontal: z.boolean(),
  }),
  scores: z.array(z.object({
    id: z.string(),
    label: z.string(),
    score: z.number().min(0).max(100),
    confidence: z.number().min(0).max(1),
    evidence: z.string(),
    meaning: z.string(),
  })),
  style_signals: z.array(z.object({ label: z.string(), basis: z.string() })),
  focus_areas: z.array(z.object({
    id: z.string(),
    label: z.string(),
    score: z.number(),
    priority: z.number().int(),
    rationale: z.string(),
    action: z.string(),
    annotation_id: z.string(),
  })),
  subject_checks: z.array(z.object({ label: z.string(), prompt: z.string() })),
  limitations: z.string(),
});

export async function getExercises(): Promise<Exercise[]> {
  const response = await fetch(`${apiUrl}/api/v1/exercises`);
  if (!response.ok) throw new Error("Unable to load exercises");
  return z.array(exerciseSchema).parse(await response.json());
}

export async function getExercise(exerciseId: string): Promise<Exercise> {
  const response = await fetch(`${apiUrl}/api/v1/exercises/${exerciseId}`);
  if (!response.ok) throw new Error("Unable to load this lesson");
  return exerciseSchema.parse(await response.json());
}

export async function getProgress(): Promise<Progress> {
  const response = await fetch(`${apiUrl}/api/v1/progress`);
  if (!response.ok) throw new Error("Unable to load your path");
  return progressSchema.parse(await response.json());
}

export async function getLibraryExercises(
  track?: string,
  difficulty?: number,
): Promise<LibraryExercise[]> {
  const params = new URLSearchParams();
  if (track) params.set("track", track);
  if (difficulty) params.set("difficulty", String(difficulty));
  const query = params.size ? `?${params}` : "";
  try {
    const response = await fetch(`${apiUrl}/api/v1/library/exercises${query}`);
    if (!response.ok) throw new Error("Unable to load the exercise library");
    const exercises = z.array(libraryExerciseSchema).parse(await response.json());
    await cacheLibraryExercises(exercises);
    return exercises;
  } catch (error) {
    const cached = await getCachedLibraryExercises(track, difficulty);
    if (cached.length) return cached;
    throw error;
  }
}

export async function getLibraryExercise(slug: string): Promise<LibraryExercise> {
  try {
    const response = await fetch(`${apiUrl}/api/v1/library/exercises/${slug}`);
    if (!response.ok) throw new Error("Unable to load this library exercise");
    const exercise = libraryExerciseSchema.parse(await response.json());
    await cacheLibraryExercise(exercise);
    return exercise;
  } catch (error) {
    const cached = await getCachedLibraryExercise(slug);
    if (cached) return cached;
    throw error;
  }
}

export async function startLibraryAttempt(exerciseSlug: string): Promise<LibraryAttempt> {
  const response = await fetch(`${apiUrl}/api/v1/library/attempts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ exercise_slug: exerciseSlug }),
  });
  if (!response.ok) throw new Error("Unable to start this exercise");
  const attempt = libraryAttemptSchema.parse(await response.json());
  await cacheLibraryAttempt(attempt);
  return attempt;
}

export async function getLibraryAttempt(attemptId: string): Promise<LibraryAttempt> {
  try {
    const response = await fetch(`${apiUrl}/api/v1/library/attempts/${attemptId}`);
    if (!response.ok) throw new Error("Unable to restore this exercise attempt");
    const attempt = libraryAttemptSchema.parse(await response.json());
    await cacheLibraryAttempt(attempt);
    return attempt;
  } catch (error) {
    const cached = await getCachedLibraryAttempt(attemptId);
    if (cached) return cached;
    throw error;
  }
}

export async function completeLibraryAttempt(
  attemptId: string,
  selfCheckResponses: Record<string, "met" | "needs_work">,
  difficultyResponse: "too_easy" | "just_right" | "too_hard",
  takeaway: string,
): Promise<LibraryAttempt> {
  const response = await fetch(`${apiUrl}/api/v1/library/attempts/${attemptId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      self_check_responses: selfCheckResponses,
      difficulty_response: difficultyResponse,
      takeaway: takeaway.trim() || null,
    }),
  });
  if (!response.ok) throw new Error("Unable to save this exercise attempt");
  const attempt = libraryAttemptSchema.parse(await response.json());
  await cacheLibraryAttempt(attempt);
  return attempt;
}

function offlineDigitalAttempt(attempt: LibraryAttempt, exportedAt = new Date().toISOString()) {
  return { ...attempt, practice_medium: "digital" as const, last_overlay_exported_at: exportedAt };
}

export async function recordLibraryDigitalExport(attempt: LibraryAttempt): Promise<LibraryAttempt> {
  const exportedAt = new Date().toISOString();
  if (!isOnline()) {
    const updated = offlineDigitalAttempt(attempt, exportedAt);
    await Promise.all([cacheLibraryAttempt(updated), queueDigitalExport(attempt.id, exportedAt)]);
    return updated;
  }
  try {
    const response = await fetch(`${apiUrl}/api/v1/library/attempts/${attempt.id}/digital-export`, { method: "POST" });
    if (!response.ok) throw new Error("Unable to record digital practice");
    const updated = libraryAttemptSchema.parse(await response.json());
    await cacheLibraryAttempt(updated);
    return updated;
  } catch {
    const updated = offlineDigitalAttempt(attempt, exportedAt);
    await Promise.all([cacheLibraryAttempt(updated), queueDigitalExport(attempt.id, exportedAt)]);
    return updated;
  }
}

export async function syncPendingDigitalExports(): Promise<void> {
  if (!isOnline()) return;
  const pending = await getPendingDigitalExports();
  await Promise.all(pending.map(async ({ id }) => {
    try {
      const response = await fetch(`${apiUrl}/api/v1/library/attempts/${id}/digital-export`, { method: "POST" });
      if (!response.ok) return;
      const updated = libraryAttemptSchema.parse(await response.json());
      await Promise.all([cacheLibraryAttempt(updated), removePendingDigitalExport(id)]);
    } catch {
      // Leave the collapsed record for the next reconnect.
    }
  }));
}

export async function getLibraryHistory(): Promise<LibraryHistory> {
  const response = await fetch(`${apiUrl}/api/v1/library/history`);
  if (!response.ok) throw new Error("Unable to load library history");
  return libraryHistorySchema.parse(await response.json());
}

export async function createPracticeSession(exerciseId: string): Promise<PracticeSession> {
  const response = await fetch(`${apiUrl}/api/v1/practice-sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ exercise_id: exerciseId }),
  });
  if (!response.ok) throw new Error("Unable to start practice");
  return practiceSessionSchema.parse(await response.json());
}

export async function getPracticeSession(sessionId: string): Promise<PracticeSession> {
  const response = await fetch(`${apiUrl}/api/v1/practice-sessions/${sessionId}`);
  if (!response.ok) throw new Error("Unable to restore this practice session");
  return practiceSessionSchema.parse(await response.json());
}

export async function completePracticeSession(
  sessionId: string,
  difficultyResponse: "too_easy" | "just_right" | "too_hard",
  takeaway: string,
): Promise<{ session: PracticeSession; progress: Progress }> {
  const response = await fetch(`${apiUrl}/api/v1/practice-sessions/${sessionId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      difficulty_response: difficultyResponse,
      takeaway: takeaway.trim() || null,
    }),
  });
  if (!response.ok) throw new Error("Unable to save your reflection");
  return z.object({ session: practiceSessionSchema, progress: progressSchema })
    .parse(await response.json());
}

const analysisSchema = z.object({
  id: z.string(),
  provider: z.string(),
  status: z.string(),
  summary: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  metrics: z.object({
    dimensions: z.object({ width: z.number(), height: z.number() }),
    contrast_range: z.number(),
    edge_density: z.number(),
    stroke_fragmentation: z.number(),
    bounding_box_occupancy: z.number(),
    dominant_line_angles: z.array(z.number()),
    dominant_direction_share: z.number(),
    value_histogram: z.array(z.number()),
    visual_center: z.object({ x: z.number(), y: z.number() }),
    center_offset: z.number(),
    left_right_balance: z.number(),
    top_bottom_balance: z.number(),
    mirror_similarity: z.number(),
    annotations: z.array(z.object({
      id: z.string(),
      label: z.string(),
      detail: z.string(),
      tone: z.enum(["positive", "info", "practice"]),
      geometry: annotationGeometrySchema,
    })),
    coaching_profile: coachingProfileSchema,
  }),
  confidence: z.number(),
  sketch: z.object({
    id: z.string(),
    content_type: z.string(),
    width: z.number(),
    height: z.number(),
    actual_subject: z.string().nullable(),
    uploaded_at: z.string(),
  }),
  subject_prediction: z.object({
    label: z.string().nullable(),
    confidence: z.number(),
    message: z.string(),
  }),
});

export type SketchAnalysis = z.infer<typeof analysisSchema>;

const decompositionPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

const decompositionGeometrySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("rect"),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1),
  }),
  z.object({
    type: z.literal("ellipse"),
    cx: z.number().min(0).max(1),
    cy: z.number().min(0).max(1),
    rx: z.number().min(0).max(1),
    ry: z.number().min(0).max(1),
    rotation: z.number(),
  }),
  z.object({
    type: z.literal("rotated_rect"),
    cx: z.number().min(0).max(1),
    cy: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1),
    rotation: z.number(),
    points: z.array(decompositionPointSchema),
  }),
  z.object({ type: z.literal("polygon"), points: z.array(decompositionPointSchema) }),
]);

const decompositionGuideSchema = z.union([
  decompositionGeometrySchema,
  z.object({
    type: z.literal("line"),
    x1: z.number().min(0).max(1),
    y1: z.number().min(0).max(1),
    x2: z.number().min(0).max(1),
    y2: z.number().min(0).max(1),
  }),
]);

const imageDecompositionSchema = z.object({
  id: z.string(),
  status: z.string(),
  provider: z.string(),
  algorithm_version: z.string(),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  image: z.object({
    id: z.string(),
    content_type: z.string(),
    width: z.number().int(),
    height: z.number().int(),
    uploaded_at: z.string(),
  }),
  shapes: z.array(z.object({
    id: z.string(),
    kind: z.enum([
      "rectangle",
      "rotated_rectangle",
      "triangle",
      "circle",
      "ellipse",
      "quadrilateral",
      "polygon",
    ]),
    geometry: decompositionGeometrySchema,
    color: z.string(),
    importance: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
    z_index: z.number().int(),
    source: z.enum(["fitted", "fallback"]),
  })),
  construction_hints: z.array(z.object({
    id: z.string(),
    kind: z.enum(["box_like", "cylinder_like", "sphere_like", "cone_like"]),
    member_shape_ids: z.array(z.string()),
    confidence: z.number().min(0).max(1),
    guides: z.array(decompositionGuideSchema),
  })),
  levels: z.object({
    simple: z.array(z.string()),
    medium: z.array(z.string()),
    detailed: z.array(z.string()),
  }),
  drawing_steps: z.array(z.object({
    order: z.number().int(),
    shape_id: z.string(),
    instruction: z.string(),
  })),
  warnings: z.array(z.string()),
  limitations: z.string(),
});

export type ImageDecomposition = z.infer<typeof imageDecompositionSchema>;
export type DecompositionShape = ImageDecomposition["shapes"][number];
export type DecompositionGeometry = DecompositionShape["geometry"];
export type DecompositionGuide = ImageDecomposition["construction_hints"][number]["guides"][number];

export function sketchImageUrl(sketchId: string): string {
  return `${apiUrl}/api/v1/sketches/${sketchId}/image`;
}

export function decompositionImageUrl(imageId: string): string {
  return `${apiUrl}/api/v1/images/${imageId}`;
}

export async function createImageDecomposition(file: File): Promise<ImageDecomposition> {
  const body = new FormData();
  body.append("image", file);
  const response = await fetch(`${apiUrl}/api/v1/image-decompositions`, {
    method: "POST",
    body,
  });
  if (!response.ok) {
    const error = z.object({ detail: z.string() }).safeParse(await response.json());
    throw new Error(error.success ? error.data.detail : "Unable to break down this image");
  }
  return imageDecompositionSchema.parse(await response.json());
}

export async function getImageDecomposition(id: string): Promise<ImageDecomposition> {
  const response = await fetch(`${apiUrl}/api/v1/image-decompositions/${id}`);
  if (!response.ok) throw new Error("Unable to restore this image breakdown");
  return imageDecompositionSchema.parse(await response.json());
}

export async function analyzeSketch(file: File, actualSubject: string): Promise<SketchAnalysis> {
  const body = new FormData();
  body.append("sketch", file);
  if (actualSubject.trim()) body.append("actual_subject", actualSubject.trim());
  const response = await fetch(`${apiUrl}/api/v1/analyses`, { method: "POST", body });
  if (!response.ok) {
    const error = z.object({ detail: z.string() }).safeParse(await response.json());
    throw new Error(error.success ? error.data.detail : "Unable to analyze this sketch");
  }
  return analysisSchema.parse(await response.json());
}
