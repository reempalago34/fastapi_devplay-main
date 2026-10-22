"""Valores lógicos equivalentes a los `String` del schema.prisma de devplay-main.

El proyecto Next.js no usa enums nativos de Prisma: todo es String validado en la
app. Aquí se mantienen como StrEnum para validar en Pydantic y en la BD seguir
usando TEXT (paridad 1:1 con la tabla original).
"""

from enum import StrEnum


class UserRole(StrEnum):
    USER = "USER"


class PostType(StrEnum):
    POST = "POST"
    BETA = "BETA"
    STREAM = "STREAM"
    POLL = "POLL"
    # Tipos que solo usa el cliente Flutter (los acepta el API para que el
    # frontend pueda crear posts de ese tipo sin recibir un 422).
    GAME_SHOWCASE = "GAME_SHOWCASE"
    DEV_LOG = "DEV_LOG"
    UPDATE = "UPDATE"
    ANNOUNCEMENT = "ANNOUNCEMENT"


class BetaStatus(StrEnum):
    ALPHA = "alpha"
    CLOSED_BETA = "closed_beta"
    OPEN_BETA = "open_beta"
    TECH_TEST = "tech_test"
    EARLY_ACCESS = "early_access"
    ENDED = "ended"
    COMING_SOON = "coming_soon"


class DownloadType(StrEnum):
    DIRECT = "DIRECT"
    LINK = "LINK"


class StreamPlatform(StrEnum):
    TWITCH = "TWITCH"
    YOUTUBE = "YOUTUBE"
    KICK = "KICK"


class NotificationType(StrEnum):
    LIVE = "LIVE"
    FOLLOW = "FOLLOW"
    COMMENT = "COMMENT"
    LIKE = "LIKE"


class ReportType(StrEnum):
    POST = "POST"
    USER = "USER"
    COMMENT = "COMMENT"
    BETA = "BETA"


class ReportReason(StrEnum):
    SPAM = "spam"
    HARASSMENT = "harassment"
    INAPPROPRIATE = "inappropriate"
    IMPERSONATION = "impersonation"
    OTHER = "other"
    # Motivos que usa el cliente Flutter (no estaban en el API original).
    HATE_SPEECH = "hate_speech"
    MISINFORMATION = "misinformation"
    NSFW = "nsfw"
    COPYRIGHT = "copyright"
    MALWARE = "malware"
    FAKE_ACCOUNT = "fake_account"
    OFF_TOPIC = "off_topic"


class ReportStatus(StrEnum):
    PENDING = "pending"
    REVIEWED = "reviewed"
    RESOLVED = "resolved"


class StoreCategory(StrEnum):
    POWERUP = "powerup"
    AVATAR = "avatar"
    PREMIUM = "premium"
    BUNDLE = "bundle"


class CoinTransactionType(StrEnum):
    PURCHASE = "purchase"
    REWARD = "reward"
    BONUS = "bonus"
    ADMIN = "admin"


class MediaKind(StrEnum):
    IMAGE = "image"
    VIDEO = "video"
