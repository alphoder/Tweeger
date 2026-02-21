"""Shared utility functions."""

import os
from datetime import datetime, timezone


UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def get_upload_path(filename: str) -> str:
    """Get a unique path in the uploads directory."""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    name, ext = os.path.splitext(filename)
    return os.path.join(UPLOAD_DIR, f"{name}_{timestamp}{ext}")


def truncate_text(text: str, max_len: int = 280) -> str:
    """Truncate text to fit Twitter's character limit."""
    if len(text) <= max_len:
        return text
    return text[: max_len - 3] + "..."


def format_metrics(metrics: dict) -> str:
    """Format engagement metrics for display."""
    return (
        f"❤️ {metrics.get('likes', 0)} | "
        f"🔁 {metrics.get('retweets', 0)} | "
        f"💬 {metrics.get('replies', 0)} | "
        f"👀 {metrics.get('impressions', 0)}"
    )


def format_datetime(dt: datetime) -> str:
    """Format datetime for user-friendly display."""
    return dt.strftime("%b %d, %Y at %I:%M %p UTC")
