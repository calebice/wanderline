import importlib

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


def test_0012_adds_versioned_color_recipes_and_trials(monkeypatch) -> None:
    migration = importlib.import_module("migrations.versions.0012_color_mixing_trials")
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(sa.text("CREATE TABLE learner_profiles (id CHAR(32) PRIMARY KEY)"))
        operations = Operations(MigrationContext.configure(connection))
        monkeypatch.setattr(migration, "op", operations)

        migration.upgrade()
        inspector = sa.inspect(connection)
        assert {"color_mix_recipes", "color_mix_trials"} <= set(inspector.get_table_names())
        assert "uq_color_mix_recipe_version" in {
            index["name"] for index in inspector.get_indexes("color_mix_recipes")
        }
        assert {"recipe_snapshot", "adjustments", "notes", "revision"} <= {
            column["name"] for column in inspector.get_columns("color_mix_trials")
        }

        migration.downgrade()
        assert not {"color_mix_recipes", "color_mix_trials"} & set(
            sa.inspect(connection).get_table_names()
        )
