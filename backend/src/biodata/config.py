"""Application settings loaded from the environment."""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration.

    Values come from environment variables (or a local ``.env`` file).
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = Field(
        default="postgresql+psycopg://biodata:biodata@localhost:5433/biodata",
        validation_alias="DATABASE_URL",
    )
    # ``NoDecode`` stops pydantic-settings from JSON-decoding the raw env value
    # before validators run, so the comma separated form below is what reaches
    # ``_split_origins``.
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000"],
        validation_alias="CORS_ORIGINS",
    )
    log_level: str = Field(default="INFO", validation_alias="LOG_LEVEL")
    host: str = Field(default="0.0.0.0", validation_alias="HOST")
    port: int = Field(default=8000, validation_alias="PORT")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        """Accept a comma separated string as well as a real list.

        A JSON array is also tolerated so that a value carried over from the
        pre-``NoDecode`` behaviour does not silently parse into one nonsense
        origin that would then never match any browser ``Origin`` header.
        """
        if isinstance(value, str):
            candidate = value.strip()
            if candidate.startswith("["):
                try:
                    decoded = json.loads(candidate)
                except json.JSONDecodeError:
                    raise ValueError(
                        "CORS_ORIGINS looks like a JSON array but is not valid JSON; "
                        "use a comma separated list instead"
                    ) from None
                if not isinstance(decoded, list):
                    raise ValueError("CORS_ORIGINS JSON value must be an array of strings")
                return [str(item).strip() for item in decoded if str(item).strip()]
            return [item.strip() for item in candidate.split(",") if item.strip()]
        return value

    @field_validator("log_level")
    @classmethod
    def _upper_log_level(cls, value: str) -> str:
        return value.upper()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the process-wide settings singleton."""
    return Settings()
