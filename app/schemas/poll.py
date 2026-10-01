from datetime import datetime

from pydantic import Field, field_validator

from app.schemas.base import ORMModel


class PollOptionIn(ORMModel):
    """Una opción al crear la encuesta."""

    text: str = Field(min_length=1, max_length=200)

    @field_validator("text")
    @classmethod
    def _strip(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Option text cannot be empty")
        return stripped


class PollCreate(ORMModel):
    """Payload de POST /posts/{id}/poll. Crea la encuesta y sus opciones."""

    question: str = Field(min_length=1, max_length=500)
    options: list[PollOptionIn] = Field(min_length=2, max_length=10)
    allow_multiple: bool = False
    closes_at: datetime | None = None

    @field_validator("question")
    @classmethod
    def _strip_question(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Question cannot be empty")
        return stripped

    @field_validator("options")
    @classmethod
    def _no_duplicates(cls, value: list[PollOptionIn]) -> list[PollOptionIn]:
        texts = [o.text.lower() for o in value]
        if len(texts) != len(set(texts)):
            raise ValueError("Options must be unique")
        return value


class PollVoteIn(ORMModel):
    """Payload de POST /polls/{id}/vote.

    Una opción para votos simples, varias para `allowMultiple`.
    """

    option_ids: list[str] = Field(min_length=1, max_length=10)


class PollOptionOut(ORMModel):
    id: str
    text: str
    position: int
    vote_count: int


class PollOut(ORMModel):
    id: str
    post_id: str
    question: str
    allow_multiple: bool
    closes_at: datetime | None = None
    options: list[PollOptionOut] = Field(default_factory=list)
    total_votes: int = 0
    is_closed: bool = False
    voted_option_ids: list[str] = Field(default_factory=list)
    created_at: datetime


class PollVoteResult(ORMModel):
    poll: PollOut
    """Voto registrado (o reemplazado)."""

    created: bool


__all__ = [
    "PollCreate",
    "PollOptionIn",
    "PollOptionOut",
    "PollOut",
    "PollVoteIn",
    "PollVoteResult",
]