import asyncio
import json
import logging
import uuid
from datetime import UTC, datetime

from redis.asyncio import Redis
from sqlalchemy import select

from app.config import settings
from app.database import session_factory
from app.lesson_service import LESSON_QUEUE, process_generation_run, recover_interrupted_runs
from app.models import LessonGenerationRun
from app.storage import S3ObjectStorage


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname.lower(),
            "event": record.getMessage(),
        }
        for key in (
            "run_id",
            "lesson_id",
            "scope",
            "section_key",
            "provider",
            "model",
            "attempt",
            "error_code",
        ):
            if hasattr(record, key):
                payload[key] = getattr(record, key)
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logging.basicConfig(level=logging.INFO, handlers=[handler], force=True)
logger = logging.getLogger("wanderline.worker")


async def main() -> None:
    logger.info("Wanderline worker started")
    queue = Redis.from_url(settings.redis_url)
    storage = S3ObjectStorage(settings)
    try:
        while True:
            item = await queue.brpop(LESSON_QUEUE, timeout=5)
            if item is None:
                async with session_factory() as db:
                    await recover_interrupted_runs(db)
                    pending = await db.scalar(
                        select(LessonGenerationRun.id)
                        .where(LessonGenerationRun.status == "queued")
                        .order_by(LessonGenerationRun.created_at)
                        .limit(1)
                    )
                    if pending:
                        await process_generation_run(pending, settings, storage, db)
                continue
            try:
                payload = json.loads(item[1])
                run_id = uuid.UUID(payload["run_id"])
                logger.info("lesson_generation_dequeued", extra={"run_id": str(run_id)})
                async with session_factory() as db:
                    await process_generation_run(run_id, settings, storage, db)
                logger.info("lesson_generation_processed", extra={"run_id": str(run_id)})
            except Exception:
                logger.exception("lesson_generation_worker_error")
                await asyncio.sleep(1)
    finally:
        await queue.aclose()


if __name__ == "__main__":
    asyncio.run(main())
