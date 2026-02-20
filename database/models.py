"""
MongoDB document schemas / helpers.

Collections:
  - drafts:     AI-generated tweet drafts pending user review
  - queue:      Approved tweets scheduled for posting
  - posted:     Published tweets with engagement data
  - events:     Upcoming festivals, drops, and events
  - analytics:  Daily account metrics snapshots
  - settings:   Bot runtime configuration
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


# ---------- Draft ----------
def make_draft(
    text: str,
    image_path: str | None = None,
    source: str = "manual",
    hashtags: list[str] | None = None,
    trend_context: str | None = None,
) -> dict[str, Any]:
    """Create a draft document."""
    return {
        "text": text,
        "image_path": image_path,
        "source": source,  # "image_upload", "trend", "event", "manual"
        "hashtags": hashtags or [],
        "trend_context": trend_context,
        "status": "pending",  # pending | approved | rejected | posted
        "created_at": datetime.now(timezone.utc),
        "reviewed_at": None,
    }


# ---------- Queue ----------
def make_queue_item(
    draft_id: str,
    text: str,
    image_path: str | None,
    scheduled_time: datetime,
    hashtags: list[str] | None = None,
) -> dict[str, Any]:
    """Create a queue document for scheduled posting."""
    return {
        "draft_id": draft_id,
        "text": text,
        "image_path": image_path,
        "hashtags": hashtags or [],
        "scheduled_time": scheduled_time,
        "status": "scheduled",  # scheduled | posting | posted | failed
        "created_at": datetime.now(timezone.utc),
        "posted_at": None,
        "tweet_id": None,
        "error": None,
    }


# ---------- Posted ----------
def make_posted(
    queue_id: str,
    tweet_id: str,
    text: str,
    image_path: str | None = None,
) -> dict[str, Any]:
    """Create a posted tweet record."""
    return {
        "queue_id": queue_id,
        "tweet_id": tweet_id,
        "text": text,
        "image_path": image_path,
        "posted_at": datetime.now(timezone.utc),
        "likes": 0,
        "retweets": 0,
        "replies": 0,
        "impressions": 0,
        "last_metrics_update": None,
    }


# ---------- Event ----------
def make_event(
    name: str,
    event_date: datetime,
    category: str,
    description: str = "",
    content_ideas: list[str] | None = None,
) -> dict[str, Any]:
    """Create an event/festival document."""
    return {
        "name": name,
        "event_date": event_date,
        "category": category,  # "festival", "sale", "sneaker_event", "cultural", "brand_drop"
        "description": description,
        "content_ideas": content_ideas or [],
        "content_generated": False,
        "created_at": datetime.now(timezone.utc),
    }


# ---------- Analytics ----------
def make_analytics_snapshot(
    followers: int,
    following: int,
    tweet_count: int,
    top_tweet_id: str | None = None,
    engagement_rate: float = 0.0,
) -> dict[str, Any]:
    """Create a daily analytics snapshot."""
    return {
        "type": "daily_snapshot",
        "followers": followers,
        "following": following,
        "tweet_count": tweet_count,
        "top_tweet_id": top_tweet_id,
        "engagement_rate": engagement_rate,
        "recorded_at": datetime.now(timezone.utc),
    }
