"""Settings parsing tests.

``CORS_ORIGINS`` is a ``list[str]``, and pydantic-settings JSON-decodes complex
fields straight from the environment *before* validators run. Without
``NoDecode`` the contract's documented comma separated form raises
``SettingsError`` at import time and the service never starts, so these cases
guard a startup-blocking regression rather than a cosmetic one.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from biodata.config import Settings


def test_single_origin_comma_form() -> None:
    """The exact value the contract and docker-compose ship."""
    settings = Settings(_env_file=None, CORS_ORIGINS="http://localhost:3000")  # type: ignore[call-arg]
    assert settings.cors_origins == ["http://localhost:3000"]


def test_multiple_origins_are_split_and_stripped() -> None:
    settings = Settings(_env_file=None, CORS_ORIGINS="http://a.com, http://b.com ,")  # type: ignore[call-arg]
    assert settings.cors_origins == ["http://a.com", "http://b.com"]


def test_json_array_is_still_accepted() -> None:
    """Tolerated so an old-style value does not become one nonsense origin."""
    settings = Settings(  # type: ignore[call-arg]
        _env_file=None,
        CORS_ORIGINS='["http://json.com","http://j2.com"]',
    )
    assert settings.cors_origins == ["http://json.com", "http://j2.com"]


def test_malformed_json_array_is_rejected_loudly() -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, CORS_ORIGINS="[not valid json")  # type: ignore[call-arg]


def test_default_origin_when_unset() -> None:
    settings = Settings(_env_file=None)
    assert settings.cors_origins == ["http://localhost:3000"]


def test_log_level_is_upper_cased() -> None:
    settings = Settings(_env_file=None, LOG_LEVEL="debug")  # type: ignore[call-arg]
    assert settings.log_level == "DEBUG"
