"""Telegram bot command handlers."""

from __future__ import annotations

import os
from datetime import datetime, timezone, timedelta
from bson import ObjectId

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes

from config.settings import settings
from database.connection import get_database
from database.models import make_draft, make_queue_item
from ai.gemini_client import GeminiAI
from twitter.client import TwitterClient
from utils.helpers import get_upload_path, format_metrics, format_datetime, truncate_text

ai = GeminiAI()
twitter = TwitterClient()


def is_admin(user_id: int) -> bool:
    """Check if the user is the bot admin."""
    return user_id == settings.TELEGRAM_ADMIN_ID


# ──────────────────────────────────────
# /start
# ──────────────────────────────────────
async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Welcome message and command list."""
    if not is_admin(update.effective_user.id):
        await update.message.reply_text("⛔ Unauthorized.")
        return

    welcome = f"""
🔥 *{settings.BRAND_NAME} Twitter Manager*

Here's what I can do:

📸 *Send me a photo* → I'll analyze it and draft a tweet
📝 /draft `<text>` → Create a manual tweet draft
📋 /queue → View scheduled posts
🔥 /trends → Get current trending topics
💡 /ideas → Generate content ideas for this week
📅 /events → View upcoming events & festivals
📊 /analytics → Account performance summary
🗓 /calendar → View posting calendar
👤 /profile → View/update Twitter profile
❌ /cancel → Cancel current operation

All posts require your approval before scheduling!
"""
    await update.message.reply_text(welcome, parse_mode="Markdown")


# ──────────────────────────────────────
# Photo handler — the core feature
# ──────────────────────────────────────
async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle photo uploads — analyze and generate tweet draft."""
    if not is_admin(update.effective_user.id):
        return

    await update.message.reply_text("🔍 Analyzing your image...")

    # Download the photo
    photo = update.message.photo[-1]  # highest resolution
    file = await context.bot.get_file(photo.file_id)
    file_path = get_upload_path("sneaker_photo.jpg")
    await file.download_to_drive(file_path)

    # Get caption if provided
    caption = update.message.caption or ""

    # Generate tweet with AI
    try:
        result = ai.analyze_image_and_generate_tweet(file_path, caption)
    except Exception as e:
        await update.message.reply_text(f"❌ AI Error: {e}")
        return

    # Save as draft in DB
    db = get_database()
    draft = make_draft(
        text=result["tweet"],
        image_path=file_path,
        source="image_upload",
        hashtags=result["hashtags"],
    )
    draft_id = db.drafts.insert_one(draft).inserted_id

    # Build the tweet preview
    hashtag_str = " ".join(result["hashtags"]) if result["hashtags"] else ""
    full_tweet = f"{result['tweet']}\n{hashtag_str}".strip()

    # Send preview with approve/reject buttons
    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("✅ Approve", callback_data=f"approve_{draft_id}"),
            InlineKeyboardButton("✏️ Edit", callback_data=f"edit_{draft_id}"),
            InlineKeyboardButton("❌ Reject", callback_data=f"reject_{draft_id}"),
        ]
    ])

    preview = f"""
📸 *Image Analysis:* {result.get('analysis', 'N/A')}

📝 *Draft Tweet:*
{full_tweet}

Characters: {len(full_tweet)}/280
"""
    await update.message.reply_text(preview, reply_markup=keyboard, parse_mode="Markdown")


# ──────────────────────────────────────
# /draft — manual text tweet
# ──────────────────────────────────────
async def draft_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Create a manual tweet draft."""
    if not is_admin(update.effective_user.id):
        return

    text = " ".join(context.args) if context.args else ""
    if not text:
        await update.message.reply_text("Usage: /draft Your tweet text here")
        return

    text = truncate_text(text)
    db = get_database()
    draft = make_draft(text=text, source="manual")
    draft_id = db.drafts.insert_one(draft).inserted_id

    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("✅ Approve", callback_data=f"approve_{draft_id}"),
            InlineKeyboardButton("✏️ Edit", callback_data=f"edit_{draft_id}"),
            InlineKeyboardButton("❌ Reject", callback_data=f"reject_{draft_id}"),
        ]
    ])

    await update.message.reply_text(
        f"📝 *Draft Tweet:*\n{text}\n\nCharacters: {len(text)}/280",
        reply_markup=keyboard,
        parse_mode="Markdown",
    )


# ──────────────────────────────────────
# Callback: Approve / Edit / Reject
# ──────────────────────────────────────
async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle inline button presses for draft approval."""
    query = update.callback_query
    await query.answer()

    if not is_admin(query.from_user.id):
        return

    data = query.data
    action, draft_id_str = data.split("_", 1)

    db = get_database()

    if action == "approve":
        draft = db.drafts.find_one({"_id": ObjectId(draft_id_str)})
        if not draft:
            await query.edit_message_text("❌ Draft not found.")
            return

        # Update draft status
        db.drafts.update_one(
            {"_id": ObjectId(draft_id_str)},
            {"$set": {"status": "approved", "reviewed_at": datetime.now(timezone.utc)}},
        )

        # Schedule for next optimal time slot
        scheduled_time = _get_next_slot(db)

        hashtag_str = " ".join(draft.get("hashtags", []))
        full_text = f"{draft['text']}\n{hashtag_str}".strip()

        queue_item = make_queue_item(
            draft_id=str(draft_id_str),
            text=full_text,
            image_path=draft.get("image_path"),
            scheduled_time=scheduled_time,
            hashtags=draft.get("hashtags", []),
        )
        db.queue.insert_one(queue_item)

        await query.edit_message_text(
            f"✅ *Approved & Scheduled!*\n\n"
            f"📝 {full_text}\n\n"
            f"🕐 Posting at: {format_datetime(scheduled_time)}",
            parse_mode="Markdown",
        )

    elif action == "reject":
        db.drafts.update_one(
            {"_id": ObjectId(draft_id_str)},
            {"$set": {"status": "rejected", "reviewed_at": datetime.now(timezone.utc)}},
        )
        await query.edit_message_text("❌ Draft rejected and discarded.")

    elif action == "edit":
        # Store draft ID in user context for editing
        context.user_data["editing_draft_id"] = draft_id_str
        await query.edit_message_text(
            "✏️ Send me the edited tweet text.\n"
            "Type /cancel to cancel editing."
        )


async def handle_edit_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle edited tweet text from user."""
    if not is_admin(update.effective_user.id):
        return

    draft_id_str = context.user_data.get("editing_draft_id")
    if not draft_id_str:
        return  # Not in editing mode

    new_text = update.message.text.strip()
    if new_text.startswith("/"):
        return  # It's a command, not edit text

    db = get_database()
    db.drafts.update_one(
        {"_id": ObjectId(draft_id_str)},
        {"$set": {"text": new_text}},
    )

    draft = db.drafts.find_one({"_id": ObjectId(draft_id_str)})
    context.user_data.pop("editing_draft_id", None)

    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("✅ Approve", callback_data=f"approve_{draft_id_str}"),
            InlineKeyboardButton("✏️ Edit Again", callback_data=f"edit_{draft_id_str}"),
            InlineKeyboardButton("❌ Reject", callback_data=f"reject_{draft_id_str}"),
        ]
    ])

    await update.message.reply_text(
        f"📝 *Updated Draft:*\n{new_text}\n\nCharacters: {len(new_text)}/280",
        reply_markup=keyboard,
        parse_mode="Markdown",
    )


# ──────────────────────────────────────
# /queue — View scheduled posts
# ──────────────────────────────────────
async def queue_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show the posting queue."""
    if not is_admin(update.effective_user.id):
        return

    db = get_database()
    items = list(
        db.queue.find({"status": "scheduled"}).sort("scheduled_time", 1).limit(10)
    )

    if not items:
        await update.message.reply_text("📋 Queue is empty. Send me content!")
        return

    msg = "📋 *Posting Queue:*\n\n"
    for i, item in enumerate(items, 1):
        time_str = format_datetime(item["scheduled_time"])
        text_preview = item["text"][:80] + ("..." if len(item["text"]) > 80 else "")
        has_img = "📸" if item.get("image_path") else "📝"
        msg += f"{i}. {has_img} {time_str}\n   {text_preview}\n\n"

    await update.message.reply_text(msg, parse_mode="Markdown")


# ──────────────────────────────────────
# /trends — Fetch trending topics
# ──────────────────────────────────────
async def trends_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Fetch and display trending topics with content suggestions."""
    if not is_admin(update.effective_user.id):
        return

    await update.message.reply_text("🔍 Fetching trends...")

    trends = twitter.get_trends()

    if not trends:
        # Fallback: use Gemini to suggest trending sneaker topics
        try:
            result = ai.model.generate_content(
                f"{ai.brand_context}\n\n"
                "What are likely trending topics in sneaker/streetwear culture right now? "
                "List 10 topics with brief context. Format: TREND: context"
            )
            await update.message.reply_text(
                f"🔥 *AI-Predicted Sneaker Trends:*\n\n{result.text}",
                parse_mode="Markdown",
            )
        except Exception as e:
            await update.message.reply_text(f"❌ Could not fetch trends: {e}")
        return

    msg = "🔥 *Trending Now:*\n\n"
    for i, trend in enumerate(trends[:10], 1):
        volume = f" ({trend['tweet_volume']:,} tweets)" if trend.get("tweet_volume") else ""
        msg += f"{i}. *{trend['name']}*{volume}\n"

    # Add quick action buttons for top trends
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(
            f"📝 Draft about: {trends[i]['name'][:20]}",
            callback_data=f"trend_{i}",
        )]
        for i in range(min(3, len(trends)))
    ])

    # Store trends in context for callback
    context.user_data["trends"] = trends

    await update.message.reply_text(msg, reply_markup=keyboard, parse_mode="Markdown")


async def trend_draft_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle trend-based draft generation."""
    query = update.callback_query
    await query.answer()

    if not is_admin(query.from_user.id):
        return

    data = query.data
    if not data.startswith("trend_"):
        return

    trend_idx = int(data.replace("trend_", ""))
    trends = context.user_data.get("trends", [])

    if trend_idx >= len(trends):
        await query.edit_message_text("❌ Trend not found.")
        return

    trend = trends[trend_idx]
    await query.edit_message_text(f"✍️ Generating tweet about *{trend['name']}*...", parse_mode="Markdown")

    try:
        result = ai.generate_trend_tweet(trend["name"])
    except Exception as e:
        await query.edit_message_text(f"❌ AI Error: {e}")
        return

    db = get_database()
    draft = make_draft(
        text=result["tweet"],
        source="trend",
        hashtags=result["hashtags"],
        trend_context=trend["name"],
    )
    draft_id = db.drafts.insert_one(draft).inserted_id

    hashtag_str = " ".join(result["hashtags"]) if result["hashtags"] else ""
    full_tweet = f"{result['tweet']}\n{hashtag_str}".strip()

    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("✅ Approve", callback_data=f"approve_{draft_id}"),
            InlineKeyboardButton("✏️ Edit", callback_data=f"edit_{draft_id}"),
            InlineKeyboardButton("❌ Reject", callback_data=f"reject_{draft_id}"),
        ]
    ])

    await query.edit_message_text(
        f"🔥 *Trend:* {trend['name']}\n\n📝 *Draft Tweet:*\n{full_tweet}\n\nChars: {len(full_tweet)}/280",
        reply_markup=keyboard,
        parse_mode="Markdown",
    )


# ──────────────────────────────────────
# /ideas — Generate content ideas
# ──────────────────────────────────────
async def ideas_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Generate content ideas for the week."""
    if not is_admin(update.effective_user.id):
        return

    await update.message.reply_text("💡 Generating content ideas...")

    db = get_database()

    # Get upcoming events for context
    now = datetime.now(timezone.utc)
    week_ahead = now + timedelta(days=7)
    events = list(db.events.find({
        "event_date": {"$gte": now, "$lte": week_ahead}
    }))
    events_str = ", ".join([e["name"] for e in events]) if events else "None"

    try:
        ideas = ai.generate_content_ideas(upcoming_events=events_str)
    except Exception as e:
        await update.message.reply_text(f"❌ AI Error: {e}")
        return

    if not ideas:
        await update.message.reply_text("❌ Couldn't generate ideas. Try again.")
        return

    msg = "💡 *Content Ideas for This Week:*\n\n"
    for i, idea in enumerate(ideas, 1):
        type_emoji = {"product": "👟", "engagement": "💬", "trend": "🔥", "event": "📅"}.get(
            idea.get("type", ""), "📝"
        )
        msg += (
            f"{i}. {type_emoji} *{idea.get('type', 'general').title()}*\n"
            f"   {idea.get('concept', '')}\n"
            f"   📝 _{idea.get('tweet', '')}_\n"
            f"   ⏰ Best: {idea.get('best_time', 'anytime')}\n\n"
        )

    await update.message.reply_text(msg, parse_mode="Markdown")


# ──────────────────────────────────────
# /events — Upcoming events
# ──────────────────────────────────────
async def events_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show upcoming events and festivals."""
    if not is_admin(update.effective_user.id):
        return

    db = get_database()
    now = datetime.now(timezone.utc)
    upcoming = list(
        db.events.find({"event_date": {"$gte": now}})
        .sort("event_date", 1)
        .limit(15)
    )

    if not upcoming:
        await update.message.reply_text(
            "📅 No events loaded yet.\n"
            "Use /load\\_events to populate the calendar."
        )
        return

    msg = "📅 *Upcoming Events:*\n\n"
    for event in upcoming:
        days_until = (event["event_date"] - now).days
        urgency = "🔴" if days_until <= 2 else "🟡" if days_until <= 7 else "🟢"
        msg += (
            f"{urgency} *{event['name']}*\n"
            f"   📆 {event['event_date'].strftime('%b %d, %Y')} ({days_until}d away)\n"
            f"   🏷 {event['category']}\n\n"
        )

    await update.message.reply_text(msg, parse_mode="Markdown")


# ──────────────────────────────────────
# /analytics — Performance summary
# ──────────────────────────────────────
async def analytics_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show account analytics summary."""
    if not is_admin(update.effective_user.id):
        return

    await update.message.reply_text("📊 Fetching analytics...")

    try:
        profile = twitter.get_me()
        recent_tweets = twitter.get_recent_tweets(10)
    except Exception as e:
        await update.message.reply_text(f"❌ Twitter API Error: {e}")
        return

    msg = f"""
📊 *{settings.BRAND_NAME} Analytics*

👤 *Profile:*
   Followers: {profile['followers']:,}
   Following: {profile['following']:,}
   Total Tweets: {profile['tweet_count']:,}
"""

    if recent_tweets:
        total_likes = sum(t["likes"] for t in recent_tweets)
        total_rts = sum(t["retweets"] for t in recent_tweets)
        avg_engagement = (total_likes + total_rts) / len(recent_tweets)

        best = max(recent_tweets, key=lambda t: t["likes"] + t["retweets"])

        msg += f"""
📈 *Last {len(recent_tweets)} Tweets:*
   Avg Engagement: {avg_engagement:.1f}
   Total Likes: {total_likes}
   Total Retweets: {total_rts}

🏆 *Top Tweet:*
   {best['text'][:100]}...
   ❤️ {best['likes']} | 🔁 {best['retweets']}
"""

    # Save snapshot
    from database.models import make_analytics_snapshot
    db = get_database()
    snapshot = make_analytics_snapshot(
        followers=profile["followers"],
        following=profile["following"],
        tweet_count=profile["tweet_count"],
        engagement_rate=avg_engagement if recent_tweets else 0,
    )
    db.analytics.insert_one(snapshot)

    await update.message.reply_text(msg, parse_mode="Markdown")


# ──────────────────────────────────────
# /profile — View and update profile
# ──────────────────────────────────────
async def profile_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """View current profile and get bio suggestions."""
    if not is_admin(update.effective_user.id):
        return

    try:
        profile = twitter.get_me()
    except Exception as e:
        await update.message.reply_text(f"❌ Twitter API Error: {e}")
        return

    msg = f"""
👤 *Twitter Profile*

Name: {profile['name']}
@{profile['username']}
Bio: {profile.get('description', 'No bio set')}
Followers: {profile['followers']:,}
"""

    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("💡 Suggest New Bio", callback_data="suggest_bio")],
    ])

    await update.message.reply_text(msg, reply_markup=keyboard, parse_mode="Markdown")


async def suggest_bio_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Generate and suggest a new bio."""
    query = update.callback_query
    await query.answer()

    if not is_admin(query.from_user.id):
        return

    try:
        profile = twitter.get_me()
        suggestion = ai.suggest_bio_update(profile.get("description", ""))
    except Exception as e:
        await query.edit_message_text(f"❌ Error: {e}")
        return

    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("✅ Apply Bio", callback_data=f"apply_bio"),
            InlineKeyboardButton("🔄 New Suggestion", callback_data="suggest_bio"),
        ]
    ])

    context.user_data["suggested_bio"] = suggestion

    await query.edit_message_text(
        f"💡 *Suggested Bio:*\n\n{suggestion}\n\nChars: {len(suggestion)}/160",
        reply_markup=keyboard,
        parse_mode="Markdown",
    )


async def apply_bio_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Apply the suggested bio to Twitter profile."""
    query = update.callback_query
    await query.answer()

    if not is_admin(query.from_user.id):
        return

    bio = context.user_data.get("suggested_bio")
    if not bio:
        await query.edit_message_text("❌ No bio suggestion found.")
        return

    success = twitter.update_profile(description=bio)
    if success:
        await query.edit_message_text(f"✅ Bio updated!\n\n{bio}")
    else:
        await query.edit_message_text("❌ Failed to update bio. Check API permissions.")


# ──────────────────────────────────────
# /calendar — Posting calendar view
# ──────────────────────────────────────
async def calendar_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show the 7-day posting calendar."""
    if not is_admin(update.effective_user.id):
        return

    db = get_database()
    now = datetime.now(timezone.utc)
    week_ahead = now + timedelta(days=7)

    scheduled = list(db.queue.find({
        "status": "scheduled",
        "scheduled_time": {"$gte": now, "$lte": week_ahead},
    }).sort("scheduled_time", 1))

    posted_today = db.posted.count_documents({
        "posted_at": {"$gte": now.replace(hour=0, minute=0, second=0)},
    })

    msg = f"🗓 *7-Day Calendar*\nPosted today: {posted_today}/{settings.POSTS_PER_DAY}\n\n"

    if not scheduled:
        msg += "No posts scheduled. Send me content!"
    else:
        current_day = None
        for item in scheduled:
            day = item["scheduled_time"].strftime("%A, %b %d")
            if day != current_day:
                current_day = day
                msg += f"📆 *{day}*\n"

            time_str = item["scheduled_time"].strftime("%I:%M %p")
            has_img = "📸" if item.get("image_path") else "📝"
            text_preview = item["text"][:60] + ("..." if len(item["text"]) > 60 else "")
            msg += f"   {has_img} {time_str} — {text_preview}\n"
        msg += "\n"

    await update.message.reply_text(msg, parse_mode="Markdown")


# ──────────────────────────────────────
# /cancel
# ──────────────────────────────────────
async def cancel_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Cancel any ongoing operation."""
    context.user_data.clear()
    await update.message.reply_text("✅ Cancelled. What's next?")


# ──────────────────────────────────────
# Helper: find next available posting slot
# ──────────────────────────────────────
def _get_next_slot(db) -> datetime:
    """Find the next available posting time slot."""
    now = datetime.now(timezone.utc)
    optimal_hours = settings.OPTIMAL_HOURS

    # Check existing scheduled items
    scheduled = list(db.queue.find({
        "status": "scheduled",
        "scheduled_time": {"$gte": now},
    }).sort("scheduled_time", 1))

    taken_slots = {
        item["scheduled_time"].strftime("%Y-%m-%d %H")
        for item in scheduled
    }

    # Try to find next open optimal slot
    for day_offset in range(7):
        date = now + timedelta(days=day_offset)
        for hour in optimal_hours:
            candidate = date.replace(hour=hour, minute=0, second=0, microsecond=0)
            if candidate <= now:
                continue
            slot_key = candidate.strftime("%Y-%m-%d %H")
            if slot_key not in taken_slots:
                return candidate

    # Fallback: 1 hour from now
    return now + timedelta(hours=1)
