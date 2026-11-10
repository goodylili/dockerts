"""Pure validation tests — these never touch the database."""

from __future__ import annotations

import datetime as dt
from typing import Any

import pytest
from pydantic import ValidationError

from biodata.schemas import BioRecordCreate, BioRecordRead, calculate_age, calculate_bmi
from biodata.service import request_hash
from tests.conftest import sample_payload


def test_valid_payload_normalises_email_and_country() -> None:
    record = BioRecordCreate.model_validate(sample_payload(email="ADA@Example.COM", country="ng"))
    assert record.email == "ada@example.com"
    assert record.country == "NG"


def test_future_date_of_birth_is_rejected() -> None:
    future = (dt.date.today() + dt.timedelta(days=1)).isoformat()
    with pytest.raises(ValidationError, match="date_of_birth must be in the past"):
        BioRecordCreate.model_validate(sample_payload(date_of_birth=future))


def test_today_date_of_birth_is_rejected() -> None:
    with pytest.raises(ValidationError):
        BioRecordCreate.model_validate(sample_payload(date_of_birth=dt.date.today().isoformat()))


def test_age_above_130_is_rejected() -> None:
    ancient = (dt.date.today() - dt.timedelta(days=365 * 140)).isoformat()
    with pytest.raises(ValidationError, match="age above 130"):
        BioRecordCreate.model_validate(sample_payload(date_of_birth=ancient))


@pytest.mark.parametrize("sex", ["Male", "unknown", "", "f"])
def test_invalid_sex_is_rejected(sex: str) -> None:
    with pytest.raises(ValidationError):
        BioRecordCreate.model_validate(sample_payload(sex=sex))


@pytest.mark.parametrize("blood_type", ["C+", "o+", "AB", "0-"])
def test_invalid_blood_type_is_rejected(blood_type: str) -> None:
    with pytest.raises(ValidationError):
        BioRecordCreate.model_validate(sample_payload(blood_type=blood_type))


@pytest.mark.parametrize("height", [29.9, 0, 300.1, -5])
def test_out_of_range_height_is_rejected(height: float) -> None:
    with pytest.raises(ValidationError):
        BioRecordCreate.model_validate(sample_payload(height_cm=height))


@pytest.mark.parametrize("weight", [1.9, 0, 650.1, -1])
def test_out_of_range_weight_is_rejected(weight: float) -> None:
    with pytest.raises(ValidationError):
        BioRecordCreate.model_validate(sample_payload(weight_kg=weight))


@pytest.mark.parametrize(
    "field,value",
    [
        ("full_name", ""),
        ("full_name", "   "),
        ("full_name", "x" * 201),
        ("email", "not-an-email"),
        ("phone", "9" * 33),
        ("allergies", "a" * 2001),
        ("medical_notes", "m" * 5001),
        ("country", "NGA"),
        ("country", "N"),
        ("country", "N1"),
    ],
)
def test_field_constraints(field: str, value: Any) -> None:
    with pytest.raises(ValidationError):
        BioRecordCreate.model_validate(sample_payload(**{field: value}))


def test_unknown_fields_are_rejected() -> None:
    with pytest.raises(ValidationError):
        BioRecordCreate.model_validate(sample_payload(id="1234"))


def test_optional_fields_may_be_omitted() -> None:
    payload = sample_payload()
    for optional in ("phone", "blood_type", "allergies", "medical_notes", "country"):
        payload.pop(optional)
    record = BioRecordCreate.model_validate(payload)
    assert record.phone is None
    assert record.blood_type is None


def test_calculate_age_respects_birthday() -> None:
    dob = dt.date(1990, 5, 2)
    assert calculate_age(dob, dt.date(2026, 5, 1)) == 35
    assert calculate_age(dob, dt.date(2026, 5, 2)) == 36


def test_calculate_bmi_rounds_to_one_decimal() -> None:
    assert calculate_bmi(170.0, 62.5) == 21.6


def test_read_model_exposes_age_and_bmi_and_hides_request_hash() -> None:
    now = dt.datetime(2026, 8, 8, 10, 0, tzinfo=dt.UTC)
    data = {
        **sample_payload(),
        "id": "11111111-1111-1111-1111-111111111111",
        "request_hash": "deadbeef",
        "created_at": now,
        "updated_at": now,
    }
    dumped = BioRecordRead.model_validate(data).model_dump(mode="json")
    assert dumped["bmi"] == 21.6
    assert dumped["age"] == calculate_age(dt.date(1990, 5, 2))
    assert "request_hash" not in dumped
    assert dumped["created_at"] == "2026-08-08T10:00:00Z"


def test_request_hash_is_stable_and_order_independent() -> None:
    base = BioRecordCreate.model_validate(sample_payload())
    reordered = BioRecordCreate.model_validate(dict(reversed(list(sample_payload().items()))))
    changed = BioRecordCreate.model_validate(sample_payload(weight_kg=63.0))
    assert request_hash(base) == request_hash(reordered)
    assert request_hash(base) != request_hash(changed)
