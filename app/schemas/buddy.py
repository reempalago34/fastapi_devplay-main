from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class BuddyMessage(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class BuddyIn(BaseModel):
    """POST /buddy — historial corto de la conversación con Pixel."""

    model_config = ConfigDict(populate_by_name=True)

    messages: list[BuddyMessage] = Field(default_factory=list, max_length=40)


class BuddyAction(BaseModel):
    """Poder de Pixel: cambiar de vista o ejecutar un gesto en el frontend."""

    model_config = ConfigDict(populate_by_name=True)

    type: Literal["go", "gesture"]
    value: str


class BuddyOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    reply: str
    actions: list[BuddyAction] = Field(default_factory=list)
