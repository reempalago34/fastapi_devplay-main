"""Todos los modelos deben importarse aquí para que el registry de SQLAlchemy
resuelva los relationship() por nombre de clase."""

from app.models.auth import AccountDeletionCode, LoginCode, LoginEvent
from app.models.base import Base
from app.models.beta import Beta
from app.models.chat import ChatMessage, DirectMessage, Notification
from app.models.content import Bookmark, Comment, Like, Post
from app.models.poll import Poll, PollOption, PollVote
from app.models.social import Block, Follow, Report
from app.models.store import DevCoinTransaction, StoreItem, StorePurchase
from app.models.stream import Stream
from app.models.user import User

__all__ = [
    "Base",
    "User",
    "LoginCode",
    "AccountDeletionCode",
    "LoginEvent",
    "Follow",
    "Block",
    "Report",
    "Post",
    "Comment",
    "Like",
    "Bookmark",
    "Poll",
    "PollOption",
    "PollVote",
    "Beta",
    "Stream",
    "Notification",
    "ChatMessage",
    "DirectMessage",
    "StoreItem",
    "StorePurchase",
    "DevCoinTransaction",
]
