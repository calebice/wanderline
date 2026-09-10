import uuid
from typing import Annotated, Any, Literal

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.analysis import InvalidSketchError
from app.config import settings
from app.database import get_db
from app.dependencies import (
    get_exercise_service,
    get_image_decomposition_service,
    get_lesson_service,
    get_library_service,
    get_practice_session_service,
    get_progress_service,
    get_sketch_analysis_service,
    get_storage,
)
from app.lesson_schemas import (
    GenerationCreate,
    GenerationRunRead,
    LessonBriefUpdate,
    LessonCapabilities,
    LessonCreate,
    LessonRead,
    LessonSave,
    SectionGenerationCreate,
    StageGenerationCreate,
    TargetApprove,
    TargetGenerationCreate,
)
from app.lesson_service import (
    LessonConflictError,
    LessonNotFoundError,
    LessonService,
    LessonValidationError,
)
from app.models import LearnerProfile, LessonAsset, PaintingLesson, Sketch
from app.schemas import (
    AnalysisRead,
    ExerciseRead,
    ImageDecompositionRead,
    ImageRead,
    LibraryAttemptComplete,
    LibraryAttemptCreate,
    LibraryAttemptRead,
    LibraryExerciseRead,
    LibraryHistoryRead,
    PracticeCompletionRead,
    PracticeSessionComplete,
    PracticeSessionCreate,
    PracticeSessionRead,
    ProgressRead,
    SketchRead,
    SubjectPrediction,
)
from app.services import (
    CreatedDecomposition,
    ExerciseNotFoundError,
    ExerciseService,
    ImageDecompositionNotFoundError,
    ImageDecompositionService,
    InvalidLibrarySelfCheckError,
    LibraryAttemptAlreadyCompletedError,
    LibraryAttemptNotFoundError,
    LibraryService,
    PracticeSessionAlreadyCompletedError,
    PracticeSessionNotFoundError,
    PracticeSessionService,
    ProgressService,
    SketchAnalysisService,
    exercise_read,
    session_read,
)
from app.storage import S3ObjectStorage

app = FastAPI(title="Wanderline API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health/live", tags=["health"])
async def live() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready", tags=["health"])
async def ready(db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, str]:
    try:
        await db.execute(text("SELECT 1"))
    except Exception as error:
        raise HTTPException(status_code=503, detail="database unavailable") from error
    return {"status": "ready", "database": "ok"}


@app.get("/api/v1/exercises", response_model=list[ExerciseRead], tags=["exercises"])
async def list_exercises(
    service: Annotated[ExerciseService, Depends(get_exercise_service)],
) -> list[ExerciseRead]:
    exercises = await service.list_exercises()
    return [exercise_read(exercise) for exercise in exercises]


@app.get("/api/v1/exercises/{exercise_id}", response_model=ExerciseRead, tags=["exercises"])
async def get_exercise(
    exercise_id: str,
    service: Annotated[ExerciseService, Depends(get_exercise_service)],
) -> ExerciseRead:
    try:
        exercise = await service.get_exercise(exercise_id)
    except ExerciseNotFoundError as error:
        raise HTTPException(status_code=404, detail="exercise not found") from error
    return exercise_read(exercise)


@app.get("/api/v1/progress", response_model=ProgressRead, tags=["progress"])
async def get_progress(
    service: Annotated[ProgressService, Depends(get_progress_service)],
) -> ProgressRead:
    return await service.get_progress()


@app.get(
    "/api/v1/library/exercises",
    response_model=list[LibraryExerciseRead],
    tags=["library"],
)
async def list_library_exercises(
    service: Annotated[LibraryService, Depends(get_library_service)],
    track: str | None = None,
    difficulty: int | None = None,
) -> list[LibraryExerciseRead]:
    return await service.list_exercises(track, difficulty)


@app.get(
    "/api/v1/library/exercises/{exercise_slug}",
    response_model=LibraryExerciseRead,
    tags=["library"],
)
async def get_library_exercise(
    exercise_slug: str,
    service: Annotated[LibraryService, Depends(get_library_service)],
) -> LibraryExerciseRead:
    try:
        return await service.get_exercise(exercise_slug)
    except ExerciseNotFoundError as error:
        raise HTTPException(status_code=404, detail="library exercise not found") from error


@app.post(
    "/api/v1/library/attempts",
    response_model=LibraryAttemptRead,
    tags=["library"],
)
async def start_library_attempt(
    request: LibraryAttemptCreate,
    service: Annotated[LibraryService, Depends(get_library_service)],
) -> LibraryAttemptRead:
    try:
        return await service.start(request.exercise_slug)
    except ExerciseNotFoundError as error:
        raise HTTPException(status_code=404, detail="library exercise not found") from error


@app.get(
    "/api/v1/library/attempts/{attempt_id}",
    response_model=LibraryAttemptRead,
    tags=["library"],
)
async def get_library_attempt(
    attempt_id: uuid.UUID,
    service: Annotated[LibraryService, Depends(get_library_service)],
) -> LibraryAttemptRead:
    try:
        return await service.get_attempt(attempt_id)
    except LibraryAttemptNotFoundError as error:
        raise HTTPException(status_code=404, detail="library attempt not found") from error


@app.post(
    "/api/v1/library/attempts/{attempt_id}/complete",
    response_model=LibraryAttemptRead,
    tags=["library"],
)
async def complete_library_attempt(
    attempt_id: uuid.UUID,
    request: LibraryAttemptComplete,
    service: Annotated[LibraryService, Depends(get_library_service)],
) -> LibraryAttemptRead:
    try:
        return await service.complete(
            attempt_id,
            request.self_check_responses,
            request.difficulty_response,
            request.takeaway,
        )
    except LibraryAttemptNotFoundError as error:
        raise HTTPException(status_code=404, detail="library attempt not found") from error
    except InvalidLibrarySelfCheckError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except LibraryAttemptAlreadyCompletedError as error:
        raise HTTPException(status_code=409, detail="library attempt already completed") from error


@app.post(
    "/api/v1/library/attempts/{attempt_id}/digital-export",
    response_model=LibraryAttemptRead,
    tags=["library"],
)
async def record_library_digital_export(
    attempt_id: uuid.UUID,
    service: Annotated[LibraryService, Depends(get_library_service)],
) -> LibraryAttemptRead:
    try:
        return await service.record_digital_export(attempt_id)
    except LibraryAttemptNotFoundError as error:
        raise HTTPException(status_code=404, detail="library attempt not found") from error


@app.get(
    "/api/v1/library/history",
    response_model=LibraryHistoryRead,
    tags=["library"],
)
async def get_library_history(
    service: Annotated[LibraryService, Depends(get_library_service)],
) -> LibraryHistoryRead:
    return await service.history()


@app.post(
    "/api/v1/practice-sessions",
    response_model=PracticeSessionRead,
    status_code=status.HTTP_201_CREATED,
    tags=["practice-sessions"],
)
async def create_practice_session(
    request: PracticeSessionCreate,
    service: Annotated[PracticeSessionService, Depends(get_practice_session_service)],
) -> PracticeSessionRead:
    try:
        created = await service.create(request.exercise_id)
    except ExerciseNotFoundError as error:
        raise HTTPException(status_code=404, detail="exercise not found") from error
    return session_read(created.session, created.exercise_slug)


@app.get(
    "/api/v1/practice-sessions/{session_id}",
    response_model=PracticeSessionRead,
    tags=["practice-sessions"],
)
async def get_practice_session(
    session_id: uuid.UUID,
    service: Annotated[PracticeSessionService, Depends(get_practice_session_service)],
) -> PracticeSessionRead:
    try:
        created = await service.get(session_id)
    except PracticeSessionNotFoundError as error:
        raise HTTPException(status_code=404, detail="practice session not found") from error
    return session_read(created.session, created.exercise_slug)


@app.post(
    "/api/v1/practice-sessions/{session_id}/complete",
    response_model=PracticeCompletionRead,
    tags=["practice-sessions"],
)
async def complete_practice_session(
    session_id: uuid.UUID,
    request: PracticeSessionComplete,
    service: Annotated[PracticeSessionService, Depends(get_practice_session_service)],
) -> PracticeCompletionRead:
    try:
        return await service.complete(session_id, request.difficulty_response, request.takeaway)
    except PracticeSessionNotFoundError as error:
        raise HTTPException(status_code=404, detail="practice session not found") from error
    except PracticeSessionAlreadyCompletedError as error:
        raise HTTPException(status_code=409, detail="practice session already completed") from error


@app.post(
    "/api/v1/analyses",
    response_model=AnalysisRead,
    status_code=status.HTTP_201_CREATED,
    tags=["analyses"],
)
async def create_analysis(
    service: Annotated[SketchAnalysisService, Depends(get_sketch_analysis_service)],
    sketch: Annotated[UploadFile, File()],
    actual_subject: Annotated[str | None, Form(max_length=200)] = None,
) -> AnalysisRead:
    try:
        created = await service.create(sketch, actual_subject)
    except (InvalidSketchError, ValueError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    prediction_message = (
        "Subject recognition is not enabled in the local provider. "
        "Your description is stored as context for future semantic feedback."
    )
    return AnalysisRead(
        id=created.analysis.id,
        provider=created.analysis.provider,
        status=created.analysis.status,
        summary=created.analysis.summary,
        strengths=created.analysis.strengths,
        improvements=created.analysis.improvements,
        metrics=created.analysis.metrics,
        confidence=created.analysis.confidence,
        sketch=SketchRead(
            id=created.sketch.id,
            content_type=created.sketch.content_type,
            width=created.sketch.width,
            height=created.sketch.height,
            actual_subject=created.sketch.actual_subject,
            uploaded_at=created.sketch.uploaded_at,
        ),
        subject_prediction=SubjectPrediction(
            label=created.analysis.predicted_subject,
            confidence=created.analysis.prediction_confidence,
            message=prediction_message,
        ),
    )


def image_decomposition_read(created: CreatedDecomposition) -> ImageDecompositionRead:
    # Kept at the HTTP boundary so the persisted metrics payload remains provider-versioned.
    analysis = created.analysis
    image = created.image
    payload = analysis.metrics["decomposition"]
    return ImageDecompositionRead(
        id=analysis.id,
        status=analysis.status,
        provider=analysis.provider,
        algorithm_version=payload["algorithm_version"],
        summary=analysis.summary,
        confidence=analysis.confidence,
        image=ImageRead(
            id=image.id,
            content_type=image.content_type,
            width=image.width,
            height=image.height,
            uploaded_at=image.uploaded_at,
        ),
        shapes=payload["shapes"],
        construction_hints=payload["construction_hints"],
        levels=payload["levels"],
        drawing_steps=payload["drawing_steps"],
        warnings=payload["warnings"],
        limitations=payload["limitations"],
    )


@app.post(
    "/api/v1/image-decompositions",
    response_model=ImageDecompositionRead,
    status_code=status.HTTP_201_CREATED,
    tags=["image-decompositions"],
)
async def create_image_decomposition(
    service: Annotated[ImageDecompositionService, Depends(get_image_decomposition_service)],
    image: Annotated[UploadFile, File()],
) -> ImageDecompositionRead:
    try:
        created = await service.create(image)
    except (InvalidSketchError, ValueError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return image_decomposition_read(created)


@app.get(
    "/api/v1/image-decompositions/{decomposition_id}",
    response_model=ImageDecompositionRead,
    tags=["image-decompositions"],
)
async def get_image_decomposition(
    decomposition_id: uuid.UUID,
    service: Annotated[ImageDecompositionService, Depends(get_image_decomposition_service)],
) -> ImageDecompositionRead:
    try:
        created = await service.get(decomposition_id)
    except ImageDecompositionNotFoundError as error:
        raise HTTPException(status_code=404, detail="image decomposition not found") from error
    return image_decomposition_read(created)


@app.get("/api/v1/sketches/{sketch_id}/image", tags=["sketches"])
async def get_sketch_image(
    sketch_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    object_storage: Annotated[S3ObjectStorage, Depends(get_storage)],
) -> Response:
    sketch = await db.scalar(select(Sketch).where(Sketch.id == sketch_id))
    if sketch is None:
        raise HTTPException(status_code=404, detail="sketch not found")
    content = await run_in_threadpool(object_storage.get, sketch.object_key)
    return Response(
        content,
        media_type=sketch.content_type,
        headers={
            "Cache-Control": "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
        },
    )


@app.get("/api/v1/images/{image_id}", tags=["images"])
async def get_image(
    image_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    object_storage: Annotated[S3ObjectStorage, Depends(get_storage)],
) -> Response:
    return await get_sketch_image(image_id, db, object_storage)


@app.post(
    "/api/v1/painting-lessons",
    response_model=LessonRead,
    status_code=status.HTTP_201_CREATED,
    tags=["painting-lessons"],
)
async def create_painting_lesson(
    request: LessonCreate,
    service: Annotated[LessonService, Depends(get_lesson_service)],
) -> LessonRead:
    return await service.create(request)


@app.get("/api/v1/painting-lessons", response_model=list[LessonRead], tags=["painting-lessons"])
async def list_painting_lessons(
    service: Annotated[LessonService, Depends(get_lesson_service)],
    state: Literal["saved", "drafts", "all"] = "saved",
) -> list[LessonRead]:
    return await service.list_saved(state)


@app.get(
    "/api/v1/painting-lessons/capabilities",
    response_model=LessonCapabilities,
    tags=["painting-lessons"],
)
async def painting_lesson_capabilities(
    service: Annotated[LessonService, Depends(get_lesson_service)],
) -> LessonCapabilities:
    return LessonCapabilities(image_generation_available=bool(service.settings.openai_api_key))


@app.get(
    "/api/v1/painting-lessons/{lesson_id}", response_model=LessonRead, tags=["painting-lessons"]
)
async def get_painting_lesson(
    lesson_id: uuid.UUID,
    service: Annotated[LessonService, Depends(get_lesson_service)],
) -> LessonRead:
    try:
        return await service.get(lesson_id)
    except LessonNotFoundError as error:
        raise HTTPException(status_code=404, detail="lesson not found") from error


@app.patch(
    "/api/v1/painting-lessons/{lesson_id}/brief",
    response_model=LessonRead,
    tags=["painting-lessons"],
)
async def update_painting_lesson_brief(
    lesson_id: uuid.UUID,
    request: LessonBriefUpdate,
    service: Annotated[LessonService, Depends(get_lesson_service)],
) -> LessonRead:
    try:
        return await service.update_brief(lesson_id, request)
    except LessonNotFoundError as error:
        raise HTTPException(status_code=404, detail="lesson not found") from error
    except LessonValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post(
    "/api/v1/painting-lessons/{lesson_id}/references",
    response_model=LessonRead,
    tags=["painting-lessons"],
)
async def upload_lesson_references(
    lesson_id: uuid.UUID,
    service: Annotated[LessonService, Depends(get_lesson_service)],
    images: Annotated[list[UploadFile], File()],
) -> LessonRead:
    try:
        return await service.upload_references(lesson_id, images)
    except LessonNotFoundError as error:
        raise HTTPException(status_code=404, detail="lesson not found") from error
    except (LessonValidationError, InvalidSketchError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.patch(
    "/api/v1/painting-lessons/{lesson_id}/references/{asset_id}/primary",
    response_model=LessonRead,
    tags=["painting-lessons"],
)
async def choose_primary_reference(
    lesson_id: uuid.UUID,
    asset_id: uuid.UUID,
    service: Annotated[LessonService, Depends(get_lesson_service)],
) -> LessonRead:
    try:
        return await service.set_primary(lesson_id, asset_id)
    except LessonNotFoundError as error:
        raise HTTPException(status_code=404, detail="lesson not found") from error
    except LessonValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.delete(
    "/api/v1/painting-lessons/{lesson_id}/references/{asset_id}",
    response_model=LessonRead,
    tags=["painting-lessons"],
)
async def delete_lesson_reference(
    lesson_id: uuid.UUID,
    asset_id: uuid.UUID,
    service: Annotated[LessonService, Depends(get_lesson_service)],
) -> LessonRead:
    try:
        return await service.remove_reference(lesson_id, asset_id)
    except LessonNotFoundError as error:
        raise HTTPException(status_code=404, detail="lesson not found") from error
    except LessonValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post(
    "/api/v1/painting-lessons/{lesson_id}/target-generations",
    response_model=GenerationRunRead,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["painting-lessons"],
)
async def generate_lesson_target(
    lesson_id: uuid.UUID,
    request: TargetGenerationCreate,
    service: Annotated[LessonService, Depends(get_lesson_service)],
) -> GenerationRunRead:
    try:
        return await service.create_target_generation(
            lesson_id, request.adjustment, request.idempotency_key
        )
    except LessonNotFoundError as error:
        raise HTTPException(status_code=404, detail="lesson not found") from error
    except LessonValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post(
    "/api/v1/painting-lessons/{lesson_id}/target",
    response_model=LessonRead,
    tags=["painting-lessons"],
)
async def approve_lesson_target(
    lesson_id: uuid.UUID,
    request: TargetApprove,
    service: Annotated[LessonService, Depends(get_lesson_service)],
) -> LessonRead:
    try:
        return await service.approve_target(lesson_id, request.asset_id)
    except LessonNotFoundError as error:
        raise HTTPException(status_code=404, detail="lesson not found") from error
    except LessonValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post(
    "/api/v1/painting-lessons/{lesson_id}/generations",
    response_model=GenerationRunRead,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["painting-lessons"],
)
async def generate_painting_lesson(
    lesson_id: uuid.UUID,
    request: GenerationCreate,
    service: Annotated[LessonService, Depends(get_lesson_service)],
) -> GenerationRunRead:
    try:
        return await service.create_generation(
            lesson_id, request.include_study_image, idempotency_key=request.idempotency_key
        )
    except LessonNotFoundError as error:
        raise HTTPException(status_code=404, detail="lesson not found") from error
    except LessonValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post(
    "/api/v1/painting-lessons/{lesson_id}/stage-generations",
    response_model=GenerationRunRead,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["painting-lessons"],
)
async def regenerate_lesson_stages(
    lesson_id: uuid.UUID,
    request: StageGenerationCreate,
    service: Annotated[LessonService, Depends(get_lesson_service)],
) -> GenerationRunRead:
    try:
        return await service.create_stage_generation(
            lesson_id, request.start_stage_id, request.adjustment, request.idempotency_key
        )
    except LessonNotFoundError as error:
        raise HTTPException(status_code=404, detail="lesson not found") from error
    except LessonValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post(
    "/api/v1/painting-lessons/{lesson_id}/sections/{section_key}/generations",
    response_model=GenerationRunRead,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["painting-lessons"],
)
async def regenerate_lesson_section(
    lesson_id: uuid.UUID,
    section_key: str,
    request: SectionGenerationCreate,
    service: Annotated[LessonService, Depends(get_lesson_service)],
) -> GenerationRunRead:
    try:
        return await service.create_generation(
            lesson_id, False, section_key, request.current_content, request.idempotency_key
        )
    except LessonNotFoundError as error:
        raise HTTPException(status_code=404, detail="lesson not found") from error
    except LessonValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.get(
    "/api/v1/lesson-generations/{run_id}",
    response_model=GenerationRunRead,
    tags=["painting-lessons"],
)
async def get_lesson_generation(
    run_id: uuid.UUID,
    service: Annotated[LessonService, Depends(get_lesson_service)],
) -> GenerationRunRead:
    try:
        return await service.get_run(run_id)
    except LessonNotFoundError as error:
        raise HTTPException(status_code=404, detail="generation not found") from error


@app.post(
    "/api/v1/lesson-generations/{run_id}/retry",
    response_model=GenerationRunRead,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["painting-lessons"],
)
async def retry_lesson_generation(
    run_id: uuid.UUID,
    service: Annotated[LessonService, Depends(get_lesson_service)],
) -> GenerationRunRead:
    try:
        return await service.retry(run_id)
    except LessonNotFoundError as error:
        raise HTTPException(status_code=404, detail="generation not found") from error
    except LessonValidationError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@app.get(
    "/api/v1/painting-lessons/{lesson_id}/sections/{section_key}/latest-generated",
    response_model=GenerationRunRead,
    tags=["painting-lessons"],
)
async def latest_generated_section(
    lesson_id: uuid.UUID,
    section_key: str,
    service: Annotated[LessonService, Depends(get_lesson_service)],
) -> GenerationRunRead:
    try:
        return await service.latest_generated(lesson_id, section_key)
    except LessonNotFoundError as error:
        raise HTTPException(status_code=404, detail="generated section not found") from error


@app.put(
    "/api/v1/painting-lessons/{lesson_id}", response_model=LessonRead, tags=["painting-lessons"]
)
async def save_painting_lesson(
    lesson_id: uuid.UUID,
    request: LessonSave,
    service: Annotated[LessonService, Depends(get_lesson_service)],
) -> LessonRead:
    try:
        return await service.save(lesson_id, request)
    except LessonNotFoundError as error:
        raise HTTPException(status_code=404, detail="lesson not found") from error
    except LessonConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@app.get("/api/v1/lesson-assets/{asset_id}/image", tags=["painting-lessons"])
async def get_lesson_asset_image(
    asset_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    object_storage: Annotated[S3ObjectStorage, Depends(get_storage)],
) -> Response:
    asset = await db.scalar(
        select(LessonAsset)
        .join(PaintingLesson, PaintingLesson.id == LessonAsset.lesson_id)
        .join(LearnerProfile, LearnerProfile.id == PaintingLesson.learner_id)
        .where(LessonAsset.id == asset_id, LearnerProfile.slug == "local-learner")
    )
    if asset is None:
        raise HTTPException(status_code=404, detail="lesson asset not found")
    content = await run_in_threadpool(object_storage.get, asset.display_object_key)
    return Response(
        content,
        media_type=asset.display_content_type,
        headers={"Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff"},
    )


@app.get("/api/v1/studio/usage", tags=["studio"])
async def studio_usage(
    service: Annotated[LessonService, Depends(get_lesson_service)],
) -> dict[str, Any]:
    return await service.usage_summary()
