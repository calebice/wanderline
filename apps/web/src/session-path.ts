import type { PaintingLesson } from "./lesson-model";

export function sessionPath(lesson: PaintingLesson) {
  if (lesson.latest_run_id && ["queued", "generating", "failed"].includes(lesson.generation_status)) {
    const next = lesson.latest_run_scope === "target" ? "target" : "review";
    return `/sessions/${lesson.id}/build/${lesson.latest_run_id}?next=${next}`;
  }
  if (lesson.content) return lesson.saved_at ? `/sessions/${lesson.id}` : `/sessions/${lesson.id}/edit`;
  if (lesson.assets.some((asset) => asset.role === "target_reference") || lesson.latest_run_scope === "target") {
    return `/sessions/${lesson.id}/target`;
  }
  return `/sessions/new?lesson=${lesson.id}`;
}
