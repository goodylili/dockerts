"""create bio_records

Revision ID: 0001
Revises:
Create Date: 2026-08-08

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SEX_VALUES = ("male", "female", "intersex", "prefer_not_to_say")
BLOOD_TYPE_VALUES = ("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-")


def _in_list(column: str, values: Sequence[str]) -> str:
    rendered = ", ".join(f"'{value}'" for value in values)
    return f"{column} IN ({rendered})"


def upgrade() -> None:
    op.create_table(
        "bio_records",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("idempotency_key", sa.Text(), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("full_name", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("phone", sa.Text(), nullable=True),
        sa.Column("date_of_birth", sa.Date(), nullable=False),
        sa.Column("sex", sa.Text(), nullable=False),
        sa.Column("height_cm", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("weight_kg", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("blood_type", sa.Text(), nullable=True),
        sa.Column("allergies", sa.Text(), nullable=True),
        sa.Column("medical_notes", sa.Text(), nullable=True),
        sa.Column("country", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("idempotency_key", name="uq_bio_records_idempotency_key"),
        sa.CheckConstraint(
            "char_length(full_name) BETWEEN 1 AND 200",
            name="ck_bio_records_full_name_length",
        ),
        sa.CheckConstraint("phone IS NULL OR char_length(phone) <= 32", name="ck_bio_records_phone"),
        sa.CheckConstraint("date_of_birth < CURRENT_DATE", name="ck_bio_records_dob_past"),
        sa.CheckConstraint(_in_list("sex", SEX_VALUES), name="ck_bio_records_sex"),
        sa.CheckConstraint("height_cm BETWEEN 30 AND 300", name="ck_bio_records_height_cm"),
        sa.CheckConstraint("weight_kg BETWEEN 2 AND 650", name="ck_bio_records_weight_kg"),
        sa.CheckConstraint(
            f"blood_type IS NULL OR {_in_list('blood_type', BLOOD_TYPE_VALUES)}",
            name="ck_bio_records_blood_type",
        ),
        sa.CheckConstraint(
            "allergies IS NULL OR char_length(allergies) <= 2000",
            name="ck_bio_records_allergies",
        ),
        sa.CheckConstraint(
            "medical_notes IS NULL OR char_length(medical_notes) <= 5000",
            name="ck_bio_records_medical_notes",
        ),
        sa.CheckConstraint(
            "country IS NULL OR country ~ '^[A-Z]{2}$'",
            name="ck_bio_records_country",
        ),
    )
    op.create_index("ix_bio_records_created_at", "bio_records", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_bio_records_created_at", table_name="bio_records")
    op.drop_table("bio_records")
