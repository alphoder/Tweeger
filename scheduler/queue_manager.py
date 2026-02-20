"""Queue manager — handles scheduled posting and periodic tasks."""

from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger

from database.connection import get_database
from database.models import make_posted, make_analytics_snapshot
from twitter.client import TwitterClient
from ai.gemini_client import GeminiAI
from config.settings import settings

logger = logging.getLogger(__name__)

twitter = TwitterClient()
ai = GeminiAI()


class QueueManager:
    """Manages the posting queue and scheduled jobs."""

    def __init__(self, telegram_bot=None):
        self.scheduler = AsyncIOScheduler()
        self.telegram_bot = telegram_bot  # For sending notifications

    def start(self):
        """Start the scheduler with all periodic jobs."""

        # Check queue every minute for posts that need to go out
        self.scheduler.add_job(
            self._process_queue,
            IntervalTrigger(minutes=1),
            id="process_queue",
            replace_existing=True,
        )

        # Update tweet metrics every 2 hours
        self.scheduler.add_job(
            self._update_metrics,
            IntervalTrigger(hours=2),
            id="update_metrics",
            replace_existing=True,
        )

        # Daily analytics snapshot at midnight UTC
        self.scheduler.add_job(
            self._daily_snapshot,
            CronTrigger(hour=0, minute=0),
            id="daily_snapshot",
            replace_existing=True,
        )

        # Check for upcoming events every morning at 8 AM UTC
        self.scheduler.add_job(
            self._check_upcoming_events,
            CronTrigger(hour=8, minute=0),
            id="check_events",
            replace_existing=True,
        )

        self.scheduler.start()
        logger.info("Queue manager started with all scheduled jobs.")

    def stop(self):
        """Stop the scheduler."""
        self.scheduler.shutdown()
        logger.info("Queue manager stopped.")

    # ──────────────────────────────────────
    # Process Queue — Post scheduled tweets
    # ──────────────────────────────────────
    async def _process_queue(self):
        """Check for tweets that need to be posted now."""
        db = get_database()
        now = datetime.now(timezone.utc)

        # Find items scheduled for now or past
        due_items = list(db.queue.find({
            "status": "scheduled",
            "scheduled_time": {"$lte": now},
        }).sort("scheduled_time", 1))

        for item in due_items:
            try:
                # Mark as posting
                db.queue.update_one(
                    {"_id": item["_id"]},
                    {"$set": {"status": "posting"}},
                )

                # Post to Twitter
                result = twitter.post_tweet(
                    text=item["text"],
                    image_path=item.get("image_path"),
                )

                # Save to posted collection
                posted = make_posted(
                    queue_id=str(item["_id"]),
                    tweet_id=result["tweet_id"],
                    text=item["text"],
                    image_path=item.get("image_path"),
                )
                db.posted.insert_one(posted)

                # Update queue status
                db.queue.update_one(
                    {"_id": item["_id"]},
                    {"$set": {
                        "status": "posted",
                        "posted_at": datetime.now(timezone.utc),
                        "tweet_id": result["tweet_id"],
                    }},
                )

                # Also update the draft
                if item.get("draft_id"):
                    from bson import ObjectId
                    db.drafts.update_one(
                        {"_id": ObjectId(item["draft_id"])},
                        {"$set": {"status": "posted"}},
                    )

                logger.info(f"Posted tweet: {result['tweet_id']} — {item['text'][:50]}")

                # Notify via Telegram
                if self.telegram_bot:
                    await self._notify_admin(
                        f"✅ *Tweet Posted!*\n\n"
                        f"{item['text'][:200]}\n\n"
                        f"🔗 {result['url']}"
                    )

            except Exception as e:
                logger.error(f"Failed to post tweet: {e}")
                db.queue.update_one(
                    {"_id": item["_id"]},
                    {"$set": {"status": "failed", "error": str(e)}},
                )
                if self.telegram_bot:
                    await self._notify_admin(
                        f"❌ *Tweet Failed!*\n\n"
                        f"{item['text'][:100]}\n\n"
                        f"Error: {e}"
                    )

    # ──────────────────────────────────────
    # Update Metrics
    # ──────────────────────────────────────
    async def _update_metrics(self):
        """Update engagement metrics for recent tweets."""
        db = get_database()
        recent = list(
            db.posted.find()
            .sort("posted_at", -1)
            .limit(20)
        )

        for post in recent:
            if not post.get("tweet_id"):
                continue
            try:
                metrics = twitter.get_tweet_metrics(post["tweet_id"])
                db.posted.update_one(
                    {"_id": post["_id"]},
                    {"$set": {
                        "likes": metrics["likes"],
                        "retweets": metrics["retweets"],
                        "replies": metrics["replies"],
                        "impressions": metrics["impressions"],
                        "last_metrics_update": datetime.now(timezone.utc),
                    }},
                )
            except Exception as e:
                logger.warning(f"Metrics update failed for {post['tweet_id']}: {e}")

    # ──────────────────────────────────────
    # Daily Analytics Snapshot
    # ──────────────────────────────────────
    async def _daily_snapshot(self):
        """Take a daily snapshot of account metrics."""
        try:
            profile = twitter.get_me()
            db = get_database()

            snapshot = make_analytics_snapshot(
                followers=profile["followers"],
                following=profile["following"],
                tweet_count=profile["tweet_count"],
            )
            db.analytics.insert_one(snapshot)

            logger.info(f"Daily snapshot: {profile['followers']} followers")

            # Send daily summary to Telegram
            if self.telegram_bot:
                # Get yesterday's stats for comparison
                yesterday = datetime.now(timezone.utc) - timedelta(days=1)
                prev = db.analytics.find_one(
                    {"recorded_at": {"$lte": yesterday}},
                    sort=[("recorded_at", -1)],
                )
                follower_change = ""
                if prev:
                    diff = profile["followers"] - prev["followers"]
                    emoji = "📈" if diff >= 0 else "📉"
                    follower_change = f"\n{emoji} Change: {'+' if diff >= 0 else ''}{diff}"

                await self._notify_admin(
                    f"📊 *Daily Report*\n\n"
                    f"Followers: {profile['followers']:,}{follower_change}\n"
                    f"Total Tweets: {profile['tweet_count']:,}"
                )

        except Exception as e:
            logger.error(f"Daily snapshot failed: {e}")

    # ──────────────────────────────────────
    # Check Upcoming Events
    # ──────────────────────────────────────
    async def _check_upcoming_events(self):
        """Check for events in the next 3 days and suggest content."""
        db = get_database()
        now = datetime.now(timezone.utc)
        three_days = now + timedelta(days=3)

        upcoming = list(db.events.find({
            "event_date": {"$gte": now, "$lte": three_days},
            "content_generated": False,
        }))

        for event in upcoming:
            try:
                result = ai.generate_event_content(
                    event_name=event["name"],
                    event_date=event["event_date"].strftime("%B %d, %Y"),
                    event_description=event.get("description", ""),
                )

                # Save content idea back to event
                db.events.update_one(
                    {"_id": event["_id"]},
                    {"$set": {
                        "content_generated": True,
                        "content_ideas": [result.get("tweet", ""), result.get("content_idea", "")],
                    }},
                )

                # Notify via Telegram
                if self.telegram_bot:
                    days_until = (event["event_date"] - now).days
                    await self._notify_admin(
                        f"📅 *Upcoming Event Alert!*\n\n"
                        f"*{event['name']}* in {days_until} days\n\n"
                        f"💡 Suggested tweet:\n{result.get('tweet', 'N/A')}\n\n"
                        f"Use /draft to create content for this event."
                    )

            except Exception as e:
                logger.error(f"Event content generation failed for {event['name']}: {e}")

    # ──────────────────────────────────────
    # Telegram notification helper
    # ──────────────────────────────────────
    async def _notify_admin(self, message: str):
        """Send a notification to the admin via Telegram."""
        if self.telegram_bot and settings.TELEGRAM_ADMIN_ID:
            try:
                await self.telegram_bot.send_message(
                    chat_id=settings.TELEGRAM_ADMIN_ID,
                    text=message,
                    parse_mode="Markdown",
                )
            except Exception as e:
                logger.error(f"Telegram notification failed: {e}")
