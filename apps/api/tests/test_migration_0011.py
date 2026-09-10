import importlib

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


def test_0011_adds_and_removes_generation_accounting(monkeypatch) -> None:
    photo_migration = importlib.import_module("migrations.versions.0009_photo_lessons")
    image_migration = importlib.import_module("migrations.versions.0010_image_first_lessons")
    accounting_migration = importlib.import_module("migrations.versions.0011_generation_accounting")
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
        monkeypatch.setattr(photo_migration, "op", operations)
        monkeypatch.setattr(image_migration, "op", operations)
        monkeypatch.setattr(accounting_migration, "op", operations)
        photo_migration.upgrade()
        image_migration.upgrade()

        accounting_migration.upgrade()
        inspector = sa.inspect(connection)
        run_columns = {column["name"] for column in inspector.get_columns("lesson_generation_runs")}
        assert {"idempotency_key", "input_snapshot", "checkpoints", "heartbeat_at"} <= run_columns
        assert "generation_usage" in inspector.get_table_names()
        assert "uq_generation_idempotency" in {
            index["name"] for index in inspector.get_indexes("lesson_generation_runs")
        }
        assert {"ix_generation_usage_lesson_id", "ix_generation_usage_run_id"} <= {
            index["name"] for index in inspector.get_indexes("generation_usage")
        }

        accounting_migration.downgrade()
        inspector = sa.inspect(connection)
        assert "generation_usage" not in inspector.get_table_names()
        assert not {"idempotency_key", "input_snapshot", "checkpoints", "heartbeat_at"} & {
            column["name"] for column in inspector.get_columns("lesson_generation_runs")
        }
