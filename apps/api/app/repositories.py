import uuid
from typing import cast

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Exercise,
    LearnerProfile,
    LibraryAttempt,
    LibraryExercise,
    PracticeSession,
)


class ExerciseRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list(self) -> list[Exercise]:
        result = await self.db.scalars(
            select(Exercise).where(Exercise.sequence_index > 0).order_by(Exercise.sequence_index)
        )
        return list(result)

    async def get_by_slug(self, slug: str) -> Exercise | None:
        return cast(
            Exercise | None, await self.db.scalar(select(Exercise).where(Exercise.slug == slug))
        )

    async def add(self, exercise: Exercise) -> None:
        self.db.add(exercise)


class PracticeSessionRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def add(self, practice_session: PracticeSession) -> None:
        self.db.add(practice_session)
        await self.db.flush()

    async def get(self, session_id: uuid.UUID) -> PracticeSession | None:
        return cast(
            PracticeSession | None,
            await self.db.scalar(select(PracticeSession).where(PracticeSession.id == session_id)),
        )

    async def list_for_learner(self, learner_id: uuid.UUID) -> list[PracticeSession]:
        result = await self.db.scalars(
            select(PracticeSession)
            .where(PracticeSession.learner_id == learner_id)
            .order_by(PracticeSession.started_at.desc())
        )
        return list(result)


class LearnerProfileRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_local(self) -> LearnerProfile:
        learner = await self.db.scalar(
            select(LearnerProfile).where(LearnerProfile.slug == "local-learner")
        )
        if learner is None:
            learner = LearnerProfile(slug="local-learner", display_name="Artist", weekly_target=3)
            self.db.add(learner)
            await self.db.flush()
        return learner


class LibraryExerciseRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list(
        self, track: str | None = None, difficulty: int | None = None
    ) -> list[LibraryExercise]:
        statement = select(LibraryExercise).order_by(LibraryExercise.sequence_index)
        if track:
            statement = statement.where(LibraryExercise.track == track)
        if difficulty:
            statement = statement.where(LibraryExercise.difficulty == difficulty)
        return list(await self.db.scalars(statement))

    async def get_by_slug(self, slug: str) -> LibraryExercise | None:
        return cast(
            LibraryExercise | None,
            await self.db.scalar(select(LibraryExercise).where(LibraryExercise.slug == slug)),
        )


class LibraryAttemptRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def add(self, attempt: LibraryAttempt) -> None:
        self.db.add(attempt)
        await self.db.flush()

    async def get(self, attempt_id: uuid.UUID) -> LibraryAttempt | None:
        return cast(
            LibraryAttempt | None,
            await self.db.scalar(select(LibraryAttempt).where(LibraryAttempt.id == attempt_id)),
        )

    async def get_active(
        self, learner_id: uuid.UUID, exercise_id: uuid.UUID
    ) -> LibraryAttempt | None:
        return cast(
            LibraryAttempt | None,
            await self.db.scalar(
                select(LibraryAttempt).where(
                    LibraryAttempt.learner_id == learner_id,
                    LibraryAttempt.exercise_id == exercise_id,
                    LibraryAttempt.status == "in_progress",
                )
            ),
        )

    async def list_for_learner(self, learner_id: uuid.UUID) -> list[LibraryAttempt]:
        return list(
            await self.db.scalars(
                select(LibraryAttempt)
                .where(LibraryAttempt.learner_id == learner_id)
                .order_by(LibraryAttempt.started_at.desc())
            )
        )

