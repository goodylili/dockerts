"""Business logic for biodata records."""

from __future__ import annotations

import hashlib
import json
import logging
import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from biodata import repository
from biodata.models import BioRecord
from biodata.schemas import BioRecordCreate

logger = logging.getLogger(__name__)

_TWO_PLACES = Decimal("0.01")


class IdempotencyKeyReuseError(Exception):
    """Raised when a known idempotency key is replayed with a different body."""

    code = "idempotency_key_reuse"

    def __init__(self, key: str) -> None:
        super().__init__(f"Idempotency-Key {key!r} was already used with a different request body.")
        self.key = key


class RecordNotFoundError(Exception):
    """Raised when a record id does not exist."""

    code = "not_found"

    def __init__(self, record_id: uuid.UUID) -> None:
        super().__init__(f"No bio record with id {record_id}.")
        self.record_id = record_id


def request_hash(payload: BioRecordCreate) -> str:
    """Return a stable SHA-256 hash of the canonical request payload."""
    canonical = json.dumps(payload.canonical(), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _to_values(payload: BioRecordCreate, key: str, digest: str) -> dict[str, Any]:
    return {
        "idempotency_key": key,
        "request_hash": digest,
        "full_name": payload.full_name,
        "email": payload.email,
        "phone": payload.phone,
        "date_of_birth": payload.date_of_birth,
        "sex": payload.sex.value,
        "height_cm": Decimal(str(payload.height_cm)).quantize(_TWO_PLACES),
        "weight_kg": Decimal(str(payload.weight_kg)).quantize(_TWO_PLACES),
        "blood_type": payload.blood_type.value if payload.blood_type else None,
        "allergies": payload.allergies,
        "medical_notes": payload.medical_notes,
        "country": payload.country,
    }


def create_record(
    session: Session, payload: BioRecordCreate, idempotency_key: str
) -> tuple[BioRecord, bool]:
    """Create a record idempotently.

    Returns the stored record and ``True`` when this call created it, ``False``
    when it was an exact replay of an earlier request.

    Raises :class:`IdempotencyKeyReuseError` when the key was previously used
    with a different body.
    """
    digest = request_hash(payload)
    record, created = repository.insert_if_absent(
        session, _to_values(payload, idempotency_key, digest)
    )
    if created:
        logger.info(
            "bio record created",
            extra={"record_id": str(record.id), "idempotency_key": idempotency_key},
        )
        return record, True

    if record.request_hash != digest:
        logger.warning(
            "idempotency key reused with a different body",
            extra={"idempotency_key": idempotency_key},
        )
        raise IdempotencyKeyReuseError(idempotency_key)

    logger.info(
        "bio record replay",
        extra={"record_id": str(record.id), "idempotency_key": idempotency_key},
    )
    return record, False


def get_record(session: Session, record_id: uuid.UUID) -> BioRecord:
    """Return a record by id or raise :class:`RecordNotFoundError`."""
    record = repository.get_by_id(session, record_id)
    if record is None:
        raise RecordNotFoundError(record_id)
    return record


def list_records(session: Session, limit: int, offset: int) -> tuple[list[BioRecord], int]:
    """Return a page of records plus the total row count."""
    return repository.list_records(session, limit=limit, offset=offset)
