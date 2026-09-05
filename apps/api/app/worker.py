import asyncio
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("wanderline.worker")


async def main() -> None:
    logger.info("Wanderline worker started")
    while True:
        # Codex task: replace with the selected Redis-backed job worker.
        await asyncio.sleep(60)


if __name__ == "__main__":
    asyncio.run(main())
