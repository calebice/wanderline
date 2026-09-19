from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.lesson_service import LessonService
from app.storage import S3ObjectStorage

storage = S3ObjectStorage(settings)


def get_storage() -> S3ObjectStorage:
    return storage


def get_lesson_service(db: Annotated[AsyncSession, Depends(get_db)]) -> LessonService:
    return LessonService(settings, storage, db)
