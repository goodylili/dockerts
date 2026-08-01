from fastapi import FastAPI
from pydantic import BaseModel

from . import __version__
from .config import Settings


class Health(BaseModel):
    status: str
    version: str
    env: str


class Greeting(BaseModel):
    message: str


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    app = FastAPI(title="dockerts", version=__version__)

    @app.get("/healthz", response_model=Health)
    def healthz() -> Health:
        return Health(status="ok", version=__version__, env=settings.env)

    @app.get("/hello/{name}", response_model=Greeting)
    def hello(name: str) -> Greeting:
        return Greeting(message=f"Hello, {name}!")

    return app


app = create_app()
