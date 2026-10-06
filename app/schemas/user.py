from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.base import ORMModel
from app.utils.json_fields import loads_json


def _parse_tags(value):
    if isinstance(value, str):
        parsed = loads_json(value, [])
        return parsed if isinstance(parsed, list) else []
    return value


class UserMe(ORMModel):
    id: str
    email: EmailStr
    username: str
    full_name: str | None = None
    bio: str | None = None
    avatar: str | None = None
    banner: str | None = None
    role: str
    language: str
    is_guest: bool
    is_private: bool
    tour_completed: bool
    dev_coins: int
    location: str | None = None
    website: str | None = None
    profession: str | None = None
    tags: list[str] | None = None
    created_at: datetime
    updated_at: datetime

    @field_validator("tags", mode="before")
    @classmethod
    def _parse_tags_field(cls, value):
        return _parse_tags(value)


class UserPublic(ORMModel):
    """Perfil mínimo (lo que ve cualquier visitante)."""

    id: str
    username: str
    full_name: str | None = None
    bio: str | None = None
    avatar: str | None = None
    role: str
    is_private: bool
    created_at: datetime


# --- Perfil público completo /users/{id} ---


class ProfileUser(BaseModel):
    id: str
    username: str
    full_name: str | None = None
    bio: str | None = None
    avatar: str | None = None
    banner: str | None = None
    role: str
    is_guest: bool
    tags: list[str] | None = None
    location: str | None = None
    website: str | None = None
    profession: str | None = None
    birth_date: datetime | None = None
    social_links: str | None = None
    last_seen: datetime | None = None
    created_at: datetime
    followers_count: int = Field(default=0, alias="followersCount")
    following_count: int = Field(default=0, alias="followingCount")
    posts_count: int = Field(default=0, alias="postsCount")
    is_following: bool = Field(default=False, alias="isFollowing")
    is_blocked: bool = Field(default=False, alias="isBlocked")
    blocked_me: bool = Field(default=False, alias="blockedMe")

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("tags", mode="before")
    @classmethod
    def _tags(cls, value):
        return _parse_tags(value)


class AuthorOut(BaseModel):
    id: str
    username: str
    avatar: str | None = None
    role: str
    tags: list[str] | None = None

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("tags", mode="before")
    @classmethod
    def _tags(cls, value):
        return _parse_tags(value)


class BetaOut(ORMModel):
    """Ficha de beta serializada igual que `normalizeBeta` de devplay-main."""

    id: str
    post_id: str = Field(alias="postId")
    title: str
    description: str
    download_type: str = Field(alias="downloadType")
    file_url: str | None = Field(default=None, alias="fileUrl")
    file_size: int | None = Field(default=None, alias="fileSize")
    file_name: str | None = Field(default=None, alias="fileName")
    external_url: str | None = Field(default=None, alias="externalUrl")
    beta_status: str = Field(alias="betaStatus")
    genre: str | None = None
    version: str | None = None
    platforms: list[str] | None = None
    tags: list[str] | None = None
    requirements: str | None = None
    changelog: str | None = None
    install_instructions: str | None = Field(default=None, alias="installInstructions")
    cover_image: str | None = Field(default=None, alias="coverImage")
    screenshots: list[str] | None = None
    external_platform: str | None = Field(default=None, alias="externalPlatform")
    downloads: int
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    @field_validator("platforms", "tags", "screenshots", mode="before")
    @classmethod
    def _parse_json_field(cls, value):
        if isinstance(value, str):
            parsed = loads_json(value, [])
            return parsed if isinstance(parsed, list) else []
        return value


class StreamOut(ORMModel):
    id: str
    platform: str
    stream_url: str = Field(alias="streamUrl")
    embed_url: str = Field(alias="embedUrl")
    title: str
    is_live: bool = Field(alias="isLive")
    started_at: datetime | None = Field(default=None, alias="startedAt")
    ended_at: datetime | None = Field(default=None, alias="endedAt")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class RepostSummary(BaseModel):
    id: str
    type: str
    content: str | None = None
    media_urls: list[dict] = Field(default_factory=list, alias="mediaUrls")
    created_at: datetime = Field(alias="createdAt")
    author: AuthorOut
    beta: BetaOut | None = None
    stream: StreamOut | None = None
    likes_count: int = Field(default=0, alias="likesCount")
    comments_count: int = Field(default=0, alias="commentsCount")

    model_config = ConfigDict(populate_by_name=True)


class PostSummary(BaseModel):
    id: str
    type: str
    content: str | None = None
    media_urls: list[dict] = Field(default_factory=list, alias="mediaUrls")
    created_at: datetime = Field(alias="createdAt")
    author: AuthorOut
    beta: BetaOut | None = None
    stream: StreamOut | None = None
    repost_of: RepostSummary | None = Field(default=None, alias="repostOf")
    likes_count: int = Field(default=0, alias="likesCount")
    comments_count: int = Field(default=0, alias="commentsCount")
    reposts_count: int = Field(default=0, alias="repostsCount")
    liked: bool = False
    saved_at: datetime | None = Field(default=None, alias="savedAt")

    model_config = ConfigDict(populate_by_name=True)


class ProfileResponse(BaseModel):
    user: ProfileUser
    posts: list[PostSummary]


# --- Seguidores / seguidos ---


class FollowListUser(BaseModel):
    id: str
    username: str
    avatar: str | None = None
    bio: str | None = None
    role: str
    tags: list[str] | None = None
    followers_count: int = Field(default=0, alias="followersCount")
    posts_count: int = Field(default=0, alias="postsCount")
    followed_at: datetime = Field(alias="followedAt")

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("tags", mode="before")
    @classmethod
    def _tags(cls, value):
        return _parse_tags(value)


class FollowListResponse(BaseModel):
    total: int


class FollowersResponse(FollowListResponse):
    followers: list[FollowListUser]


class FollowingResponse(FollowListResponse):
    following: list[FollowListUser]


# --- /follow ---


class FollowRequest(BaseModel):
    followee_id: str = Field(alias="followeeId", min_length=1)

    model_config = ConfigDict(populate_by_name=True)


class FollowStatusResponse(BaseModel):
    following: bool
    followers_count: int = Field(alias="followersCount")
    following_count: int = Field(alias="followingCount")

    model_config = ConfigDict(populate_by_name=True)


class FollowActionResponse(BaseModel):
    following: bool


# --- /users/by-username ---


class UsernameLookupUser(BaseModel):
    id: str
    username: str


class UsernameLookupResponse(BaseModel):
    user: UsernameLookupUser | None


# --- stats / achievements / bookmarks ---


class ActivityDay(BaseModel):
    date: str
    count: int


class UserStats(BaseModel):
    posts: int
    comments: int
    likes: int
    betas: int
    followers: int
    following: int
    bookmarks: int
    total_downloads: int = Field(alias="totalDownloads")
    total_likes_received: int = Field(alias="totalLikesReceived")
    total_comments_received: int = Field(alias="totalCommentsReceived")
    points: int
    level: int
    points_for_next_level: int = Field(alias="pointsForNextLevel")
    progress_to_next: float = Field(alias="progressToNext")
    activity_by_day: list[ActivityDay] = Field(alias="activityByDay")

    model_config = ConfigDict(populate_by_name=True)


class StatsResponse(BaseModel):
    stats: UserStats | None


class Achievement(BaseModel):
    id: str
    label: str
    description: str
    emoji: str
    unlocked: bool
    progress: int
    target: int
    tier: str  # bronze | silver | gold | platinum


class AchievementsResponse(BaseModel):
    achievements: list[Achievement]
    total_unlocked: int = Field(alias="totalUnlocked")
    total: int

    model_config = ConfigDict(populate_by_name=True)


class BookmarkListResponse(BaseModel):
    posts: list[PostSummary]
