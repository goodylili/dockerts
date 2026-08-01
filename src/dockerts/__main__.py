import uvicorn

from .config import Settings


def main() -> None:
    settings = Settings.from_env()
    uvicorn.run("dockerts.app:app", host=settings.host, port=settings.port)


if __name__ == "__main__":
    main()
