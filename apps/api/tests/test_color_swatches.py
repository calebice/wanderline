import json
import uuid
from io import BytesIO

import pytest
from httpx import AsyncClient
from PIL import Image
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_storage
from app.main import app
from app.models import ColorSwatch, ColorSwatchAsset, LearnerProfile


class MemoryStorage:
    def __init__(self) -> None:
        self.objects: dict[str, tuple[bytes, str]] = {}

    def put(self, key: str, content: bytes, content_type: str) -> None:
        self.objects[key] = (content, content_type)

    def get(self, key: str) -> bytes:
        return self.objects[key][0]

    def delete(self, key: str) -> None:
        self.objects.pop(key, None)


def image_bytes(color: str = "olive") -> bytes:
    output = BytesIO()
    Image.new("RGB", (180, 120), color).save(output, format="PNG")
    return output.getvalue()


def metadata(
    source_type: str = "single_paint",
    ingredients: list[dict[str, object]] | None = None,
    recipe_id: str | None = None,
) -> dict[str, object]:
    return {
        "source_type": source_type,
        "palette_id": "emily-lex-18",
        "catalog_version": 1,
        "recipe_id": recipe_id,
        "name": "Physical olive",
        "ingredients": ingredients or [{"paint": "Lemon Yellow", "parts": 1}],
        "paper": {"brand": "Arches", "product": "Cold press", "weight_texture": "140 lb"},
        "capture": {
            "card_brand": "Calibrite",
            "card_model": "Color card",
            "lighting": "indirect_daylight",
            "other_lighting": "",
            "card_visible": True,
        },
        "appearance": {"value": "mid", "temperature": "warm", "chroma": "moderate"},
        "traits": {
            "transparency": "transparent",
            "granulation": "some",
            "lifting": "lifts_some",
            "water_notes": "One brush of water.",
            "drying_notes": "Dried overnight.",
        },
        "comparison": None
        if source_type == "custom_mix"
        else {"value": "same", "temperature": "warmer", "chroma": "same", "close": True},
        "notes": "Useful for leaves.",
        "tested_on": "2026-09-20",
    }


async def create(client: AsyncClient, payload: dict[str, object]) -> object:
    return await client.post(
        "/api/v1/color-mixing/swatches",
        data={"metadata": json.dumps(payload)},
        files={"image": ("swatch.png", image_bytes(), "image/png")},
    )


@pytest.mark.asyncio
async def test_single_swatch_create_list_update_image_and_delete(
    client: AsyncClient, db: AsyncSession
) -> None:
    storage = MemoryStorage()
    app.dependency_overrides[get_storage] = lambda: storage

    created = await create(client, metadata())
    assert created.status_code == 201
    swatch = created.json()
    assert swatch["source_type"] == "single_paint"
    assert swatch["ingredients"] == [{"paint": "Lemon Yellow", "parts": 1.0}]
    assert swatch["revision"] == 1
    assert len(storage.objects) == 2

    listed = await client.get(
        "/api/v1/color-mixing/swatches",
        params={"source_type": "single_paint", "ingredient": "Lemon Yellow"},
    )
    assert [item["id"] for item in listed.json()] == [swatch["id"]]
    assert (
        await client.get("/api/v1/color-mixing/swatches", params={"ingredient": "Rose"})
    ).json() == []

    streamed = await client.get(swatch["image_url"])
    assert streamed.status_code == 200
    assert streamed.headers["cache-control"] == "private, max-age=3600"

    update = metadata()
    for field in ("source_type", "palette_id", "catalog_version", "recipe_id"):
        update.pop(field)
    update["name"] = "Dry olive leaf"
    updated = await client.put(
        f"/api/v1/color-mixing/swatches/{swatch['id']}",
        json={**update, "expected_revision": 1},
    )
    assert updated.status_code == 200
    assert updated.json()["revision"] == 2
    assert updated.json()["name"] == "Dry olive leaf"
    assert (
        await client.put(
            f"/api/v1/color-mixing/swatches/{swatch['id']}",
            json={**update, "expected_revision": 1},
        )
    ).status_code == 409
    wrong_source = {**update, "ingredients": [{"paint": "Rose", "parts": 1}]}
    assert (
        await client.put(
            f"/api/v1/color-mixing/swatches/{swatch['id']}",
            json={**wrong_source, "expected_revision": 2},
        )
    ).status_code == 422

    old_keys = set(storage.objects)
    replaced = await client.put(
        f"/api/v1/color-mixing/swatches/{swatch['id']}/image",
        data={"expected_revision": "2"},
        files={"image": ("replacement.png", image_bytes("gold"), "image/png")},
    )
    assert replaced.status_code == 200
    assert replaced.json()["revision"] == 3
    assert len(storage.objects) == 2
    assert not old_keys & set(storage.objects)

    deleted = await client.delete(f"/api/v1/color-mixing/swatches/{swatch['id']}")
    assert deleted.status_code == 204
    assert storage.objects == {}
    assert (
        await db.scalar(select(ColorSwatch).where(ColorSwatch.id == uuid.UUID(swatch["id"])))
        is None
    )
    assert await db.scalar(select(ColorSwatchAsset)) is None


@pytest.mark.asyncio
async def test_catalog_and_custom_swatches_preserve_sources(client: AsyncClient) -> None:
    storage = MemoryStorage()
    app.dependency_overrides[get_storage] = lambda: storage
    catalog = (await client.get("/api/v1/color-mixing/catalog")).json()
    recipe = next(item for item in catalog["recipes"] if item["id"] == "olive-green")
    catalog_payload = metadata(
        "catalog_mix",
        [
            {"paint": item["paint"], "parts": index + 1}
            for index, item in enumerate(recipe["ingredients"])
        ],
        "olive-green",
    )
    authored = await create(client, catalog_payload)
    assert authored.status_code == 201
    assert authored.json()["source_snapshot"]["id"] == "olive-green"
    assert authored.json()["family"] == "greens"

    custom_payload = metadata(
        "custom_mix",
        [{"paint": "Lemon Yellow", "parts": 2}, {"paint": "Green Deep", "parts": 1}],
    )
    custom_payload["name"] = "Garden green"
    custom = await create(client, custom_payload)
    assert custom.status_code == 201
    assert custom.json()["comparison"] is None
    assert [item["id"] for item in (await client.get("/api/v1/color-mixing/swatches")).json()] == [
        custom.json()["id"],
        authored.json()["id"],
    ]


@pytest.mark.asyncio
async def test_swatch_validation_and_learner_isolation(
    client: AsyncClient, db: AsyncSession
) -> None:
    storage = MemoryStorage()
    app.dependency_overrides[get_storage] = lambda: storage
    bad = metadata("custom_mix", [{"paint": "Lemon Yellow", "parts": 1}])
    assert (await create(client, bad)).status_code == 422
    duplicate = metadata(
        "custom_mix",
        [{"paint": "Lemon Yellow", "parts": 1}, {"paint": "Lemon Yellow", "parts": 2}],
    )
    assert (await create(client, duplicate)).status_code == 422
    missing_card = metadata()
    missing_card["capture"] = {**missing_card["capture"], "card_visible": False}  # type: ignore[dict-item]
    assert (await create(client, missing_card)).status_code == 422

    valid = await create(client, metadata())
    swatch_id = uuid.UUID(valid.json()["id"])
    other = LearnerProfile(slug="other-swatch-learner", display_name="Other")
    db.add(other)
    await db.flush()
    row = await db.scalar(select(ColorSwatch).where(ColorSwatch.id == swatch_id))
    assert row is not None
    row.learner_id = other.id
    await db.commit()
    assert (await client.get(f"/api/v1/color-mixing/swatches/{swatch_id}")).status_code == 404
    assert (await client.get(f"/api/v1/color-mixing/swatches/{swatch_id}/image")).status_code == 404
