from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    """Base para schemas devueltos desde modelos SQLAlchemy."""

    model_config = ConfigDict(from_attributes=True)
