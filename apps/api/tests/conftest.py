from collections.abc import AsyncIterator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.library_seed import LIBRARY_EXERCISES
from app.main import app
from app.models import Exercise, LibraryExercise


@pytest_asyncio.fixture
async def db() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        session.add(
            Exercise(
                slug="ghosted-lines-001",
                title="Ghosted Lines",
                skill="line_control",
                difficulty=1,
                duration_minutes=10,
                instructions=["Ghost, then draw."],
                completion_requirements={"lines": 20},
                reference_mode="generated",
                sequence_index=1,
                week_number=1,
                objective="Draw a confident line.",
                concept="Plan the stroke before drawing it.",
                why_it_matters="Clear lines support every later exercise.",
                common_mistake="Correcting the line repeatedly.",
                materials=["Paper", "Pen"],
                timed_phases=[
                    {
                        "label": "Practice",
                        "minutes": 10,
                        "instruction": "Ghost, then draw.",
                    }
                ],
                visual_kind="lines",
                three_d_config=None,
                replay_variation="Use shorter lines.",
            )
        )
        session.add_all(LibraryExercise(**item) for item in LIBRARY_EXERCISES)
        await session.commit()
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db: AsyncSession) -> AsyncIterator[AsyncClient]:
    async def override_db() -> AsyncIterator[AsyncSession]:
        yield db

    app.dependency_overrides[get_db] = override_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as value:
        yield value
    app.dependency_overrides.clear()
