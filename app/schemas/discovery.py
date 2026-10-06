from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import ORMModel
from app.schemas.content import AuthorSummary, PostOut


class UserSearchItem(ORMModel):
    """Usuario en resultados de búsqueda y en las recomendaciones de Discover."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    username: str
    full_name: str | None = Field(default=None, alias="fullName")
    bio: str | None = None
    avatar: str | None = None
    role: str = "USER"
    followers_count: int = Field(default=0, alias="followersCount")
    posts_count: int = Field(default=0, alias="postsCount")


class SearchOut(BaseModel):
    """GET /search — lo que consume el buscador del header."""

    model_config = ConfigDict(populate_by_name=True)

    q: str
    users: list[UserSearchItem] = Field(default_factory=list)
    posts: list[PostOut] = Field(default_factory=list)


class BetaCard(ORMModel):
    """Beta en la sección "populares" de Discover (más ligero que BetaOut)."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    post_id: str = Field(alias="postId")
    title: str
    description: str | None = None
    cover_image: str | None = Field(default=None, alias="coverImage")
    downloads: int = 0
    genre: str | None = None
    version: str | None = None
    author: AuthorSummary | None = None
    likes_count: int = Field(default=0, alias="likesCount")


class TagCount(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    tag: str
    count: int


class DiscoverOut(BaseModel):
    """GET /discover — agregador de la pantalla Descubrir."""

    model_config = ConfigDict(populate_by_name=True)

    trending: list[PostOut] = Field(default_factory=list)
    recommended_users: list[UserSearchItem] = Field(default_factory=list, alias="recommendedUsers")
    popular_betas: list[BetaCard] = Field(default_factory=list, alias="popularBetas")
    popular_tags: list[TagCount] = Field(default_factory=list, alias="popularTags")
    recent: list[PostOut] = Field(default_factory=list)
