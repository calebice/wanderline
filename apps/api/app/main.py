import uuid
from typing import Annotated, Any, Literal

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.color_mixing import router as color_mixing_router
from app.config import settings
from app.database import get_db
from app.dependencies import get_lesson_service, get_storage
from app.image_validation import InvalidImageError
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
from app.models import LearnerProfile, LessonAsset, PaintingLesson
from app.route_groups import studio_router
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


@studio_router.post(
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


@studio_router.get(
    "/api/v1/painting-lessons", response_model=list[LessonRead], tags=["painting-lessons"]
)
async def list_painting_lessons(
    service: Annotated[LessonService, Depends(get_lesson_service)],
    state: Literal["saved", "drafts", "all", "discarded"] = "saved",
) -> list[LessonRead]:
    return await service.list_saved(state)


@studio_router.get(
    "/api/v1/painting-lessons/capabilities",
    response_model=LessonCapabilities,
    tags=["painting-lessons"],
)
async def painting_lesson_capabilities(
    service: Annotated[LessonService, Depends(get_lesson_service)],
) -> LessonCapabilities:
    return LessonCapabilities(image_generation_available=bool(service.settings.openai_api_key))


@studio_router.get(
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


@studio_router.patch(
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


@studio_router.post(
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
    except (LessonValidationError, InvalidImageError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@studio_router.patch(
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


@studio_router.delete(
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


@studio_router.delete(
    "/api/v1/painting-lessons/{lesson_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["painting-lessons"],
)
async def discard_painting_lesson(
    lesson_id: uuid.UUID,
    service: Annotated[LessonService, Depends(get_lesson_service)],
) -> Response:
    try:
        await service.discard(lesson_id)
    except LessonNotFoundError as error:
        raise HTTPException(status_code=404, detail="lesson not found") from error
    except LessonValidationError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@studio_router.post(
    "/api/v1/painting-lessons/{lesson_id}/restore",
    response_model=LessonRead,
    tags=["painting-lessons"],
)
async def restore_painting_lesson(
    lesson_id: uuid.UUID,
    service: Annotated[LessonService, Depends(get_lesson_service)],
) -> LessonRead:
    try:
        return await service.restore(lesson_id)
    except LessonNotFoundError as error:
        raise HTTPException(status_code=404, detail="discarded lesson not found") from error


@studio_router.delete(
    "/api/v1/painting-lessons/{lesson_id}/permanent",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["painting-lessons"],
)
async def permanently_delete_painting_lesson(
    lesson_id: uuid.UUID,
    service: Annotated[LessonService, Depends(get_lesson_service)],
) -> Response:
    try:
        await service.purge(lesson_id)
    except LessonNotFoundError as error:
        raise HTTPException(status_code=404, detail="discarded lesson not found") from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@studio_router.post(
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


@studio_router.post(
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


@studio_router.post(
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


@studio_router.post(
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


@studio_router.post(
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


@studio_router.get(
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


@studio_router.post(
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


@studio_router.get(
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


@studio_router.put(
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


@studio_router.get("/api/v1/lesson-assets/{asset_id}/image", tags=["painting-lessons"])
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


@studio_router.get("/api/v1/studio/usage", tags=["studio"])
async def studio_usage(
    service: Annotated[LessonService, Depends(get_lesson_service)],
) -> dict[str, Any]:
    return await service.usage_summary()


app.include_router(studio_router)
app.include_router(color_mixing_router)
