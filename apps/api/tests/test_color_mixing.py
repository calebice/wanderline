import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ColorMixRecipe, ColorMixTrial, LearnerProfile


@pytest.mark.asyncio
async def test_catalog_seeds_all_versioned_recipes(client: AsyncClient, db: AsyncSession) -> None:
    response = await client.get("/api/v1/color-mixing/catalog")

    assert response.status_code == 200
    payload = response.json()
    assert payload["schema_version"] == "color-mix-catalog.v1"
    assert payload["version"] == 1
    assert payload["palette"]["id"] == "emily-lex-18"
    assert len(payload["recipes"]) == 36
    assert payload["guidance_status"] == "illustrative"


@pytest.mark.asyncio
async def test_trial_create_list_update_and_conflict(client: AsyncClient) -> None:
    created = await client.post(
        "/api/v1/color-mixing/trials",
        json={
            "recipe_id": "olive-green",
            "catalog_version": 1,
            "adjustments": ["Added a little more Lemon Yellow."],
            "notes": "Best after drying.",
        },
    )
    assert created.status_code == 201
    trial = created.json()
    assert trial["recipe"]["id"] == "olive-green"
    assert trial["revision"] == 1

    listed = await client.get("/api/v1/color-mixing/trials")
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [trial["id"]]

    updated = await client.put(
        f"/api/v1/color-mixing/trials/{trial['id']}",
        json={
            "expected_revision": 1,
            "adjustments": ["Added water."],
            "notes": "Use less pigment next time.",
        },
    )
    assert updated.status_code == 200
    assert updated.json()["revision"] == 2

    conflict = await client.put(
        f"/api/v1/color-mixing/trials/{trial['id']}",
        json={"expected_revision": 1, "adjustments": [], "notes": "stale"},
    )
    assert conflict.status_code == 409


@pytest.mark.asyncio
async def test_trials_are_scoped_to_local_learner(client: AsyncClient, db: AsyncSession) -> None:
    await client.get("/api/v1/color-mixing/catalog")
    other = LearnerProfile(slug="other-color-learner", display_name="Other")
    db.add(other)
    await db.flush()
    trial_id = uuid.uuid4()
    recipe = await db.scalar(
        select(ColorMixRecipe).where(ColorMixRecipe.recipe_slug == "olive-green")
    )
    assert recipe is not None
    # A foreign trial identifier must not leak through the learner-scoped update route.
    db.add(
        ColorMixTrial(
            id=trial_id,
            learner_id=other.id,
            recipe_id=recipe.id,
            catalog_version=1,
            recipe_snapshot={
                "id": "olive-green",
                "family": "greens",
                "name": "Olive green",
                "color": "#85904f",
                "ingredients": [],
                "water": "Test it.",
                "correction": {"label": "Test", "paint": "Green Deep", "instruction": "Test."},
            },
            adjustments=[],
            notes="",
        )
    )
    await db.commit()

    response = await client.put(
        f"/api/v1/color-mixing/trials/{trial_id}",
        json={"expected_revision": 1, "adjustments": [], "notes": "no"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_removed_legacy_routes_are_absent(client: AsyncClient) -> None:
    assert (await client.get("/api/v1/exercises")).status_code == 404
    schema = (await client.get("/openapi.json")).json()
    assert "/api/v1/exercises" not in schema["paths"]
    assert "deprecated" not in schema["paths"]["/api/v1/color-mixing/catalog"]["get"]
