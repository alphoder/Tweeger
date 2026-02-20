from __future__ import annotations

from pymongo import MongoClient
from pymongo.database import Database

from config.settings import settings

_client: MongoClient | None = None
_db: Database | None = None


def get_database() -> Database:
    """Get or create the MongoDB connection."""
    global _client, _db
    if _db is None:
        _client = MongoClient(settings.MONGO_URI)
        _db = _client[settings.MONGO_DB_NAME]
        _setup_indexes(_db)
    return _db


def close_connection():
    """Close the MongoDB connection."""
    global _client, _db
    if _client:
        _client.close()
        _client = None
        _db = None


def _setup_indexes(db: Database):
    """Create indexes for performance."""
    # Drafts — lookup by status
    db.drafts.create_index("status")
    db.drafts.create_index("created_at")

    # Queue — lookup by scheduled time and status
    db.queue.create_index([("scheduled_time", 1), ("status", 1)])

    # Posted — lookup by tweet id, date
    db.posted.create_index("tweet_id", unique=True, sparse=True)
    db.posted.create_index("posted_at")

    # Events — lookup by date
    db.events.create_index("event_date")
    db.events.create_index("created_at")

    # Analytics — lookup by date
    db.analytics.create_index("recorded_at")
    db.analytics.create_index("type")
