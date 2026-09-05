import uuid
from io import BytesIO

from httpx import AsyncClient
from PIL import Image, ImageDraw
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.dependencies import get_image_decomposition_service, get_storage
from app.main import app
from app.models import Exercise, Sketch
from app.services import ImageDecompositionService


async def test_health_checks(client: AsyncClient) -> None:
    assert (await client.get("/health/live")).json() == {"status": "ok"}
    ready = await client.get("/health/ready")
    assert ready.status_code == 200
    assert ready.json() == {"status": "ready", "database": "ok"}


async def test_lists_seeded_exercises(client: AsyncClient) -> None:
    response = await client.get("/api/v1/exercises")
    assert response.status_code == 200
    assert response.json()[0]["id"] == "ghosted-lines-001"
    assert response.json()[0]["instructions"] == ["Ghost, then draw."]


async def test_reads_complete_visual_lesson(client: AsyncClient) -> None:
    response = await client.get("/api/v1/exercises/ghosted-lines-001")
    assert response.status_code == 200
    assert response.json()["objective"] == "Draw a confident line."
    assert response.json()["timed_phases"][0]["minutes"] == 10
    assert response.json()["three_d_config"] is None


async def test_progress_recommends_earliest_incomplete_lesson(client: AsyncClient) -> None:
    response = await client.get("/api/v1/progress")
    assert response.status_code == 200
    assert response.json()["weekly_target"] == 3
    assert response.json()["recommended_exercise_id"] == "ghosted-lines-001"
    assert response.json()["lessons"][0]["status"] == "not_started"


async def test_creates_practice_session_for_known_exercise(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/practice-sessions", json={"exercise_id": "ghosted-lines-001"}
    )
    assert response.status_code == 201
    assert response.json()["exercise_id"] == "ghosted-lines-001"
    assert response.json()["status"] == "in_progress"


async def test_completes_session_with_reflection_and_updates_progress(
    client: AsyncClient,
) -> None:
    created = await client.post(
        "/api/v1/practice-sessions", json={"exercise_id": "ghosted-lines-001"}
    )
    session_id = created.json()["id"]
    restored = await client.get(f"/api/v1/practice-sessions/{session_id}")
    assert restored.status_code == 200
    assert restored.json()["status"] == "in_progress"

    completed = await client.post(
        f"/api/v1/practice-sessions/{session_id}/complete",
        json={
            "difficulty_response": "too_hard",
            "takeaway": "Short lines felt more decisive.",
        },
    )
    assert completed.status_code == 200
    assert completed.json()["session"]["difficulty_response"] == "too_hard"
    assert completed.json()["progress"]["weekly_completed"] == 1
    assert completed.json()["progress"]["recent_reflections"][0]["takeaway"] == (
        "Short lines felt more decisive."
    )

    duplicate = await client.post(
        f"/api/v1/practice-sessions/{session_id}/complete",
        json={"difficulty_response": "just_right"},
    )
    assert duplicate.status_code == 409


async def test_completing_later_lesson_does_not_erase_earlier_recommendation(
    client: AsyncClient, db: AsyncSession
) -> None:
    db.add(
        Exercise(
            slug="ellipses-001",
            title="Ellipses",
            skill="shape_accuracy",
            difficulty=1,
            duration_minutes=15,
            instructions=["Draw through each ellipse."],
            completion_requirements={"reflection": True},
            reference_mode="diagram",
            sequence_index=2,
            week_number=1,
            objective="Draw even ellipses.",
            concept="Keep a continuous rhythm.",
            why_it_matters="Ellipses describe turning forms.",
            common_mistake="Pinching the ends.",
            materials=["Paper", "Pen"],
            timed_phases=[
                {
                    "label": "Practice",
                    "minutes": 15,
                    "instruction": "Draw rows of ellipses.",
                }
            ],
            visual_kind="ellipses",
            three_d_config=None,
            replay_variation="Draw larger ellipses.",
        )
    )
    await db.commit()
    created = await client.post("/api/v1/practice-sessions", json={"exercise_id": "ellipses-001"})
    completed = await client.post(
        f"/api/v1/practice-sessions/{created.json()['id']}/complete",
        json={"difficulty_response": "just_right"},
    )

    assert completed.status_code == 200
    progress = completed.json()["progress"]
    assert progress["recommended_exercise_id"] == "ghosted-lines-001"
    assert progress["lessons"][1]["status"] == "completed"


async def test_rejects_unknown_exercise(client: AsyncClient) -> None:
    response = await client.post("/api/v1/practice-sessions", json={"exercise_id": "unknown"})
    assert response.status_code == 404


async def test_streams_private_sketch_image_through_api(
    client: AsyncClient, db: AsyncSession
) -> None:
    sketch_id = uuid.uuid4()
    db.add(
        Sketch(
            id=sketch_id,
            object_key="sketches/review.jpg",
            content_type="image/jpeg",
            width=120,
            height=90,
            actual_subject="A guitar",
        )
    )
    await db.commit()

    class FakeStorage:
        def get(self, key: str) -> bytes:
            assert key == "sketches/review.jpg"
            return b"\xff\xd8\xfftest"

    app.dependency_overrides[get_storage] = FakeStorage
    response = await client.get(f"/api/v1/sketches/{sketch_id}/image")

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/jpeg"
    assert response.headers["cache-control"] == "private, max-age=3600"
    assert response.content == b"\xff\xd8\xfftest"


async def test_creates_restores_and_streams_image_decomposition(
    client: AsyncClient, db: AsyncSession
) -> None:
    image = Image.new("RGB", (320, 240), "white")
    drawing = ImageDraw.Draw(image)
    drawing.rectangle((70, 100, 250, 210), fill="#bd765e")
    drawing.polygon([(55, 105), (160, 30), (265, 105)], fill="#627c69")
    content = BytesIO()
    image.save(content, format="PNG")

    class MemoryStorage:
        def __init__(self) -> None:
            self.objects: dict[str, bytes] = {}

        def put(self, key: str, value: bytes, content_type: str) -> None:
            assert content_type == "image/png"
            self.objects[key] = value

        def get(self, key: str) -> bytes:
            return self.objects[key]

    storage = MemoryStorage()
    service = ImageDecompositionService(Settings(), storage, db)  # type: ignore[arg-type]
    app.dependency_overrides[get_image_decomposition_service] = lambda: service
    app.dependency_overrides[get_storage] = lambda: storage

    response = await client.post(
        "/api/v1/image-decompositions",
        files={"image": ("house.png", content.getvalue(), "image/png")},
    )

    assert response.status_code == 201
    result = response.json()
    assert result["provider"] == "local_cv_shapes"
    assert result["algorithm_version"] == "local_cv_shapes_v2"
    assert {shape["kind"] for shape in result["shapes"]} >= {"rectangle", "triangle"}
    restored = await client.get(f"/api/v1/image-decompositions/{result['id']}")
    assert restored.status_code == 200
    assert restored.json()["shapes"] == result["shapes"]
    streamed = await client.get(f"/api/v1/images/{result['image']['id']}")
    assert streamed.status_code == 200
    assert streamed.content == content.getvalue()
