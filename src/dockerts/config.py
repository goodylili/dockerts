import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    host: str
    port: int
    env: str
    database_url: str

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            host=os.getenv("HOST", "0.0.0.0"),
            port=int(os.getenv("PORT", "8000")),
            env=os.getenv("APP_ENV", "development"),
            database_url=os.getenv(
                "DATABASE_URL",
                "postgresql://app:app@localhost:5432/dockerts",
            ),
        )
