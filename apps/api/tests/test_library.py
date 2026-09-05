import uuid

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import LearnerProfile, LibraryAttempt, LibraryExercise


async def test_lists_and_filters_complete_library_progression(client: AsyncClient) -> None:
    response = await client.get("/api/v1/library/exercises")
    assert response.status_code == 200
    assert len(response.json()) == 20
    assert response.json()[0]["id"] == "one-point-box-field"
    assert response.json()[-1]["id"] == "invented-creature-synthesis"

    filtered = await client.get("/api/v1/library/exercises?track=solid_form&difficulty=2")
    assert filtered.status_code == 200
    assert [item["id"] for item in filtered.json()] == ["cross-contour-wraps"]

    portraits = await client.get("/api/v1/library/exercises?track=portrait_foundations")
    assert [item["id"] for item in portraits.json()] == [
        "head-as-form",
        "facial-proportion-map",
        "features-around-the-turn",
    ]

    creatures = await client.get("/api/v1/library/exercises?track=figure_creature")
    assert [item["id"] for item in creatures.json()] == [
        "gesture-action-lines",
        "human-mannequin",
        "quadruped-body-masses",
        "animal-leg-rhythms",
        "dog-head-planes",
        "cat-head-construction",
        "paws-and-ground-contact",
        "invented-creature-synthesis",
    ]

    removed_track = await client.get("/api/v1/library/exercises?track=style_language")
    assert removed_track.status_code == 200
    assert removed_track.json() == []


async def test_removed_style_lab_api_is_not_exposed(client: AsyncClient) -> None:
    assert (await client.get("/api/v1/style-recipes")).status_code == 404
    assert (await client.get("/api/v1/style-lab/history")).status_code == 404
    assert (
        await client.post(
            f"/api/v1/style-lab/attempts/{uuid.uuid4()}/artifacts",
            files={"image": ("study.png", b"not-an-image", "image/png")},
            data={"role": "before"},
        )
    ).status_code == 404


async def test_generates_subject_specific_portrait_and_creature_variations(
    client: AsyncClient,
) -> None:
    portrait = await client.post("/api/v1/library/attempts", json={"exercise_slug": "head-as-form"})
    assert portrait.status_code == 200
    assert portrait.json()["variant_data"]["kind"] == "head-construction"
    assert portrait.json()["variant_data"]["head_turn"] in {-28, -16, 0, 16, 28}

    dog = await client.post("/api/v1/library/attempts", json={"exercise_slug": "dog-head-planes"})
    assert dog.status_code == 200
    assert dog.json()["variant_data"]["kind"] == "dog-head"
    assert dog.json()["variant_data"]["muzzle"] in {"short", "medium", "long"}

    synthesis = await client.post(
        "/api/v1/library/attempts", json={"exercise_slug": "invented-creature-synthesis"}
    )
    assert synthesis.status_code == 200
    assert synthesis.json()["variant_data"]["body_plan"] in {"runner", "climber", "burrower"}
    assert synthesis.json()["variant_data"]["adaptation"]


async def test_creates_and_resumes_reproducible_attempt(client: AsyncClient) -> None:
    created = await client.post(
        "/api/v1/library/attempts", json={"exercise_slug": "one-point-box-field"}
    )
    assert created.status_code == 200
    attempt = created.json()
    assert attempt["variant_data"]["kind"] == "one-point"
    assert attempt["practice_medium"] == "paper"
    assert attempt["last_overlay_exported_at"] is None

    resumed = await client.post(
        "/api/v1/library/attempts", json={"exercise_slug": "one-point-box-field"}
    )
    assert resumed.status_code == 200
    assert resumed.json()["id"] == attempt["id"]
    assert resumed.json()["variant_seed"] == attempt["variant_seed"]
    assert resumed.json()["variant_data"] == attempt["variant_data"]

    restored = await client.get(f"/api/v1/library/attempts/{attempt['id']}")
    assert restored.status_code == 200
    assert restored.json()["variant_data"] == attempt["variant_data"]


async def test_records_idempotent_digital_use_without_export_details(client: AsyncClient) -> None:
    created = await client.post(
        "/api/v1/library/attempts", json={"exercise_slug": "two-point-boxes"}
    )
    attempt_id = created.json()["id"]

    first = await client.post(f"/api/v1/library/attempts/{attempt_id}/digital-export")
    assert first.status_code == 200
    assert first.json()["practice_medium"] == "digital"
    assert first.json()["last_overlay_exported_at"] is not None
    assert "export_method" not in first.json()
    assert "canvas_dimensions" not in first.json()

    second = await client.post(f"/api/v1/library/attempts/{attempt_id}/digital-export")
    assert second.status_code == 200
    assert second.json()["practice_medium"] == "digital"
    assert second.json()["last_overlay_exported_at"] >= first.json()["last_overlay_exported_at"]


async def test_digital_export_hides_another_learners_attempt(
    client: AsyncClient, db: AsyncSession
) -> None:
    exercise = await db.scalar(
        select(LibraryExercise).where(LibraryExercise.slug == "draw-through-forms")
    )
    assert exercise is not None
    other = LearnerProfile(slug="other-learner", display_name="Other learner")
    db.add(other)
    await db.flush()
    foreign_attempt = LibraryAttempt(
        learner_id=other.id,
        exercise_id=exercise.id,
        variant_seed=42,
        variant_data={"kind": "draw-through", "primitive": "box"},
    )
    db.add(foreign_attempt)
    await db.commit()

    response = await client.post(f"/api/v1/library/attempts/{foreign_attempt.id}/digital-export")
    assert response.status_code == 404

    missing = await client.post(f"/api/v1/library/attempts/{uuid.uuid4()}/digital-export")
    assert missing.status_code == 404


async def test_completion_requires_every_self_check_but_does_not_grade(client: AsyncClient) -> None:
    created = await client.post(
        "/api/v1/library/attempts", json={"exercise_slug": "five-value-hatch-ladder"}
    )
    attempt_id = created.json()["id"]
    incomplete = await client.post(
        f"/api/v1/library/attempts/{attempt_id}/complete",
        json={
            "self_check_responses": {"distinct-values": "met"},
            "difficulty_response": "too_hard",
        },
    )
    assert incomplete.status_code == 422

    completed = await client.post(
        f"/api/v1/library/attempts/{attempt_id}/complete",
        json={
            "self_check_responses": {
                "distinct-values": "needs_work",
                "spacing": "needs_work",
                "stroke-family": "met",
            },
            "difficulty_response": "too_hard",
            "takeaway": "Spacing changed the value more clearly than pressure.",
        },
    )
    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"
    assert completed.json()["self_check_responses"]["distinct-values"] == "needs_work"

    duplicate = await client.post(
        f"/api/v1/library/attempts/{attempt_id}/complete",
        json={
            "self_check_responses": {
                "distinct-values": "met",
                "spacing": "met",
                "stroke-family": "met",
            },
            "difficulty_response": "just_right",
        },
    )
    assert duplicate.status_code == 409


async def test_library_history_is_independent_from_path_progress(client: AsyncClient) -> None:
    before = (await client.get("/api/v1/progress")).json()
    created = await client.post(
        "/api/v1/library/attempts", json={"exercise_slug": "draw-through-forms"}
    )
    completed = await client.post(
        f"/api/v1/library/attempts/{created.json()['id']}/complete",
        json={
            "self_check_responses": {
                "complete-volume": "met",
                "light-hidden": "needs_work",
                "corners-connect": "met",
            },
            "difficulty_response": "just_right",
        },
    )
    assert completed.status_code == 200

    history = await client.get("/api/v1/library/history")
    assert history.status_code == 200
    item = next(
        item
        for item in history.json()["exercises"]
        if item["exercise_slug"] == "draw-through-forms"
    )
    assert item["attempt_count"] == 1

    after = (await client.get("/api/v1/progress")).json()
    assert after["total_completed_lessons"] == before["total_completed_lessons"]
    assert after["weekly_completed"] == before["weekly_completed"]
    assert after["recommended_exercise_id"] == before["recommended_exercise_id"]
