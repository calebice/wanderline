import asyncio
import uuid

from sqlalchemy.dialects.postgresql import insert

from app.color_mixing import CATALOG
from app.database import session_factory
from app.models import ColorMixRecipe, LearnerProfile, utc_now


async def seed() -> None:
    async with session_factory() as db:
        learner_statement = insert(LearnerProfile).values(
            slug="local-learner", display_name="Artist", weekly_target=3
        )
        await db.execute(learner_statement.on_conflict_do_nothing(index_elements=["slug"]))
        recipe_rows = [
            {
                "id": uuid.uuid4(),
                "catalog_version": CATALOG.version,
                "palette_id": CATALOG.palette.id,
                "recipe_slug": recipe.id,
                "family": recipe.family,
                "name": recipe.name,
                "payload": recipe.model_dump(mode="json"),
                "created_at": utc_now(),
            }
            for recipe in CATALOG.recipes
        ]
        recipe_statement = insert(ColorMixRecipe).values(recipe_rows)
        await db.execute(
            recipe_statement.on_conflict_do_nothing(
                index_elements=["catalog_version", "palette_id", "recipe_slug"]
            )
        )
        await db.commit()


if __name__ == "__main__":
    asyncio.run(seed())
