from __future__ import annotations

import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Central configuration loaded from environment variables."""

    # Telegram
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    TELEGRAM_ADMIN_ID: int = int(os.getenv("TELEGRAM_ADMIN_ID", "0"))

    # Twitter / X
    TWITTER_API_KEY: str = os.getenv("TWITTER_API_KEY", "")
    TWITTER_API_SECRET: str = os.getenv("TWITTER_API_SECRET", "")
    TWITTER_ACCESS_TOKEN: str = os.getenv("TWITTER_ACCESS_TOKEN", "")
    TWITTER_ACCESS_SECRET: str = os.getenv("TWITTER_ACCESS_SECRET", "")
    TWITTER_BEARER_TOKEN: str = os.getenv("TWITTER_BEARER_TOKEN", "")

    # Groq AI
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")

    # MongoDB
    MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    MONGO_DB_NAME: str = os.getenv("MONGO_DB_NAME", "sneaker_bot")

    # Brand
    BRAND_NAME: str = os.getenv("BRAND_NAME", "SoleStreet")
    BRAND_DESCRIPTION: str = os.getenv(
        "BRAND_DESCRIPTION",
        "Premium streetwear sneakers for the culture. Limited drops, bold designs.",
    )
    BRAND_TONE: str = os.getenv(
        "BRAND_TONE",
        "confident, streetwear culture, hype but not cringe, gen-z friendly",
    )
    BRAND_HASHTAGS: list[str] = os.getenv(
        "BRAND_HASHTAGS", "#SoleStreet,#Sneakers,#Streetwear"
    ).split(",")

    # Scheduler defaults
    POSTS_PER_DAY: int = int(os.getenv("POSTS_PER_DAY", "3"))
    OPTIMAL_HOURS: list[int] = [9, 13, 18, 21]  # Best engagement windows


settings = Settings()
