import importlib

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


def test_0013_adds_discarded_timestamp(monkeypatch) -> None:
    migration = importlib.import_module("migrations.versions.0013_discarded_painting_sessions")
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(sa.text("CREATE TABLE painting_lessons (id CHAR(32) PRIMARY KEY)"))
        operations = Operations(MigrationContext.configure(connection))
        monkeypatch.setattr(migration, "op", operations)

        migration.upgrade()
        assert "discarded_at" in {
            column["name"] for column in sa.inspect(connection).get_columns("painting_lessons")
        }

        migration.downgrade()
        assert "discarded_at" not in {
            column["name"] for column in sa.inspect(connection).get_columns("painting_lessons")
        }
