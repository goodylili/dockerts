import uvicorn

from .config import Settings


def main() -> None:
    settings = Settings.from_env()
    # Factory mode: the app connects to Postgres on creation, so it must not be
    # built at import time.
    uvicorn.run(
        "dockerts.app:create_app",
        factory=True,
        host=settings.host,
        port=settings.port,
    )


if __name__ == "__main__":
    main()
