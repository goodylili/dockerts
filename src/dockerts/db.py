import time
from datetime import datetime

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool, PoolTimeout

SCHEMA = """
CREATE TABLE IF NOT EXISTS contacts (
    id         BIGSERIAL PRIMARY KEY,
    name       TEXT NOT NULL,
    phone      TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (name, phone)
);
"""


class Contact:
    __slots__ = ("id", "name", "phone", "created_at")

    def __init__(self, id: int, name: str, phone: str, created_at: datetime) -> None:
        self.id = id
        self.name = name
        self.phone = phone
        self.created_at = created_at


class Database:
    def __init__(self, dsn: str, connect_timeout: float = 30.0) -> None:
        self.pool = ConnectionPool(dsn, min_size=1, max_size=10, timeout=5, open=True)
        self._init_schema(connect_timeout)

    def _init_schema(self, timeout: float) -> None:
        """Postgres may still be starting when the app boots, so retry briefly."""
        deadline = time.monotonic() + timeout
        while True:
            try:
                with self.pool.connection() as conn:
                    conn.execute(SCHEMA)
                return
            except (psycopg.OperationalError, PoolTimeout):
                if time.monotonic() >= deadline:
                    raise
                time.sleep(1.0)

    def close(self) -> None:
        self.pool.close()

    def save_contact(self, name: str, phone: str) -> tuple[Contact, bool]:
        """Store a contact. Replaying the same (name, phone) returns the existing
        row instead of inserting a duplicate, so the write is idempotent."""
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                "INSERT INTO contacts (name, phone) VALUES (%s, %s) "
                "ON CONFLICT (name, phone) DO NOTHING "
                "RETURNING id, name, phone, created_at",
                (name, phone),
            )
            row = cur.fetchone()
            if row is not None:
                return Contact(**row), True

            cur.execute(
                "SELECT id, name, phone, created_at FROM contacts "
                "WHERE name = %s AND phone = %s",
                (name, phone),
            )
            return Contact(**cur.fetchone()), False

    def list_contacts(self) -> list[Contact]:
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                "SELECT id, name, phone, created_at FROM contacts ORDER BY id"
            )
            return [Contact(**row) for row in cur.fetchall()]
