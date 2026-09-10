import importlib

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


def test_0009_adds_and_removes_photo_lesson_schema(monkeypatch) -> None:
    migration = importlib.import_module("migrations.versions.0009_photo_lessons")
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(
            sa.text(
                "CREATE TABLE learner_profiles "
                "(id CHAR(32) PRIMARY KEY, slug VARCHAR(100), display_name VARCHAR(120), "
                "weekly_target INTEGER, created_at DATETIME)"
            )
        )
        operations = Operations(MigrationContext.configure(connection))
        monkeypatch.setattr(migration, "op", operations)

        migration.upgrade()
        inspector = sa.inspect(connection)
        assert {"painting_lessons", "lesson_assets", "lesson_generation_runs"} <= set(
            inspector.get_table_names()
        )
        assert "uq_lesson_primary_reference" in {
            index["name"] for index in inspector.get_indexes("lesson_assets")
        }

        migration.downgrade()
        assert not {
            "painting_lessons",
            "lesson_assets",
            "lesson_generation_runs",
        } & set(sa.inspect(connection).get_table_names())
