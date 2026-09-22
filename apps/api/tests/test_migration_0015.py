import importlib

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


def test_0015_adds_color_library_without_changing_existing_records(monkeypatch) -> None:
    migration = importlib.import_module("migrations.versions.0015_personal_color_library")
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(sa.text("CREATE TABLE learner_profiles (id CHAR(32) PRIMARY KEY)"))
        connection.execute(sa.text("CREATE TABLE color_mix_recipes (id CHAR(32) PRIMARY KEY)"))
        connection.execute(sa.text("CREATE TABLE color_mix_trials (id CHAR(32) PRIMARY KEY)"))
        connection.execute(sa.text("INSERT INTO color_mix_trials VALUES ('existing-trial')"))
        operations = Operations(MigrationContext.configure(connection))
        monkeypatch.setattr(migration, "op", operations)

        migration.upgrade()

        inspector = sa.inspect(connection)
        assert {"color_swatches", "color_swatch_assets"} <= set(inspector.get_table_names())
        assert {"source_snapshot", "ingredients", "capture", "observations", "revision"} <= {
            column["name"] for column in inspector.get_columns("color_swatches")
        }
        assert connection.scalar(sa.text("SELECT count(*) FROM color_mix_trials")) == 1

        migration.downgrade()
        assert not {"color_swatches", "color_swatch_assets"} & set(
            sa.inspect(connection).get_table_names()
        )
        assert connection.scalar(sa.text("SELECT count(*) FROM color_mix_trials")) == 1
