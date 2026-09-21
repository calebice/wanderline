import importlib

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


def test_0014_removes_only_exported_legacy_tables(monkeypatch) -> None:
    migration = importlib.import_module("migrations.versions.0014_remove_legacy_drawing_features")
    engine = sa.create_engine("sqlite://")
    legacy = {
        "exercises",
        "practice_sessions",
        "library_exercises",
        "library_attempts",
        "sketches",
        "analyses",
    }
    retained = {
        "learner_profiles",
        "painting_lessons",
        "lesson_assets",
        "lesson_generation_runs",
        "generation_usage",
        "color_mix_recipes",
        "color_mix_trials",
    }
    with engine.begin() as connection:
        for table in sorted(legacy | retained):
            connection.execute(sa.text(f"CREATE TABLE {table} (id CHAR(32) PRIMARY KEY)"))
        connection.execute(sa.text("INSERT INTO painting_lessons VALUES ('painting')"))
        connection.execute(sa.text("INSERT INTO color_mix_trials VALUES ('trial')"))
        operations = Operations(MigrationContext.configure(connection))
        monkeypatch.setattr(migration, "op", operations)

        migration.upgrade()

        tables = set(sa.inspect(connection).get_table_names())
        assert not legacy & tables
        assert retained <= tables
        assert connection.scalar(sa.text("SELECT count(*) FROM painting_lessons")) == 1
        assert connection.scalar(sa.text("SELECT count(*) FROM color_mix_trials")) == 1
