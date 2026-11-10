"""Pydantic v2 request and response schemas."""

from __future__ import annotations

import datetime as dt
from decimal import Decimal
from enum import StrEnum
from typing import Annotated, Any
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    computed_field,
    field_serializer,
    field_validator,
)

MAX_AGE_YEARS = 130


class Sex(StrEnum):
    """Allowed values for the ``sex`` field."""

    MALE = "male"
    FEMALE = "female"
    INTERSEX = "intersex"
    PREFER_NOT_TO_SAY = "prefer_not_to_say"


class BloodType(StrEnum):
    """Allowed ABO/Rh blood types."""

    A_POS = "A+"
    A_NEG = "A-"
    B_POS = "B+"
    B_NEG = "B-"
    AB_POS = "AB+"
    AB_NEG = "AB-"
    O_POS = "O+"
    O_NEG = "O-"


def calculate_age(date_of_birth: dt.date, today: dt.date | None = None) -> int:
    """Return whole years elapsed between ``date_of_birth`` and ``today``."""
    reference = today or dt.date.today()
    years = reference.year - date_of_birth.year
    if (reference.month, reference.day) < (date_of_birth.month, date_of_birth.day):
        years -= 1
    return years


def calculate_bmi(height_cm: float, weight_kg: float) -> float:
    """Return the body mass index rounded to one decimal place."""
    height_m = height_cm / 100
    return round(weight_kg / (height_m * height_m), 1)


class BioRecordCreate(BaseModel):
    """Writable payload for creating a biodata record."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    full_name: Annotated[str, Field(min_length=1, max_length=200)]
    email: EmailStr
    phone: Annotated[str | None, Field(default=None, max_length=32)] = None
    date_of_birth: dt.date
    sex: Sex
    height_cm: Annotated[float, Field(ge=30, le=300)]
    weight_kg: Annotated[float, Field(ge=2, le=650)]
    blood_type: BloodType | None = None
    allergies: Annotated[str | None, Field(default=None, max_length=2000)] = None
    medical_notes: Annotated[str | None, Field(default=None, max_length=5000)] = None
    country: Annotated[str | None, Field(default=None, min_length=2, max_length=2)] = None

    @field_validator("email")
    @classmethod
    def _lowercase_email(cls, value: str) -> str:
        return value.lower()

    @field_validator("country")
    @classmethod
    def _normalise_country(cls, value: str | None) -> str | None:
        if value is None:
            return None
        upper = value.upper()
        if not upper.isalpha():
            raise ValueError("country must be an ISO-3166 alpha-2 code")
        return upper

    @field_validator("phone", "allergies", "medical_notes")
    @classmethod
    def _empty_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value or None

    @field_validator("full_name")
    @classmethod
    def _non_blank_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("full_name must not be blank")
        return value

    @field_validator("date_of_birth")
    @classmethod
    def _dob_in_past(cls, value: dt.date) -> dt.date:
        today = dt.date.today()
        if value >= today:
            raise ValueError("date_of_birth must be in the past")
        if calculate_age(value, today) > MAX_AGE_YEARS:
            raise ValueError(f"date_of_birth implies an age above {MAX_AGE_YEARS}")
        return value

    def canonical(self) -> dict[str, Any]:
        """Return a stable, JSON-serialisable view used for idempotency hashing."""
        return self.model_dump(mode="json")


class BioRecordRead(BaseModel):
    """Public representation of a stored biodata record."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str
    email: str
    phone: str | None
    date_of_birth: dt.date
    sex: str
    height_cm: float
    weight_kg: float
    blood_type: str | None
    allergies: str | None
    medical_notes: str | None
    country: str | None
    created_at: dt.datetime
    updated_at: dt.datetime

    @field_validator("height_cm", "weight_kg", mode="before")
    @classmethod
    def _decimal_to_float(cls, value: object) -> object:
        if isinstance(value, Decimal):
            return float(value)
        return value

    @computed_field  # type: ignore[prop-decorator]
    @property
    def age(self) -> int:
        """Whole years since ``date_of_birth``."""
        return calculate_age(self.date_of_birth)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def bmi(self) -> float:
        """Body mass index to one decimal place."""
        return calculate_bmi(self.height_cm, self.weight_kg)

    @field_serializer("created_at", "updated_at")
    def _serialize_timestamp(self, value: dt.datetime) -> str:
        if value.tzinfo is None:
            value = value.replace(tzinfo=dt.UTC)
        return value.astimezone(dt.UTC).isoformat().replace("+00:00", "Z")


class BioRecordPage(BaseModel):
    """A paginated slice of biodata records."""

    items: list[BioRecordRead]
    total: int
    limit: int
    offset: int


class ErrorBody(BaseModel):
    """Machine readable error payload nested under ``detail``."""

    code: str
    message: str
