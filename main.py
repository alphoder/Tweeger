"""
SoleStreet Twitter Manager Bot
==============================
Automated Twitter/X management for a D2C sneaker brand,
powered by Gemini AI and controlled via Telegram.

Usage:
    python main.py
"""

import logging
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    filters,
)

from config.settings import settings
from bot.handlers import (
    start_command,
    handle_photo,
    draft_command,
    queue_command,
    trends_command,
    ideas_command,
    events_command,
    analytics_command,
    calendar_command,
    profile_command,
    cancel_command,
    button_callback,
    handle_edit_text,
    trend_draft_callback,
    suggest_bio_callback,
    apply_bio_callback,
)
from scheduler.queue_manager import QueueManager
from events.calendar_manager import CalendarManager
from database.connection import get_database

# Logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


async def load_events_command(update, context):
    """Load default events into the calendar."""
    from bot.handlers import is_admin
    if not is_admin(update.effective_user.id):
        return
    cm = CalendarManager()
    count = cm.load_default_events()
    await update.message.reply_text(f"📅 Loaded {count} events into the calendar.")


async def weekly_report_command(update, context):
    """Send the weekly analytics report."""
    from bot.handlers import is_admin
    from analytics.tracker import AnalyticsTracker
    if not is_admin(update.effective_user.id):
        return
    tracker = AnalyticsTracker()
    report = tracker.format_weekly_report()
    await update.message.reply_text(report, parse_mode="Markdown")


async def post_init(application):
    """Called after the bot is initialized — start the scheduler."""
    queue_mgr = QueueManager(telegram_bot=application.bot)
    queue_mgr.start()
    application.bot_data["queue_manager"] = queue_mgr
    logger.info("Scheduler started.")


async def post_shutdown(application):
    """Called on shutdown — stop the scheduler."""
    queue_mgr = application.bot_data.get("queue_manager")
    if queue_mgr:
        queue_mgr.stop()
    from database.connection import close_connection
    close_connection()
    logger.info("Shutdown complete.")


def main():
    """Start the bot."""
    if not settings.TELEGRAM_BOT_TOKEN:
        print("ERROR: TELEGRAM_BOT_TOKEN not set in .env")
        print("1. Create a bot via @BotFather on Telegram")
        print("2. Copy .env.example to .env")
        print("3. Paste your bot token")
        return

    if not settings.GROQ_API_KEY:
        print("WARNING: GROQ_API_KEY not set. AI features will fail.")

    if not settings.TWITTER_API_KEY:
        print("WARNING: Twitter API keys not set. Posting will fail.")

    # Ensure DB connection works
    try:
        db = get_database()
        db.command("ping")
        logger.info(f"Connected to MongoDB: {settings.MONGO_DB_NAME}")
    except Exception as e:
        print(f"ERROR: MongoDB connection failed: {e}")
        print("Check your MONGO_URI in .env")
        return

    # Build the Telegram bot
    app = (
        ApplicationBuilder()
        .token(settings.TELEGRAM_BOT_TOKEN)
        .post_init(post_init)
        .post_shutdown(post_shutdown)
        .build()
    )

    # ---- Register command handlers ----
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("draft", draft_command))
    app.add_handler(CommandHandler("queue", queue_command))
    app.add_handler(CommandHandler("trends", trends_command))
    app.add_handler(CommandHandler("ideas", ideas_command))
    app.add_handler(CommandHandler("events", events_command))
    app.add_handler(CommandHandler("analytics", analytics_command))
    app.add_handler(CommandHandler("calendar", calendar_command))
    app.add_handler(CommandHandler("profile", profile_command))
    app.add_handler(CommandHandler("cancel", cancel_command))
    app.add_handler(CommandHandler("load_events", load_events_command))
    app.add_handler(CommandHandler("report", weekly_report_command))

    # ---- Photo handler ----
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))

    # ---- Callback handlers (inline buttons) ----
    app.add_handler(CallbackQueryHandler(suggest_bio_callback, pattern="^suggest_bio$"))
    app.add_handler(CallbackQueryHandler(apply_bio_callback, pattern="^apply_bio$"))
    app.add_handler(CallbackQueryHandler(trend_draft_callback, pattern="^trend_"))
    app.add_handler(CallbackQueryHandler(button_callback, pattern="^(approve|edit|reject)_"))

    # ---- Text handler for editing drafts ----
    app.add_handler(MessageHandler(
        filters.TEXT & ~filters.COMMAND,
        handle_edit_text,
    ))

    # ---- Start polling ----
    logger.info(f"🔥 {settings.BRAND_NAME} Twitter Manager is running!")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
