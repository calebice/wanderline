import importlib

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


def test_0008_removes_style_records_and_recreates_only_empty_schema(monkeypatch) -> None:
    migration = importlib.import_module("migrations.versions.0008_curated_style_guide")
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(
            sa.text(
                "CREATE TABLE library_exercises "
                "(id VARCHAR(36) PRIMARY KEY, track VARCHAR(40) NOT NULL)"
            )
        )
        connection.execute(
            sa.text(
                "CREATE TABLE library_attempts "
                "(id VARCHAR(36) PRIMARY KEY, exercise_id VARCHAR(36) NOT NULL)"
            )
        )
        connection.execute(
            sa.text(
                "CREATE TABLE style_recipes "
                "(id VARCHAR(36) PRIMARY KEY, learner_id VARCHAR(36), name VARCHAR(80), "
                "dimensions JSON, favorite BOOLEAN, source_attempt_id VARCHAR(36), "
                "created_at DATETIME, updated_at DATETIME)"
            )
        )
        connection.execute(
            sa.text("CREATE INDEX ix_style_recipes_learner_id ON style_recipes (learner_id)")
        )
        connection.execute(
            sa.text(
                "CREATE TABLE style_study_artifacts "
                "(id VARCHAR(36) PRIMARY KEY, attempt_id VARCHAR(36), sketch_id VARCHAR(36), "
                "role VARCHAR(10), created_at DATETIME, "
                "CONSTRAINT uq_style_artifact_attempt_role UNIQUE (attempt_id, role))"
            )
        )
        connection.execute(
            sa.text(
                "CREATE INDEX ix_style_artifacts_attempt_id "
                "ON style_study_artifacts (attempt_id)"
            )
        )
        connection.execute(
            sa.text(
                "INSERT INTO library_exercises (id, track) VALUES "
                "('style-exercise', 'style_language'), ('form-exercise', 'solid_form')"
            )
        )
        connection.execute(
            sa.text(
                "INSERT INTO library_attempts (id, exercise_id) VALUES "
                "('style-attempt', 'style-exercise'), ('form-attempt', 'form-exercise')"
            )
        )

        operations = Operations(MigrationContext.configure(connection))
        monkeypatch.setattr(migration, "op", operations)
        migration.upgrade()

        tables = set(sa.inspect(connection).get_table_names())
        assert "style_recipes" not in tables
        assert "style_study_artifacts" not in tables
        assert connection.scalar(sa.text("SELECT count(*) FROM library_exercises")) == 1
        assert connection.scalar(sa.text("SELECT count(*) FROM library_attempts")) == 1
        assert connection.scalar(
            sa.text("SELECT track FROM library_exercises")
        ) == "solid_form"

        migration.downgrade()
        tables = set(sa.inspect(connection).get_table_names())
        assert {"style_recipes", "style_study_artifacts"}.issubset(tables)
        assert connection.scalar(sa.text("SELECT count(*) FROM style_recipes")) == 0
        assert connection.scalar(sa.text("SELECT count(*) FROM style_study_artifacts")) == 0
