"""Twitter/X API wrapper using Tweepy (Free Tier compatible)."""

from __future__ import annotations

import tweepy
from config.settings import settings


class TwitterClient:
    """Handles all Twitter/X API operations."""

    def __init__(self):
        # OAuth 1.0a for posting tweets
        self.auth = tweepy.OAuth1UserHandler(
            settings.TWITTER_API_KEY,
            settings.TWITTER_API_SECRET,
            settings.TWITTER_ACCESS_TOKEN,
            settings.TWITTER_ACCESS_SECRET,
        )
        # v1.1 API (needed for media upload)
        self.api_v1 = tweepy.API(self.auth)

        # v2 API (for posting tweets, reading metrics)
        self.client = tweepy.Client(
            bearer_token=settings.TWITTER_BEARER_TOKEN,
            consumer_key=settings.TWITTER_API_KEY,
            consumer_secret=settings.TWITTER_API_SECRET,
            access_token=settings.TWITTER_ACCESS_TOKEN,
            access_token_secret=settings.TWITTER_ACCESS_SECRET,
        )

    # ---- Posting ----

    def post_tweet(self, text: str, image_path: str | None = None) -> dict:
        """
        Post a tweet, optionally with an image.
        Returns dict with tweet_id and url.
        """
        media_ids = []
        if image_path:
            media = self.api_v1.media_upload(filename=image_path)
            media_ids.append(media.media_id)

        response = self.client.create_tweet(
            text=text,
            media_ids=media_ids if media_ids else None,
        )

        tweet_id = response.data["id"]
        return {
            "tweet_id": tweet_id,
            "url": f"https://x.com/i/status/{tweet_id}",
        }

    def post_thread(self, tweets: list[str]) -> list[dict]:
        """Post a thread of tweets. Returns list of tweet info dicts."""
        results = []
        reply_to = None

        for text in tweets:
            response = self.client.create_tweet(
                text=text,
                in_reply_to_tweet_id=reply_to,
            )
            tweet_id = response.data["id"]
            results.append({
                "tweet_id": tweet_id,
                "url": f"https://x.com/i/status/{tweet_id}",
            })
            reply_to = tweet_id

        return results

    # ---- Profile ----

    def get_me(self) -> dict:
        """Get authenticated user's profile info."""
        response = self.client.get_me(
            user_fields=[
                "public_metrics",
                "description",
                "profile_image_url",
                "created_at",
            ]
        )
        user = response.data
        return {
            "id": user.id,
            "name": user.name,
            "username": user.username,
            "description": user.description,
            "followers": user.public_metrics["followers_count"],
            "following": user.public_metrics["following_count"],
            "tweet_count": user.public_metrics["tweet_count"],
            "profile_image_url": user.profile_image_url,
        }

    def update_profile(
        self,
        name: str | None = None,
        description: str | None = None,
    ) -> bool:
        """Update profile name and/or bio."""
        try:
            kwargs = {}
            if name:
                kwargs["name"] = name
            if description:
                kwargs["description"] = description
            if kwargs:
                self.api_v1.update_profile(**kwargs)
            return True
        except Exception as e:
            print(f"Profile update failed: {e}")
            return False

    # ---- Metrics ----

    def get_tweet_metrics(self, tweet_id: str) -> dict:
        """Get engagement metrics for a specific tweet."""
        response = self.client.get_tweet(
            tweet_id,
            tweet_fields=["public_metrics", "created_at"],
        )
        metrics = response.data.public_metrics
        return {
            "likes": metrics["like_count"],
            "retweets": metrics["retweet_count"],
            "replies": metrics["reply_count"],
            "impressions": metrics.get("impression_count", 0),
        }

    def get_recent_tweets(self, count: int = 10) -> list[dict]:
        """Get recent tweets from the authenticated user."""
        me = self.client.get_me()
        user_id = me.data.id

        response = self.client.get_users_tweets(
            user_id,
            max_results=min(count, 100),
            tweet_fields=["public_metrics", "created_at", "text"],
        )

        if not response.data:
            return []

        tweets = []
        for tweet in response.data:
            tweets.append({
                "tweet_id": tweet.id,
                "text": tweet.text,
                "created_at": tweet.created_at,
                "likes": tweet.public_metrics["like_count"],
                "retweets": tweet.public_metrics["retweet_count"],
                "replies": tweet.public_metrics["reply_count"],
            })
        return tweets

    # ---- Trends ----

    def get_trends(self, woeid: int = 1) -> list[dict]:
        """
        Get trending topics.
        woeid=1 is worldwide, 23424848 is India.
        Note: Requires elevated access on paid tiers.
        Falls back gracefully on free tier.
        """
        try:
            trends = self.api_v1.get_place_trends(woeid)
            return [
                {
                    "name": t["name"],
                    "tweet_volume": t.get("tweet_volume"),
                    "url": t["url"],
                }
                for t in trends[0]["trends"][:20]
            ]
        except Exception as e:
            print(f"Trends fetch failed (may need elevated access): {e}")
            return []
