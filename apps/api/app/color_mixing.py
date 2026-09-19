import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import ColorMixRecipe, ColorMixTrial, utc_now
from app.repositories import LearnerProfileRepository


class ColorMixPaintV1(BaseModel):
    name: str
    color: str


class ColorMixFamilyV1(BaseModel):
    id: str
    name: str
    color: str


class ColorMixIngredientV1(BaseModel):
    paint: str
    amount: str
    role: str


class ColorMixCorrectionV1(BaseModel):
    label: str
    paint: str
    instruction: str


class ColorMixRecipeV1(BaseModel):
    id: str
    family: str
    name: str
    color: str
    ingredients: list[ColorMixIngredientV1]
    water: str
    correction: ColorMixCorrectionV1


class ColorMixPaletteV1(BaseModel):
    id: str
    name: str
    paints: list[ColorMixPaintV1]


class ColorMixCatalogV1(BaseModel):
    schema_version: str
    version: int
    palette: ColorMixPaletteV1
    families: list[ColorMixFamilyV1]
    recipes: list[ColorMixRecipeV1]
    guidance_status: str = "illustrative"
    guidance_note: str = "These authored starting points have not been physically validated with every paint and paper."


class ColorMixTrialCreate(BaseModel):
    recipe_id: str = Field(min_length=1, max_length=100)
    catalog_version: int = Field(ge=1)
    adjustments: list[str] = Field(default_factory=list, max_length=50)
    notes: str = Field(default="", max_length=2000)


class ColorMixTrialUpdate(BaseModel):
    expected_revision: int = Field(ge=1)
    adjustments: list[str] = Field(default_factory=list, max_length=50)
    notes: str = Field(default="", max_length=2000)


class ColorMixTrialRead(BaseModel):
    id: uuid.UUID
    recipe: ColorMixRecipeV1
    catalog_version: int
    adjustments: list[str]
    notes: str
    revision: int
    created_at: datetime
    updated_at: datetime


def load_catalog() -> ColorMixCatalogV1:
    payload = json.loads(Path(__file__).with_name("color_mixing_catalog.json").read_text())
    return ColorMixCatalogV1.model_validate(payload)


CATALOG = load_catalog()


async def ensure_catalog(db: AsyncSession) -> dict[str, ColorMixRecipe]:
    palette_id = CATALOG.palette.id
    rows = list(
        await db.scalars(
            select(ColorMixRecipe).where(
                ColorMixRecipe.catalog_version == CATALOG.version,
                ColorMixRecipe.palette_id == palette_id,
            )
        )
    )
    by_slug = {row.recipe_slug: row for row in rows}
    for recipe in CATALOG.recipes:
        if recipe.id in by_slug:
            continue
        row = ColorMixRecipe(
            catalog_version=CATALOG.version,
            palette_id=palette_id,
            recipe_slug=recipe.id,
            family=recipe.family,
            name=recipe.name,
            payload=recipe.model_dump(mode="json"),
        )
        db.add(row)
        by_slug[recipe.id] = row
    if len(by_slug) != len(rows):
        await db.commit()
    return by_slug


def trial_read(trial: ColorMixTrial) -> ColorMixTrialRead:
    return ColorMixTrialRead(
        id=trial.id,
        recipe=ColorMixRecipeV1.model_validate(trial.recipe_snapshot),
        catalog_version=trial.catalog_version,
        adjustments=trial.adjustments,
        notes=trial.notes,
        revision=trial.revision,
        created_at=trial.created_at,
        updated_at=trial.updated_at,
    )


router = APIRouter(prefix="/api/v1/color-mixing", tags=["color-mixing"])


@router.get("/catalog", response_model=ColorMixCatalogV1)
async def get_color_mix_catalog(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ColorMixCatalogV1:
    await ensure_catalog(db)
    return CATALOG


@router.get("/trials", response_model=list[ColorMixTrialRead])
async def list_color_mix_trials(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[ColorMixTrialRead]:
    learner = await LearnerProfileRepository(db).get_local()
    trials = list(
        await db.scalars(
            select(ColorMixTrial)
            .where(ColorMixTrial.learner_id == learner.id)
            .order_by(ColorMixTrial.updated_at.desc())
        )
    )
    return [trial_read(trial) for trial in trials]


@router.post(
    "/trials",
    response_model=ColorMixTrialRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_color_mix_trial(
    request: ColorMixTrialCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ColorMixTrialRead:
    if request.catalog_version != CATALOG.version:
        raise HTTPException(status_code=422, detail="catalog version is not available")
    recipes = await ensure_catalog(db)
    recipe = recipes.get(request.recipe_id)
    if recipe is None:
        raise HTTPException(status_code=404, detail="color-mixing recipe not found")
    learner = await LearnerProfileRepository(db).get_local()
    trial = ColorMixTrial(
        learner_id=learner.id,
        recipe_id=recipe.id,
        catalog_version=recipe.catalog_version,
        recipe_snapshot=recipe.payload,
        adjustments=request.adjustments,
        notes=request.notes,
    )
    db.add(trial)
    await db.commit()
    await db.refresh(trial)
    return trial_read(trial)


@router.put("/trials/{trial_id}", response_model=ColorMixTrialRead)
async def update_color_mix_trial(
    trial_id: uuid.UUID,
    request: ColorMixTrialUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ColorMixTrialRead:
    learner = await LearnerProfileRepository(db).get_local()
    trial = await db.scalar(
        select(ColorMixTrial).where(
            ColorMixTrial.id == trial_id,
            ColorMixTrial.learner_id == learner.id,
        )
    )
    if trial is None:
        raise HTTPException(status_code=404, detail="color-mixing trial not found")
    if trial.revision != request.expected_revision:
        raise HTTPException(
            status_code=409, detail="color-mixing trial changed; reload and try again"
        )
    trial.adjustments = request.adjustments
    trial.notes = request.notes
    trial.revision += 1
    trial.updated_at = utc_now()
    await db.commit()
    await db.refresh(trial)
    return trial_read(trial)
