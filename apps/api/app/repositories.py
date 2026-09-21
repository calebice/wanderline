from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import LearnerProfile


class LearnerProfileRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_local(self) -> LearnerProfile:
        learner = await self.db.scalar(
            select(LearnerProfile).where(LearnerProfile.slug == "local-learner")
        )
        if learner is None:
            learner = LearnerProfile(slug="local-learner", display_name="Artist", weekly_target=3)
            self.db.add(learner)
            await self.db.flush()
        return learner
