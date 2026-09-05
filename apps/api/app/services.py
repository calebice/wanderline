import random
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.analysis import LocalCvAnalysisProvider, LocalShapeDecompositionProvider, validate_sketch
from app.config import Settings
from app.models import (
    Analysis,
    Exercise,
    LibraryAttempt,
    LibraryExercise,
    PracticeSession,
    Sketch,
)
from app.repositories import (
    ExerciseRepository,
    LearnerProfileRepository,
    LibraryAttemptRepository,
    LibraryExerciseRepository,
    PracticeSessionRepository,
)
from app.schemas import (
    ExerciseRead,
    LessonProgressRead,
    LibraryAttemptRead,
    LibraryExerciseRead,
    LibraryHistoryItem,
    LibraryHistoryRead,
    MilestoneRead,
    PracticeCompletionRead,
    PracticeSessionRead,
    ProgressRead,
    RecentReflectionRead,
)
from app.storage import S3ObjectStorage


class ExerciseNotFoundError(Exception):
    pass


class PracticeSessionNotFoundError(Exception):
    pass


class PracticeSessionAlreadyCompletedError(Exception):
    pass


class LibraryAttemptNotFoundError(Exception):
    pass


class LibraryAttemptAlreadyCompletedError(Exception):
    pass


class InvalidLibrarySelfCheckError(Exception):
    pass


class ImageDecompositionNotFoundError(Exception):
    pass


@dataclass
class CreatedPracticeSession:
    session: PracticeSession
    exercise_slug: str


class ExerciseService:
    def __init__(self, exercises: ExerciseRepository) -> None:
        self.exercises = exercises

    async def list_exercises(self) -> list[Exercise]:
        return await self.exercises.list()

    async def get_exercise(self, exercise_slug: str) -> Exercise:
        exercise = await self.exercises.get_by_slug(exercise_slug)
        if exercise is None:
            raise ExerciseNotFoundError(exercise_slug)
        return exercise


class PracticeSessionService:
    def __init__(
        self,
        exercises: ExerciseRepository,
        sessions: PracticeSessionRepository,
        learners: LearnerProfileRepository,
    ) -> None:
        self.exercises = exercises
        self.sessions = sessions
        self.learners = learners

    async def create(self, exercise_slug: str) -> CreatedPracticeSession:
        exercise = await self.exercises.get_by_slug(exercise_slug)
        if exercise is None:
            raise ExerciseNotFoundError(exercise_slug)
        learner = await self.learners.get_local()
        practice_session = PracticeSession(exercise_id=exercise.id, learner_id=learner.id)
        await self.sessions.add(practice_session)
        await self.sessions.db.commit()
        await self.sessions.db.refresh(practice_session)
        return CreatedPracticeSession(practice_session, exercise.slug)

    async def get(self, session_id: uuid.UUID) -> CreatedPracticeSession:
        session = await self.sessions.get(session_id)
        if session is None:
            raise PracticeSessionNotFoundError(str(session_id))
        exercise = next(
            (item for item in await self.exercises.list() if item.id == session.exercise_id),
            None,
        )
        if exercise is None:
            raise ExerciseNotFoundError(str(session.exercise_id))
        return CreatedPracticeSession(session, exercise.slug)

    async def complete(
        self,
        session_id: uuid.UUID,
        difficulty_response: str,
        takeaway: str | None,
    ) -> PracticeCompletionRead:
        created = await self.get(session_id)
        if created.session.status == "completed":
            raise PracticeSessionAlreadyCompletedError(str(session_id))
        created.session.status = "completed"
        created.session.difficulty_response = difficulty_response
        created.session.takeaway = takeaway.strip() if takeaway and takeaway.strip() else None
        created.session.completed_at = datetime.now(UTC)
        await self.sessions.db.commit()
        await self.sessions.db.refresh(created.session)
        progress = await ProgressService(
            self.exercises, self.sessions, self.learners
        ).get_progress()
        return PracticeCompletionRead(
            session=session_read(created.session, created.exercise_slug),
            progress=progress,
        )


MILESTONE_TITLES = {
    1: "Make confident marks",
    2: "Learn to see",
    3: "Build solid forms",
    4: "Bring a drawing together",
}


def exercise_read(exercise: Exercise) -> ExerciseRead:
    return ExerciseRead(
        id=exercise.slug,
        title=exercise.title,
        skill=exercise.skill,
        difficulty=exercise.difficulty,
        duration_minutes=exercise.duration_minutes,
        instructions=exercise.instructions,
        completion_requirements=exercise.completion_requirements,
        reference_mode=exercise.reference_mode,
        sequence_index=exercise.sequence_index,
        week_number=exercise.week_number,
        objective=exercise.objective,
        concept=exercise.concept,
        why_it_matters=exercise.why_it_matters,
        common_mistake=exercise.common_mistake,
        materials=exercise.materials,
        timed_phases=exercise.timed_phases,
        visual_kind=exercise.visual_kind,
        three_d_config=exercise.three_d_config,
        replay_variation=exercise.replay_variation,
    )


def session_read(session: PracticeSession, exercise_slug: str) -> PracticeSessionRead:
    return PracticeSessionRead(
        id=session.id,
        exercise_id=exercise_slug,
        status=session.status,
        difficulty_response=session.difficulty_response,
        takeaway=session.takeaway,
        started_at=session.started_at,
        completed_at=session.completed_at,
    )


def library_attempt_read(attempt: LibraryAttempt, exercise_slug: str) -> LibraryAttemptRead:
    return LibraryAttemptRead(
        id=attempt.id,
        exercise_slug=exercise_slug,
        status=attempt.status,
        variant_seed=attempt.variant_seed,
        variant_version=attempt.variant_version,
        variant_data=attempt.variant_data,
        self_check_responses=attempt.self_check_responses,
        difficulty_response=attempt.difficulty_response,
        takeaway=attempt.takeaway,
        practice_medium=attempt.practice_medium,
        last_overlay_exported_at=attempt.last_overlay_exported_at,
        started_at=attempt.started_at,
        completed_at=attempt.completed_at,
    )


class LibraryService:
    def __init__(
        self,
        exercises: LibraryExerciseRepository,
        attempts: LibraryAttemptRepository,
        learners: LearnerProfileRepository,
    ) -> None:
        self.exercises = exercises
        self.attempts = attempts
        self.learners = learners

    async def list_exercises(
        self, track: str | None = None, difficulty: int | None = None
    ) -> list[LibraryExerciseRead]:
        learner = await self.learners.get_local()
        attempts = await self.attempts.list_for_learner(learner.id)
        return [
            self._exercise_read(item, attempts)
            for item in await self.exercises.list(track, difficulty)
        ]

    async def get_exercise(self, slug: str) -> LibraryExerciseRead:
        exercise = await self._require_exercise(slug)
        learner = await self.learners.get_local()
        return self._exercise_read(exercise, await self.attempts.list_for_learner(learner.id))

    async def start(self, exercise_slug: str) -> LibraryAttemptRead:
        exercise = await self._require_exercise(exercise_slug)
        learner = await self.learners.get_local()
        active = await self.attempts.get_active(learner.id, exercise.id)
        if active:
            return library_attempt_read(active, exercise.slug)
        seed = secrets.randbelow(2_000_000_000)
        variant_data = self._generate_variant(exercise.visual_kind, seed)
        attempt = LibraryAttempt(
            learner_id=learner.id,
            exercise_id=exercise.id,
            variant_seed=seed,
            variant_version=str(exercise.variation_config.get("version", "library_v1")),
            variant_data=variant_data,
        )
        await self.attempts.add(attempt)
        await self.attempts.db.commit()
        await self.attempts.db.refresh(attempt)
        return library_attempt_read(attempt, exercise.slug)

    async def get_attempt(self, attempt_id: uuid.UUID) -> LibraryAttemptRead:
        attempt, exercise = await self._require_attempt(attempt_id)
        return library_attempt_read(attempt, exercise.slug)

    async def record_digital_export(self, attempt_id: uuid.UUID) -> LibraryAttemptRead:
        attempt, exercise = await self._require_attempt(attempt_id)
        attempt.practice_medium = "digital"
        attempt.last_overlay_exported_at = datetime.now(UTC)
        await self.attempts.db.commit()
        await self.attempts.db.refresh(attempt)
        return library_attempt_read(attempt, exercise.slug)

    async def complete(
        self,
        attempt_id: uuid.UUID,
        responses: dict[str, str],
        difficulty_response: str,
        takeaway: str | None,
    ) -> LibraryAttemptRead:
        attempt, exercise = await self._require_attempt(attempt_id)
        if attempt.status == "completed":
            raise LibraryAttemptAlreadyCompletedError(str(attempt_id))
        expected = {item["id"] for item in exercise.self_checks}
        if set(responses) != expected or any(
            value not in {"met", "needs_work"} for value in responses.values()
        ):
            raise InvalidLibrarySelfCheckError("answer every self-check with met or needs_work")
        attempt.status = "completed"
        attempt.self_check_responses = responses
        attempt.difficulty_response = difficulty_response
        attempt.takeaway = takeaway.strip() if takeaway and takeaway.strip() else None
        attempt.completed_at = datetime.now(UTC)
        await self.attempts.db.commit()
        await self.attempts.db.refresh(attempt)
        return library_attempt_read(attempt, exercise.slug)

    async def history(self) -> LibraryHistoryRead:
        learner = await self.learners.get_local()
        exercises = await self.exercises.list()
        attempts = await self.attempts.list_for_learner(learner.id)
        by_id = {exercise.id: exercise for exercise in exercises}
        recent = [
            library_attempt_read(item, by_id[item.exercise_id].slug)
            for item in attempts[:12]
            if item.exercise_id in by_id
        ]
        summaries = []
        for exercise in exercises:
            completed = [
                item
                for item in attempts
                if item.exercise_id == exercise.id and item.status == "completed"
            ]
            summaries.append(
                LibraryHistoryItem(
                    exercise_slug=exercise.slug,
                    title=exercise.title,
                    attempt_count=len(completed),
                    last_completed_at=max(
                        (item.completed_at for item in completed if item.completed_at), default=None
                    ),
                )
            )
        return LibraryHistoryRead(recent_attempts=recent, exercises=summaries)

    async def _require_exercise(self, slug: str) -> LibraryExercise:
        exercise = await self.exercises.get_by_slug(slug)
        if exercise is None:
            raise ExerciseNotFoundError(slug)
        return exercise

    async def _require_attempt(
        self, attempt_id: uuid.UUID
    ) -> tuple[LibraryAttempt, LibraryExercise]:
        attempt = await self.attempts.get(attempt_id)
        learner = await self.learners.get_local()
        if attempt is None or attempt.learner_id != learner.id:
            raise LibraryAttemptNotFoundError(str(attempt_id))
        exercises = await self.exercises.list()
        exercise = next((item for item in exercises if item.id == attempt.exercise_id), None)
        if exercise is None:
            raise ExerciseNotFoundError(str(attempt.exercise_id))
        return attempt, exercise

    @staticmethod
    def _exercise_read(
        exercise: LibraryExercise, attempts: list[LibraryAttempt]
    ) -> LibraryExerciseRead:
        related = [item for item in attempts if item.exercise_id == exercise.id]
        completed = [item for item in related if item.status == "completed"]
        active = next((item for item in related if item.status == "in_progress"), None)
        return LibraryExerciseRead(
            id=exercise.slug,
            title=exercise.title,
            track=exercise.track,
            difficulty=exercise.difficulty,
            duration_minutes=exercise.duration_minutes,
            objective=exercise.objective,
            concept=exercise.concept,
            common_mistake=exercise.common_mistake,
            materials=exercise.materials,
            instructions=exercise.instructions,
            timed_phases=exercise.timed_phases,
            visual_kind=exercise.visual_kind,
            visual_config=exercise.visual_config,
            self_checks=exercise.self_checks,
            sequence_index=exercise.sequence_index,
            attempt_count=len(completed),
            active_attempt_id=active.id if active else None,
            last_completed_at=max(
                (item.completed_at for item in completed if item.completed_at), default=None
            ),
        )

    @staticmethod
    def _generate_variant(kind: str, seed: int) -> dict[str, object]:
        rng = random.Random(seed)
        base: dict[str, object] = {"kind": kind}
        if kind == "one-point":
            base.update(
                horizon_y=rng.choice([0.38, 0.5, 0.62]),
                vanishing_x=round(rng.uniform(0.32, 0.68), 2),
                box_count=rng.choice([4, 5]),
            )
        elif kind == "two-point":
            base.update(
                horizon_y=rng.choice([0.38, 0.5, 0.62]),
                left_vp=rng.choice([-0.28, -0.18]),
                right_vp=rng.choice([1.18, 1.28]),
                box_level=rng.choice(["above", "mixed", "below"]),
            )
        elif kind == "rotating":
            base.update(
                primitive=rng.choice(["box", "cylinder", "cone"]),
                elevation=rng.choice([-18, 0, 18]),
                rotations=[-35, 0, 35],
            )
        elif kind in {"draw-through", "cross-contour"}:
            base.update(
                primitive=rng.choice(["box", "cylinder", "cone", "sphere"]),
                rotation=rng.choice([-28, -14, 14, 28]),
            )
        elif kind == "object":
            base.update(
                object_template=rng.choice(["mug", "bottle", "stool"]),
                rotation=rng.choice([-22, 0, 22]),
            )
        elif kind == "hatch-ladder":
            base.update(hatch_angle=rng.choice([30, 45, 60]), steps=5)
        elif kind == "hatch-form":
            base.update(
                primitive=rng.choice(["sphere", "cylinder"]),
                hatch_angle=rng.choice([30, 45, 60]),
                light_side=rng.choice(["left", "right"]),
            )
        elif kind == "light-logic":
            base.update(
                primitive=rng.choice(["sphere", "box", "cylinder"]),
                light_direction=rng.choice(
                    ["upper-left", "upper-right", "side-left", "side-right"]
                ),
            )
        elif kind in {"head-construction", "facial-proportions", "facial-turn"}:
            base.update(
                head_turn=rng.choice([-28, -16, 0, 16, 28]),
                head_tilt=rng.choice([-8, 0, 8]),
                face_shape=rng.choice(["oval", "angular", "round"]),
            )
        elif kind == "creature-gesture":
            base.update(
                subject=rng.choice(["human", "dog", "cat"]),
                pose=rng.choice(["reach", "walk", "crouch"]),
                direction=rng.choice([-1, 1]),
            )
        elif kind == "human-mannequin":
            base.update(
                pose=rng.choice(["contrapposto", "stride", "reach"]),
                direction=rng.choice([-1, 1]),
                shoulder_tilt=rng.choice([-10, -6, 6, 10]),
            )
        elif kind == "quadruped-masses":
            base.update(
                species=rng.choice(["dog", "cat"]),
                pose=rng.choice(["stand", "walk", "crouch"]),
                direction=rng.choice([-1, 1]),
            )
        elif kind == "animal-legs":
            base.update(
                comparison=rng.choice(["front", "hind"]), weight=rng.choice(["loaded", "moving"])
            )
        elif kind == "dog-head":
            base.update(
                head_turn=rng.choice([-24, 0, 24]),
                muzzle=rng.choice(["short", "medium", "long"]),
                ears=rng.choice(["upright", "drop", "half-prick"]),
            )
        elif kind == "cat-head":
            base.update(
                head_turn=rng.choice([-24, 0, 24]),
                ear_attention=rng.choice(["forward", "alert", "sideways"]),
                face_shape=rng.choice(["round", "wedge"]),
            )
        elif kind == "animal-paws":
            base.update(
                species=rng.choice(["dog", "cat"]),
                view=rng.choice(["front", "side", "three-quarter"]),
                weight=rng.choice(["resting", "loaded"]),
            )
        elif kind == "creature-synthesis":
            base.update(
                body_plan=rng.choice(["runner", "climber", "burrower"]),
                inspiration=rng.choice(["dog", "cat", "human"]),
                adaptation=rng.choice(
                    ["long forelimbs", "springing hind legs", "broad digging paws"]
                ),
            )
        return base


class ProgressService:
    def __init__(
        self,
        exercises: ExerciseRepository,
        sessions: PracticeSessionRepository,
        learners: LearnerProfileRepository,
    ) -> None:
        self.exercises = exercises
        self.sessions = sessions
        self.learners = learners

    async def get_progress(self) -> ProgressRead:
        learner = await self.learners.get_local()
        exercises = await self.exercises.list()
        sessions = await self.sessions.list_for_learner(learner.id)
        exercise_by_id = {exercise.id: exercise for exercise in exercises}
        completed = [
            session
            for session in sessions
            if session.status == "completed" and session.exercise_id in exercise_by_id
        ]
        completed_by_exercise: dict[uuid.UUID, list[PracticeSession]] = {}
        for session in completed:
            completed_by_exercise.setdefault(session.exercise_id, []).append(session)

        lesson_progress = [
            LessonProgressRead(
                exercise=exercise_read(exercise),
                status="completed"
                if exercise.id in completed_by_exercise
                else (
                    "in_progress"
                    if any(
                        session.exercise_id == exercise.id and session.status == "in_progress"
                        for session in sessions
                    )
                    else "not_started"
                ),
                active_session_id=next(
                    (
                        session.id
                        for session in sessions
                        if session.exercise_id == exercise.id and session.status == "in_progress"
                    ),
                    None,
                ),
                completed_sessions=len(completed_by_exercise.get(exercise.id, [])),
                last_completed_at=max(
                    (
                        session.completed_at
                        for session in completed_by_exercise.get(exercise.id, [])
                        if session.completed_at is not None
                    ),
                    default=None,
                ),
            )
            for exercise in exercises
        ]
        recommended = next(
            (exercise for exercise in exercises if exercise.id not in completed_by_exercise),
            exercises[-1],
        )

        now = datetime.now(UTC)
        week_start = (now - timedelta(days=now.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        weekly_completed = sum(
            1
            for session in completed
            if session.completed_at is not None and self._as_utc(session.completed_at) >= week_start
        )

        milestones: list[MilestoneRead] = []
        current_milestone = "Path complete"
        for week_number, title in MILESTONE_TITLES.items():
            week_exercises = [item for item in exercises if item.week_number == week_number]
            week_completed = sum(1 for item in week_exercises if item.id in completed_by_exercise)
            status = (
                "completed"
                if week_completed == len(week_exercises)
                else "current"
                if current_milestone == "Path complete"
                else "upcoming"
            )
            if status == "current":
                current_milestone = f"Week {week_number} · {title}"
            milestones.append(
                MilestoneRead(
                    week_number=week_number,
                    title=title,
                    completed_lessons=week_completed,
                    total_lessons=len(week_exercises),
                    status=status,
                )
            )

        reflections = []
        for session in completed:
            exercise = exercise_by_id.get(session.exercise_id)
            if (
                exercise is None
                or session.completed_at is None
                or session.difficulty_response is None
            ):
                continue
            reflections.append(
                RecentReflectionRead(
                    session_id=session.id,
                    exercise_id=exercise.slug,
                    exercise_title=exercise.title,
                    difficulty_response=session.difficulty_response,
                    takeaway=session.takeaway,
                    completed_at=session.completed_at,
                )
            )
            if len(reflections) == 5:
                break

        await self.sessions.db.commit()
        return ProgressRead(
            learner_name=learner.display_name,
            weekly_target=learner.weekly_target,
            weekly_completed=weekly_completed,
            total_completed_lessons=len(completed_by_exercise),
            total_lessons=len(exercises),
            recommended_exercise_id=recommended.slug,
            current_milestone=current_milestone,
            lessons=lesson_progress,
            milestones=milestones,
            recent_reflections=reflections,
        )

    @staticmethod
    def _as_utc(value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


@dataclass
class CreatedAnalysis:
    analysis: Analysis
    sketch: Sketch


@dataclass
class CreatedDecomposition:
    analysis: Analysis
    image: Sketch


class SketchAnalysisService:
    def __init__(self, settings: Settings, storage: S3ObjectStorage, db: AsyncSession) -> None:
        self.settings = settings
        self.storage = storage
        self.db = db
        self.provider = LocalCvAnalysisProvider()

    async def create(self, upload: UploadFile, actual_subject: str | None) -> CreatedAnalysis:
        content = await upload.read(self.settings.max_upload_bytes + 1)
        if len(content) > self.settings.max_upload_bytes:
            raise ValueError("The image exceeds the configured upload limit.")
        claimed_type = upload.content_type or ""
        validated = await run_in_threadpool(
            validate_sketch, content, claimed_type, self.settings.max_image_pixels
        )
        normalized_subject = actual_subject.strip()[:200] if actual_subject else None
        result = await run_in_threadpool(
            self.provider.analyze,
            validated,
            normalized_subject or None,
        )
        extension = "jpg" if validated.content_type == "image/jpeg" else "png"
        object_key = f"sketches/{uuid.uuid4()}.{extension}"
        await run_in_threadpool(
            self.storage.put, object_key, validated.content, validated.content_type
        )
        sketch_id = uuid.uuid4()
        sketch = Sketch(
            id=sketch_id,
            object_key=object_key,
            content_type=validated.content_type,
            width=validated.width,
            height=validated.height,
            actual_subject=normalized_subject or None,
            purpose="sketch_critique",
        )
        analysis = Analysis(
            sketch_id=sketch_id,
            provider=self.provider.name,
            status="completed",
            analysis_kind="sketch_critique",
            summary=result.summary,
            strengths=result.strengths,
            improvements=result.improvements,
            metrics=result.metrics,
            predicted_subject=None,
            prediction_confidence=0.0,
            confidence=result.confidence,
        )
        self.db.add(sketch)
        await self.db.flush()
        self.db.add(analysis)
        await self.db.commit()
        await self.db.refresh(sketch)
        await self.db.refresh(analysis)
        return CreatedAnalysis(analysis, sketch)


class ImageDecompositionService:
    def __init__(self, settings: Settings, storage: S3ObjectStorage, db: AsyncSession) -> None:
        self.settings = settings
        self.storage = storage
        self.db = db
        self.provider = LocalShapeDecompositionProvider()

    async def create(self, upload: UploadFile) -> CreatedDecomposition:
        content = await upload.read(self.settings.max_upload_bytes + 1)
        if len(content) > self.settings.max_upload_bytes:
            raise ValueError("The image exceeds the configured upload limit.")
        validated = await run_in_threadpool(
            validate_sketch,
            content,
            upload.content_type or "",
            self.settings.max_image_pixels,
        )
        result = await run_in_threadpool(self.provider.analyze, validated)
        extension = "jpg" if validated.content_type == "image/jpeg" else "png"
        object_key = f"images/{uuid.uuid4()}.{extension}"
        await run_in_threadpool(
            self.storage.put,
            object_key,
            validated.content,
            validated.content_type,
        )
        image_id = uuid.uuid4()
        image = Sketch(
            id=image_id,
            object_key=object_key,
            content_type=validated.content_type,
            width=validated.width,
            height=validated.height,
            actual_subject=None,
            purpose="image_decomposition",
        )
        decomposition = result.decomposition
        analysis = Analysis(
            sketch_id=image_id,
            provider=self.provider.name,
            status="completed",
            analysis_kind="image_decomposition",
            summary=result.summary,
            strengths=[],
            improvements=list(decomposition["warnings"]),
            metrics={"decomposition": decomposition},
            predicted_subject=None,
            prediction_confidence=0.0,
            confidence=result.confidence,
        )
        self.db.add(image)
        await self.db.flush()
        self.db.add(analysis)
        await self.db.commit()
        await self.db.refresh(image)
        await self.db.refresh(analysis)
        return CreatedDecomposition(analysis=analysis, image=image)

    async def get(self, decomposition_id: uuid.UUID) -> CreatedDecomposition:
        analysis = await self.db.scalar(
            select(Analysis).where(
                Analysis.id == decomposition_id,
                Analysis.analysis_kind == "image_decomposition",
            )
        )
        if analysis is None:
            raise ImageDecompositionNotFoundError(str(decomposition_id))
        image = await self.db.scalar(select(Sketch).where(Sketch.id == analysis.sketch_id))
        if image is None:
            raise ImageDecompositionNotFoundError(str(decomposition_id))
        return CreatedDecomposition(analysis=analysis, image=image)
