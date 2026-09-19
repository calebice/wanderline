from pathlib import Path

from app.database import Base
from app.lesson_service import LESSON_QUEUE
from app.main import app


def audit_text() -> str:
    return (Path(__file__).parents[3] / "docs" / "FEATURE_API_AUDIT.md").read_text()


def test_audit_lists_every_fastapi_operation() -> None:
    audit = audit_text()
    for route_path in app.openapi()["paths"]:
        assert route_path in audit, f"Missing API route disposition: {route_path}"


def test_audit_lists_every_database_table_and_worker_queue() -> None:
    audit = audit_text()
    table_names = {mapper.local_table.name for mapper in Base.registry.mappers}
    for table_name in table_names:
        assert table_name in audit, f"Missing table disposition: {table_name}"
    assert LESSON_QUEUE in audit
