import type { LessonContent, LessonGenerationBrief, PaintingLesson } from "./lesson-model";

const pendingActions = new Map<string, { key: string; promise?: Promise<GenerationRun> }>();
async function generationAction(path: string, body: Record<string, unknown> = {}): Promise<GenerationRun> {
  const identity = path + JSON.stringify(body);
  const pending = pendingActions.get(identity) || { key: crypto.randomUUID() };
  if (pending.promise) return pending.promise;
  pendingActions.set(identity, pending);
  pending.promise = request<GenerationRun>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, idempotency_key: pending.key }) });
  try { const result = await pending.promise; pendingActions.delete(identity); return result; }
  catch (error) { pending.promise = undefined; throw error; }
}

const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, init);
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string | Array<{ msg: string }> } | null;
    throw new Error(Array.isArray(payload?.detail) ? payload.detail.map((item) => item.msg).join(" ") : payload?.detail || `We couldn’t finish that request (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export function hydrateLesson(lesson: PaintingLesson): PaintingLesson {
  return { ...lesson, assets: lesson.assets.map((asset) => ({ ...asset, image_url: asset.image_url.startsWith("http") ? asset.image_url : `${apiBase}${asset.image_url}` })) };
}

export async function listLessons(state: "saved" | "drafts" | "all" = "saved") { return (await request<PaintingLesson[]>(`/api/v1/painting-lessons${state === "saved" ? "" : `?state=${state}`}`)).map(hydrateLesson); }
export async function getLesson(id: string) { return hydrateLesson(await request<PaintingLesson>(`/api/v1/painting-lessons/${id}`)); }
export async function createLesson(metadata: Record<string, unknown>) { return request<PaintingLesson>("/api/v1/painting-lessons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(metadata) }); }
export async function getLessonCapabilities() { return request<{ image_generation_available: boolean }>("/api/v1/painting-lessons/capabilities"); }
export async function updateLessonBrief(id: string, generationBrief: LessonGenerationBrief, metadata: Record<string, unknown> = {}) { return request<PaintingLesson>(`/api/v1/painting-lessons/${id}/brief`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ generation_brief: generationBrief, ...metadata }) }); }
export async function startTargetGeneration(id: string, adjustment = "") { return generationAction(`/api/v1/painting-lessons/${id}/target-generations`, { adjustment: adjustment || null }); }
export async function approveTarget(id: string, assetId: string) { return hydrateLesson(await request<PaintingLesson>(`/api/v1/painting-lessons/${id}/target`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ asset_id: assetId }) })); }
export async function uploadReferences(id: string, files: File[]) { const body = new FormData(); files.forEach((file) => body.append("images", file)); return request<PaintingLesson>(`/api/v1/painting-lessons/${id}/references`, { method: "POST", body }); }
export async function choosePrimary(id: string, assetId: string) { return request<PaintingLesson>(`/api/v1/painting-lessons/${id}/references/${assetId}/primary`, { method: "PATCH" }); }
export async function removeReference(id: string, assetId: string) { return request<PaintingLesson>(`/api/v1/painting-lessons/${id}/references/${assetId}`, { method: "DELETE" }); }

export type GenerationRun = { id: string; lesson_id: string; scope: string; section_key: string | null; status: string; result: unknown; error_message: string | null; recoverable?: boolean; error_code?: string; progress?: { phase?: string; completed?: number; total?: number; items?: Array<{ key: string; status: string; message?: string }> } | null };
export async function startGeneration(id: string, includeStudyImage: boolean) { return generationAction(`/api/v1/painting-lessons/${id}/generations`, { include_study_image: includeStudyImage }); }
export async function startStageGeneration(id: string, stageId: string, adjustment = "") { return generationAction(`/api/v1/painting-lessons/${id}/stage-generations`, { start_stage_id: stageId, adjustment: adjustment || null }); }
export async function startSectionGeneration(id: string, key: string, content: LessonContent) { return generationAction(`/api/v1/painting-lessons/${id}/sections/${encodeURIComponent(key)}/generations`, { current_content: content }); }
export async function getGeneration(id: string) { return request<GenerationRun>(`/api/v1/lesson-generations/${id}`); }
export async function retryGeneration(id: string) { return request<GenerationRun>(`/api/v1/lesson-generations/${id}/retry`, { method: "POST" }); }
export async function latestGenerated(lessonId: string, key: string) { return request<GenerationRun>(`/api/v1/painting-lessons/${lessonId}/sections/${encodeURIComponent(key)}/latest-generated`); }
export async function saveLesson(lesson: PaintingLesson, content: LessonContent) { return hydrateLesson(await request<PaintingLesson>(`/api/v1/painting-lessons/${lesson.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expected_revision: lesson.revision, title: lesson.title, subject: lesson.subject, artistic_context: lesson.artistic_context, difficulty: lesson.difficulty, estimated_duration_minutes: lesson.estimated_duration_minutes, content }) })); }

export async function waitForGeneration(runId: string, onProgress?: (run: GenerationRun) => void, signal?: AbortSignal) {
  for (let attempt = 0; ; attempt += 1) {
    signal?.throwIfAborted();
    const run = await request<GenerationRun>(`/api/v1/lesson-generations/${runId}`, { signal });
    onProgress?.(run);
    if (run.status === "completed" || run.status === "failed") return run;
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new DOMException("Stopped watching", "AbortError")); };
      const timer = window.setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, Math.min(1000 + attempt * 250, 5000));
      signal?.addEventListener("abort", abort, { once: true });
    });
  }
}

export type UsageGroup = { day: string; lesson_id: string; operation: string; model: string; calls: number; estimated_cost_usd: number; unknown_calls: number; retry_calls: number; tokens: number; cached_tokens: number; cache_write_tokens: number; latency_ms: number };
export type UsageSummary = { currency: string; pricing_version: string; estimated_cost_usd: number; unknown_calls: number; untracked_runs: number; groups: UsageGroup[] };
export function getUsageSummary() { return request<UsageSummary>("/api/v1/studio/usage"); }
