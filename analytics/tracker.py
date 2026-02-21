"""Analytics tracker — monitors growth and generates insights."""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from database.connection import get_database


class AnalyticsTracker:
    """Tracks and analyzes account performance."""

    def __init__(self):
        self.db = get_database()

    def get_growth_summary(self, days: int = 7) -> dict:
        """Get a growth summary for the last N days."""
        now = datetime.now(timezone.utc)
        start = now - timedelta(days=days)

        snapshots = list(
            self.db.analytics.find({
                "type": "daily_snapshot",
                "recorded_at": {"$gte": start},
            }).sort("recorded_at", 1)
        )

        if len(snapshots) < 2:
            return {
                "period_days": days,
                "follower_change": 0,
                "avg_engagement": 0,
                "total_posts": 0,
                "best_day": None,
                "has_data": False,
            }

        first = snapshots[0]
        last = snapshots[-1]

        # Get posted tweets in this period
        posted = list(self.db.posted.find({
            "posted_at": {"$gte": start},
        }))

        total_engagement = sum(
            p.get("likes", 0) + p.get("retweets", 0) + p.get("replies", 0)
            for p in posted
        )
        avg_engagement = total_engagement / len(posted) if posted else 0

        # Find best performing post
        best_post = None
        if posted:
            best = max(
                posted,
                key=lambda p: p.get("likes", 0) + p.get("retweets", 0),
            )
            best_post = {
                "text": best["text"][:100],
                "likes": best.get("likes", 0),
                "retweets": best.get("retweets", 0),
                "posted_at": best.get("posted_at"),
            }

        return {
            "period_days": days,
            "follower_start": first.get("followers", 0),
            "follower_end": last.get("followers", 0),
            "follower_change": last.get("followers", 0) - first.get("followers", 0),
            "avg_engagement": round(avg_engagement, 2),
            "total_posts": len(posted),
            "total_engagement": total_engagement,
            "best_post": best_post,
            "has_data": True,
        }

    def get_best_posting_times(self) -> list[dict]:
        """Analyze which posting hours get the most engagement."""
        posted = list(self.db.posted.find().sort("posted_at", -1).limit(50))

        if not posted:
            return []

        # Group by hour
        hour_stats: dict[int, dict] = {}
        for post in posted:
            if not post.get("posted_at"):
                continue
            hour = post["posted_at"].hour
            if hour not in hour_stats:
                hour_stats[hour] = {"total_engagement": 0, "count": 0}

            engagement = (
                post.get("likes", 0)
                + post.get("retweets", 0)
                + post.get("replies", 0)
            )
            hour_stats[hour]["total_engagement"] += engagement
            hour_stats[hour]["count"] += 1

        # Calculate averages and sort
        results = []
        for hour, stats in hour_stats.items():
            avg = stats["total_engagement"] / stats["count"] if stats["count"] else 0
            results.append({
                "hour": hour,
                "avg_engagement": round(avg, 2),
                "post_count": stats["count"],
            })

        results.sort(key=lambda x: x["avg_engagement"], reverse=True)
        return results

    def get_content_type_performance(self) -> dict:
        """Analyze which content types perform best."""
        drafts = list(self.db.drafts.find({"status": "posted"}))

        type_stats: dict[str, dict] = {}
        for draft in drafts:
            source = draft.get("source", "manual")
            if source not in type_stats:
                type_stats[source] = {"count": 0, "total_engagement": 0}
            type_stats[source]["count"] += 1

        # Match with posted metrics
        for source, stats in type_stats.items():
            related_posts = list(self.db.posted.find({
                "queue_id": {"$in": [
                    str(d["_id"]) for d in drafts if d.get("source") == source
                ]}
            }))
            for post in related_posts:
                stats["total_engagement"] += (
                    post.get("likes", 0)
                    + post.get("retweets", 0)
                )

        return type_stats

    def format_weekly_report(self) -> str:
        """Generate a formatted weekly report string."""
        summary = self.get_growth_summary(7)
        best_times = self.get_best_posting_times()

        if not summary["has_data"]:
            return "📊 Not enough data yet. Keep posting!"

        change = summary["follower_change"]
        change_emoji = "📈" if change >= 0 else "📉"
        change_str = f"+{change}" if change >= 0 else str(change)

        report = f"""
📊 *Weekly Performance Report*

{change_emoji} *Followers:* {summary['follower_end']:,} ({change_str})
📝 *Posts:* {summary['total_posts']}
💬 *Avg Engagement:* {summary['avg_engagement']}
🔥 *Total Engagement:* {summary['total_engagement']}
"""

        if summary.get("best_post"):
            bp = summary["best_post"]
            report += f"""
🏆 *Best Post:*
   {bp['text']}
   ❤️ {bp['likes']} | 🔁 {bp['retweets']}
"""

        if best_times:
            top_3 = best_times[:3]
            times_str = ", ".join([f"{t['hour']}:00 UTC" for t in top_3])
            report += f"\n⏰ *Best Posting Times:* {times_str}"

        return report
