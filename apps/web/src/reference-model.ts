import type { LessonAsset, PaintingLesson } from "./lesson-model";

export type ReadyPaintingReference = {
  lesson: PaintingLesson;
  image: LessonAsset;
};

export function readyPaintingReferences(lessons: PaintingLesson[]): ReadyPaintingReference[] {
  return lessons
    .filter((lesson) => lesson.generation_status === "completed" && Boolean(lesson.content) && Boolean(lesson.approved_target_asset_id))
    .map((lesson) => ({
      lesson,
      image: lesson.assets.find((asset) => asset.id === lesson.approved_target_asset_id),
    }))
    .filter((reference): reference is ReadyPaintingReference => Boolean(reference.image))
    .sort((left, right) => Date.parse(right.lesson.updated_at) - Date.parse(left.lesson.updated_at));
}
