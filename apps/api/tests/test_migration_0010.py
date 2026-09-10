import importlib

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


def test_0010_adds_and_removes_image_first_lesson_state(monkeypatch) -> None:
    photo_migration = importlib.import_module("migrations.versions.0009_photo_lessons")
    image_migration = importlib.import_module("migrations.versions.0010_image_first_lessons")
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
        photo_migration.upgrade()

        image_migration.upgrade()
        inspector = sa.inspect(connection)
        lesson_columns = {column["name"] for column in inspector.get_columns("painting_lessons")}
        asset_columns = {column["name"] for column in inspector.get_columns("lesson_assets")}
        run_columns = {column["name"] for column in inspector.get_columns("lesson_generation_runs")}
        assert {
            "source_mode",
            "scene_prompt",
            "generation_brief",
            "approved_target_asset_id",
            "active_render_set_id",
        } <= lesson_columns
        assert {"stage_id", "render_set_id"} <= asset_columns
        assert {"progress", "adjustment"} <= run_columns

        image_migration.downgrade()
        inspector = sa.inspect(connection)
        assert "source_mode" not in {
            column["name"] for column in inspector.get_columns("painting_lessons")
        }
        assert "stage_id" not in {
            column["name"] for column in inspector.get_columns("lesson_assets")
        }
        assert "progress" not in {
            column["name"] for column in inspector.get_columns("lesson_generation_runs")
        }
