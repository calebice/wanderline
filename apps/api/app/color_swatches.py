import logging
import uuid
from datetime import date, datetime
from typing import Annotated, Literal, cast

from botocore.exceptions import ClientError  # type: ignore[import-untyped]
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.color_mixing import CATALOG, ensure_catalog
from app.config import settings
from app.database import get_db
from app.dependencies import get_storage
from app.image_validation import InvalidImageError, validate_image
from app.lesson_service import detected_source_type, make_display_image
from app.models import ColorSwatch, ColorSwatchAsset, utc_now
from app.repositories import LearnerProfileRepository
from app.storage import S3ObjectStorage

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/color-mixing", tags=["color-mixing"])


class SwatchIngredient(BaseModel):
    paint: str = Field(min_length=1, max_length=120)
    parts: float = Field(gt=0, le=1000)


class SwatchPaper(BaseModel):
    brand: str = Field(min_length=1, max_length=120)
    product: str = Field(min_length=1, max_length=160)
    weight_texture: str = Field(default="", max_length=200)


class SwatchCapture(BaseModel):
    card_brand: str = Field(min_length=1, max_length=120)
    card_model: str = Field(min_length=1, max_length=160)
    lighting: Literal["indirect_daylight", "neutral_artificial", "other"]
    other_lighting: str = Field(default="", max_length=300)
    card_visible: Literal[True]


class SwatchAppearance(BaseModel):
    value: Literal["light", "mid", "dark"]
    temperature: Literal["warm", "neutral", "cool"]
    chroma: Literal["muted", "moderate", "vivid"]


class SwatchTraits(BaseModel):
    transparency: Literal["", "transparent", "semi_transparent", "opaque"] = ""
    granulation: Literal["", "none", "some", "strong"] = ""
    lifting: Literal["", "lifts_easily", "lifts_some", "staining"] = ""
    water_notes: str = Field(default="", max_length=1000)
    drying_notes: str = Field(default="", max_length=1000)


class SwatchComparison(BaseModel):
    value: Literal["lighter", "same", "darker"]
    temperature: Literal["cooler", "same", "warmer"]
    chroma: Literal["duller", "same", "brighter"]
    close: bool


class SwatchEditable(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    ingredients: list[SwatchIngredient] = Field(min_length=1, max_length=3)
    paper: SwatchPaper
    capture: SwatchCapture
    appearance: SwatchAppearance
    traits: SwatchTraits = Field(default_factory=SwatchTraits)
    comparison: SwatchComparison | None = None
    notes: str = Field(default="", max_length=4000)
    tested_on: date


class SwatchCreateMetadata(SwatchEditable):
    source_type: Literal["single_paint", "catalog_mix", "custom_mix"]
    palette_id: str = Field(min_length=1, max_length=80)
    catalog_version: int = Field(ge=1)
    recipe_id: str | None = Field(default=None, max_length=100)


class SwatchUpdate(SwatchEditable):
    expected_revision: int = Field(ge=1)


class SwatchRead(BaseModel):
    id: uuid.UUID
    schema_version: str
    source_type: str
    palette_id: str
    catalog_version: int
    family: str | None
    name: str
    source_snapshot: dict[str, object]
    ingredients: list[SwatchIngredient]
    paper: SwatchPaper
    capture: SwatchCapture
    appearance: SwatchAppearance
    traits: SwatchTraits
    comparison: SwatchComparison | None
    notes: str
    tested_on: date
    image_url: str
    image_width: int
    image_height: int
    revision: int
    created_at: datetime
    updated_at: datetime


def _observations(editable: SwatchEditable) -> dict[str, object]:
    return {
        "appearance": editable.appearance.model_dump(mode="json"),
        "traits": editable.traits.model_dump(mode="json"),
        "comparison": editable.comparison.model_dump(mode="json") if editable.comparison else None,
    }


def _read(swatch: ColorSwatch, asset: ColorSwatchAsset) -> SwatchRead:
    observations = swatch.observations
    return SwatchRead(
        id=swatch.id,
        schema_version=swatch.schema_version,
        source_type=swatch.source_type,
        palette_id=swatch.palette_id,
        catalog_version=swatch.catalog_version,
        family=swatch.family,
        name=swatch.name,
        source_snapshot=swatch.source_snapshot,
        ingredients=[SwatchIngredient.model_validate(item) for item in swatch.ingredients],
        paper=SwatchPaper.model_validate(swatch.paper),
        capture=SwatchCapture.model_validate(swatch.capture),
        appearance=SwatchAppearance.model_validate(observations["appearance"]),
        traits=SwatchTraits.model_validate(observations.get("traits") or {}),
        comparison=SwatchComparison.model_validate(observations["comparison"])
        if observations.get("comparison")
        else None,
        notes=swatch.notes,
        tested_on=swatch.tested_on,
        image_url=f"/api/v1/color-mixing/swatches/{swatch.id}/image",
        image_width=asset.width,
        image_height=asset.height,
        revision=swatch.revision,
        created_at=swatch.created_at,
        updated_at=swatch.updated_at,
    )


def _validate_editable(
    editable: SwatchEditable,
    source_type: str,
    source_snapshot: dict[str, object],
) -> list[dict[str, object]]:
    paint_names = {paint.name for paint in CATALOG.palette.paints}
    names = [ingredient.paint for ingredient in editable.ingredients]
    if len(names) != len(set(names)):
        raise HTTPException(status_code=422, detail="Use each paint only once in a swatch.")
    if any(name not in paint_names for name in names):
        raise HTTPException(status_code=422, detail="Choose paints from the current palette.")
    if editable.capture.lighting == "other" and not editable.capture.other_lighting.strip():
        raise HTTPException(status_code=422, detail="Describe the other lighting condition.")
    if source_type == "single_paint":
        if len(names) != 1:
            raise HTTPException(
                status_code=422, detail="A single-paint swatch uses exactly one paint."
            )
        source_paint = cast(dict[str, object], source_snapshot.get("paint", {}))
        if names[0] != source_paint.get("name"):
            raise HTTPException(
                status_code=422,
                detail="A single-paint swatch keeps its original palette source.",
            )
        if editable.comparison is None:
            raise HTTPException(
                status_code=422, detail="Compare this swatch with its screen target."
            )
        return [{"paint": names[0], "parts": 1.0}]
    if source_type == "catalog_mix":
        recipe_ingredients = cast(list[dict[str, object]], source_snapshot.get("ingredients", []))
        expected = {str(item["paint"]) for item in recipe_ingredients}
        if set(names) != expected:
            raise HTTPException(
                status_code=422,
                detail="Use the authored recipe paints when recording this mix.",
            )
        if editable.comparison is None:
            raise HTTPException(
                status_code=422, detail="Compare this swatch with its screen target."
            )
    elif source_type == "custom_mix":
        if not 2 <= len(names) <= 3:
            raise HTTPException(status_code=422, detail="A custom mix uses two or three paints.")
        if editable.comparison is not None:
            raise HTTPException(status_code=422, detail="A custom mix has no authored target.")
    return [ingredient.model_dump(mode="json") for ingredient in editable.ingredients]


async def _local_swatch(
    swatch_id: uuid.UUID, db: AsyncSession
) -> tuple[ColorSwatch, ColorSwatchAsset]:
    learner = await LearnerProfileRepository(db).get_local()
    swatch = await db.scalar(
        select(ColorSwatch).where(
            ColorSwatch.id == swatch_id,
            ColorSwatch.learner_id == learner.id,
        )
    )
    if swatch is None:
        raise HTTPException(status_code=404, detail="color swatch not found")
    asset = await db.scalar(select(ColorSwatchAsset).where(ColorSwatchAsset.swatch_id == swatch.id))
    if asset is None:
        raise HTTPException(status_code=404, detail="color swatch image not found")
    return swatch, asset


async def _image_parts(upload: UploadFile) -> tuple[bytes, bytes, str, int, int, str]:
    raw = await upload.read(settings.max_upload_bytes + 1)
    if len(raw) > settings.max_upload_bytes:
        raise HTTPException(status_code=422, detail="The image exceeds the configured 15 MB limit.")
    try:
        validated = await run_in_threadpool(
            validate_image, raw, upload.content_type or "", settings.max_image_pixels
        )
    except InvalidImageError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    display, width, height = await run_in_threadpool(
        make_display_image, validated.rgb, settings.lesson_display_max_edge
    )
    original_type = await run_in_threadpool(detected_source_type, raw)
    return raw, display, original_type, width, height, (upload.filename or "color swatch")[:255]


async def _remove_objects(
    storage: S3ObjectStorage, keys: tuple[str, str], swatch_id: uuid.UUID
) -> None:
    for key in keys:
        try:
            await run_in_threadpool(storage.delete, key)
        except (ClientError, OSError):
            logger.warning(
                "color swatch object cleanup failed", extra={"swatch_id": str(swatch_id)}
            )


@router.get("/swatches", response_model=list[SwatchRead])
async def list_swatches(
    db: Annotated[AsyncSession, Depends(get_db)],
    source_type: Literal["single_paint", "catalog_mix", "custom_mix"] | None = None,
    family: str | None = None,
    ingredient: str | None = None,
) -> list[SwatchRead]:
    learner = await LearnerProfileRepository(db).get_local()
    rows = list(
        await db.scalars(
            select(ColorSwatch)
            .where(ColorSwatch.learner_id == learner.id)
            .order_by(ColorSwatch.created_at.desc())
        )
    )
    if source_type:
        rows = [row for row in rows if row.source_type == source_type]
    if family:
        rows = [row for row in rows if row.family == family]
    if ingredient:
        rows = [
            row for row in rows if ingredient in {str(item["paint"]) for item in row.ingredients}
        ]
    assets = (
        list(
            await db.scalars(
                select(ColorSwatchAsset).where(
                    ColorSwatchAsset.swatch_id.in_([row.id for row in rows])
                )
            )
        )
        if rows
        else []
    )
    by_swatch = {asset.swatch_id: asset for asset in assets}
    return [_read(row, by_swatch[row.id]) for row in rows if row.id in by_swatch]


@router.post("/swatches", response_model=SwatchRead, status_code=status.HTTP_201_CREATED)
async def create_swatch(
    metadata: Annotated[str, Form()],
    image: Annotated[UploadFile, File()],
    db: Annotated[AsyncSession, Depends(get_db)],
    storage: Annotated[S3ObjectStorage, Depends(get_storage)],
) -> SwatchRead:
    try:
        request = SwatchCreateMetadata.model_validate_json(metadata)
    except ValidationError as error:
        raise HTTPException(status_code=422, detail=error.errors()) from error
    if request.palette_id != CATALOG.palette.id or request.catalog_version != CATALOG.version:
        raise HTTPException(
            status_code=422, detail="The requested palette version is not available."
        )
    recipes = await ensure_catalog(db)
    source_recipe = None
    if request.source_type == "catalog_mix":
        source_recipe = recipes.get(request.recipe_id or "")
        if source_recipe is None:
            raise HTTPException(status_code=404, detail="color-mixing recipe not found")
        source_snapshot = source_recipe.payload
        family = source_recipe.family
    elif request.recipe_id:
        raise HTTPException(status_code=422, detail="Only authored mixes use a recipe identifier.")
    elif request.source_type == "single_paint":
        paint = next(
            (
                paint
                for paint in CATALOG.palette.paints
                if paint.name == request.ingredients[0].paint
            ),
            None,
        )
        if paint is None:
            raise HTTPException(status_code=422, detail="Choose a paint from the current palette.")
        source_snapshot = {
            "type": "single_paint",
            "palette_id": CATALOG.palette.id,
            "catalog_version": CATALOG.version,
            "paint": paint.model_dump(mode="json"),
        }
        family = None
    else:
        source_snapshot = {
            "type": "custom_mix",
            "palette_id": CATALOG.palette.id,
            "catalog_version": CATALOG.version,
        }
        family = None
    ingredients = _validate_editable(request, request.source_type, source_snapshot)
    raw, display, original_type, width, height, filename = await _image_parts(image)
    learner = await LearnerProfileRepository(db).get_local()
    swatch_id, asset_id = uuid.uuid4(), uuid.uuid4()
    original_key = f"color-swatches/{swatch_id}/{asset_id}/original"
    display_key = f"color-swatches/{swatch_id}/{asset_id}/display.webp"
    stored: list[str] = []
    try:
        await run_in_threadpool(storage.put, original_key, raw, original_type)
        stored.append(original_key)
        await run_in_threadpool(storage.put, display_key, display, "image/webp")
        stored.append(display_key)
        swatch = ColorSwatch(
            id=swatch_id,
            learner_id=learner.id,
            source_type=request.source_type,
            palette_id=request.palette_id,
            catalog_version=request.catalog_version,
            source_recipe_id=source_recipe.id if source_recipe else None,
            family=family,
            name=request.name,
            source_snapshot=source_snapshot,
            ingredients=ingredients,
            paper=request.paper.model_dump(mode="json"),
            capture=request.capture.model_dump(mode="json"),
            observations=_observations(request),
            notes=request.notes,
            tested_on=request.tested_on,
        )
        asset = ColorSwatchAsset(
            id=asset_id,
            swatch_id=swatch_id,
            original_object_key=original_key,
            display_object_key=display_key,
            original_content_type=original_type,
            display_content_type="image/webp",
            width=width,
            height=height,
            filename=filename,
            alt_text=f"Physical watercolor swatch: {request.name}",
        )
        db.add_all([swatch, asset])
        await db.commit()
        await db.refresh(swatch)
        return _read(swatch, asset)
    except Exception:
        await db.rollback()
        await _remove_objects(storage, (original_key, display_key), swatch_id)
        raise


@router.get("/swatches/{swatch_id}", response_model=SwatchRead)
async def get_swatch(
    swatch_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SwatchRead:
    swatch, asset = await _local_swatch(swatch_id, db)
    return _read(swatch, asset)


@router.put("/swatches/{swatch_id}", response_model=SwatchRead)
async def update_swatch(
    swatch_id: uuid.UUID,
    request: SwatchUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SwatchRead:
    swatch, asset = await _local_swatch(swatch_id, db)
    if swatch.revision != request.expected_revision:
        raise HTTPException(status_code=409, detail="Color swatch changed; reload and try again.")
    ingredients = _validate_editable(request, swatch.source_type, swatch.source_snapshot)
    swatch.name = request.name
    swatch.ingredients = ingredients
    swatch.paper = request.paper.model_dump(mode="json")
    swatch.capture = request.capture.model_dump(mode="json")
    swatch.observations = _observations(request)
    swatch.notes = request.notes
    swatch.tested_on = request.tested_on
    swatch.revision += 1
    swatch.updated_at = utc_now()
    asset.alt_text = f"Physical watercolor swatch: {request.name}"
    await db.commit()
    await db.refresh(swatch)
    return _read(swatch, asset)


@router.put("/swatches/{swatch_id}/image", response_model=SwatchRead)
async def replace_swatch_image(
    swatch_id: uuid.UUID,
    expected_revision: Annotated[int, Form(ge=1)],
    image: Annotated[UploadFile, File()],
    db: Annotated[AsyncSession, Depends(get_db)],
    storage: Annotated[S3ObjectStorage, Depends(get_storage)],
) -> SwatchRead:
    swatch, asset = await _local_swatch(swatch_id, db)
    if swatch.revision != expected_revision:
        raise HTTPException(status_code=409, detail="Color swatch changed; reload and try again.")
    raw, display, original_type, width, height, filename = await _image_parts(image)
    version_id = uuid.uuid4()
    original_key = f"color-swatches/{swatch.id}/{version_id}/original"
    display_key = f"color-swatches/{swatch.id}/{version_id}/display.webp"
    old_keys = (asset.original_object_key, asset.display_object_key)
    try:
        await run_in_threadpool(storage.put, original_key, raw, original_type)
        await run_in_threadpool(storage.put, display_key, display, "image/webp")
        asset.original_object_key = original_key
        asset.display_object_key = display_key
        asset.original_content_type = original_type
        asset.display_content_type = "image/webp"
        asset.width = width
        asset.height = height
        asset.filename = filename
        swatch.revision += 1
        swatch.updated_at = utc_now()
        await db.commit()
        await db.refresh(swatch)
    except Exception:
        await db.rollback()
        await _remove_objects(storage, (original_key, display_key), swatch.id)
        raise
    await _remove_objects(storage, old_keys, swatch.id)
    return _read(swatch, asset)


@router.get("/swatches/{swatch_id}/image")
async def get_swatch_image(
    swatch_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    storage: Annotated[S3ObjectStorage, Depends(get_storage)],
) -> Response:
    _, asset = await _local_swatch(swatch_id, db)
    content = await run_in_threadpool(storage.get, asset.display_object_key)
    return Response(
        content,
        media_type=asset.display_content_type,
        headers={"Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff"},
    )


@router.delete("/swatches/{swatch_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_swatch(
    swatch_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    storage: Annotated[S3ObjectStorage, Depends(get_storage)],
) -> Response:
    swatch, asset = await _local_swatch(swatch_id, db)
    keys = (asset.original_object_key, asset.display_object_key)
    await db.delete(asset)
    await db.delete(swatch)
    await db.commit()
    await _remove_objects(storage, keys, swatch_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
