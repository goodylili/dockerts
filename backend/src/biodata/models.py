"""SQLAlchemy 2.0 declarative models."""

from __future__ import annotations

import datetime as dt
import uuid
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

SEX_VALUES = ("male", "female", "intersex", "prefer_not_to_say")
BLOOD_TYPE_VALUES = ("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-")


def _in_list(column: str, values: tuple[str, ...]) -> str:
    rendered = ", ".join(f"'{value}'" for value in values)
    return f"{column} IN ({rendered})"


class Base(DeclarativeBase):
    """Declarative base class for all models."""


class BioRecord(Base):
    """A single submitted biodata record."""

    __tablename__ = "bio_records"
    __table_args__ = (
        UniqueConstraint("idempotency_key", name="uq_bio_records_idempotency_key"),
        Index("ix_bio_records_created_at", "created_at"),
        CheckConstraint(
            "char_length(full_name) BETWEEN 1 AND 200",
            name="ck_bio_records_full_name_length",
        ),
        CheckConstraint("phone IS NULL OR char_length(phone) <= 32", name="ck_bio_records_phone"),
        CheckConstraint("date_of_birth < CURRENT_DATE", name="ck_bio_records_dob_past"),
        CheckConstraint(_in_list("sex", SEX_VALUES), name="ck_bio_records_sex"),
        CheckConstraint("height_cm BETWEEN 30 AND 300", name="ck_bio_records_height_cm"),
        CheckConstraint("weight_kg BETWEEN 2 AND 650", name="ck_bio_records_weight_kg"),
        CheckConstraint(
            f"blood_type IS NULL OR {_in_list('blood_type', BLOOD_TYPE_VALUES)}",
            name="ck_bio_records_blood_type",
        ),
        CheckConstraint(
            "allergies IS NULL OR char_length(allergies) <= 2000",
            name="ck_bio_records_allergies",
        ),
        CheckConstraint(
            "medical_notes IS NULL OR char_length(medical_notes) <= 5000",
            name="ck_bio_records_medical_notes",
        ),
        CheckConstraint(
            "country IS NULL OR country ~ '^[A-Z]{2}$'",
            name="ck_bio_records_country",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    idempotency_key: Mapped[str] = mapped_column(Text, nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    phone: Mapped[str | None] = mapped_column(Text, nullable=True)
    date_of_birth: Mapped[dt.date] = mapped_column(Date, nullable=False)
    sex: Mapped[str] = mapped_column(Text, nullable=False)
    height_cm: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    weight_kg: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    blood_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    allergies: Mapped[str | None] = mapped_column(Text, nullable=True)
    medical_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    country: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
