from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.repositories import (
    ExerciseRepository,
    LearnerProfileRepository,
    LibraryAttemptRepository,
    LibraryExerciseRepository,
    PracticeSessionRepository,
)
from app.services import (
    ExerciseService,
    ImageDecompositionService,
    LibraryService,
    PracticeSessionService,
    ProgressService,
    SketchAnalysisService,
)
from app.storage import S3ObjectStorage

storage = S3ObjectStorage(settings)


def get_storage() -> S3ObjectStorage:
    return storage


def get_exercise_service(db: Annotated[AsyncSession, Depends(get_db)]) -> ExerciseService:
    return ExerciseService(ExerciseRepository(db))


def get_practice_session_service(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PracticeSessionService:
    return PracticeSessionService(
        ExerciseRepository(db),
        PracticeSessionRepository(db),
        LearnerProfileRepository(db),
    )


def get_progress_service(db: Annotated[AsyncSession, Depends(get_db)]) -> ProgressService:
    return ProgressService(
        ExerciseRepository(db),
        PracticeSessionRepository(db),
        LearnerProfileRepository(db),
    )


def get_library_service(db: Annotated[AsyncSession, Depends(get_db)]) -> LibraryService:
    return LibraryService(
        LibraryExerciseRepository(db),
        LibraryAttemptRepository(db),
        LearnerProfileRepository(db),
    )


def get_sketch_analysis_service(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SketchAnalysisService:
    return SketchAnalysisService(settings, storage, db)


def get_image_decomposition_service(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ImageDecompositionService:
    return ImageDecompositionService(settings, storage, db)

