from contextlib import asynccontextmanager
from datetime import datetime
from typing import AsyncIterator

from fastapi import FastAPI, Response, status
from pydantic import BaseModel, Field, field_validator

from . import __version__
from .config import Settings
from .db import Database


class Health(BaseModel):
    status: str
    version: str
    env: str


class Greeting(BaseModel):
    message: str


class ContactIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=5, max_length=32)

    @field_validator("name", "phone")
    @classmethod
    def strip(cls, value: str) -> str:
        return value.strip()


class Contact(BaseModel):
    id: int
    name: str
    phone: str
    created_at: datetime

    model_config = {"from_attributes": True}


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    db = Database(settings.database_url)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        db.close()

    app = FastAPI(title="dockerts", version=__version__, lifespan=lifespan)

    @app.get("/healthz", response_model=Health)
    def healthz() -> Health:
        return Health(status="ok", version=__version__, env=settings.env)

    @app.get("/hello/{name}", response_model=Greeting)
    def hello(name: str) -> Greeting:
        return Greeting(message=f"Hello, {name}!")

    @app.post("/contacts", response_model=Contact, status_code=status.HTTP_201_CREATED)
    def create_contact(payload: ContactIn, response: Response) -> Contact:
        record, created = db.save_contact(payload.name, payload.phone)
        if not created:
            # Replay of an existing (name, phone): same result, no new row.
            response.status_code = status.HTTP_200_OK
        return Contact.model_validate(record)

    @app.get("/contacts", response_model=list[Contact])
    def list_contacts() -> list[Contact]:
        return [Contact.model_validate(r) for r in db.list_contacts()]

    return app
