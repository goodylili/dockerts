"""Data access for :class:`~biodata.models.BioRecord`."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from biodata.models import BioRecord


def get_by_id(session: Session, record_id: uuid.UUID) -> BioRecord | None:
    """Return the record with ``record_id`` or ``None``."""
    return session.get(BioRecord, record_id)


def get_by_idempotency_key(session: Session, key: str) -> BioRecord | None:
    """Return the record stored under ``key`` or ``None``."""
    stmt = select(BioRecord).where(BioRecord.idempotency_key == key)
    return session.execute(stmt).scalar_one_or_none()


def insert_if_absent(session: Session, values: dict[str, Any]) -> tuple[BioRecord, bool]:
    """Insert a record, tolerating a concurrent or replayed insert.

    Uses ``INSERT ... ON CONFLICT (idempotency_key) DO NOTHING`` so a replay can
    never create a duplicate row, then reads back whichever row now owns the key.

    Returns the stored record and whether this call created it.
    """
    payload = {"id": uuid.uuid4(), **values}
    stmt = (
        pg_insert(BioRecord)
        .values(**payload)
        .on_conflict_do_nothing(index_elements=[BioRecord.idempotency_key])
        .returning(BioRecord.id)
    )
    created_id = session.execute(stmt).scalar_one_or_none()
    session.commit()

    if created_id is not None:
        record = get_by_id(session, created_id)
        if record is None:  # pragma: no cover - defensive
            raise RuntimeError("inserted record disappeared")
        return record, True

    existing = get_by_idempotency_key(session, str(values["idempotency_key"]))
    if existing is None:  # pragma: no cover - defensive
        raise RuntimeError("conflicting record disappeared")
    return existing, False


def list_records(session: Session, limit: int, offset: int) -> tuple[list[BioRecord], int]:
    """Return a page of records ordered by ``created_at`` descending, plus the total."""
    total = session.execute(select(func.count()).select_from(BioRecord)).scalar_one()
    stmt = (
        select(BioRecord)
        .order_by(BioRecord.created_at.desc(), BioRecord.id.desc())
        .limit(limit)
        .offset(offset)
    )
    items = list(session.execute(stmt).scalars().all())
    return items, total
