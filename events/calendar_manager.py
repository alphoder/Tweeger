"""
Event and festival calendar manager.

Pre-loads sneaker/streetwear-relevant events, cultural festivals,
and major sales dates. Also allows dynamic event addition.
"""

from __future__ import annotations

from datetime import datetime, timezone
from database.connection import get_database
from database.models import make_event


# ──────────────────────────────────────
# Pre-defined events for a sneaker brand (2025-2026)
# These repeat yearly — adjust dates as needed
# ──────────────────────────────────────
SNEAKER_EVENTS = [
    # Major Sales / Shopping Events
    {"name": "New Year Sale", "month": 1, "day": 1, "category": "sale",
     "description": "New Year, new kicks. Post-holiday sale push."},
    {"name": "Valentine's Day", "month": 2, "day": 14, "category": "cultural",
     "description": "Gift-worthy sneakers, couples content, red/pink themed drops."},
    {"name": "International Women's Day", "month": 3, "day": 8, "category": "cultural",
     "description": "Women's collection spotlight, empowerment messaging."},
    {"name": "Holi", "month": 3, "day": 14, "category": "festival",
     "description": "Color-themed sneaker content, vibrant imagery."},
    {"name": "Air Max Day", "month": 3, "day": 26, "category": "sneaker_event",
     "description": "THE sneaker holiday. Major content day for any sneaker brand."},
    {"name": "April Fools Day", "month": 4, "day": 1, "category": "cultural",
     "description": "Fun fake product drops, humorous content."},
    {"name": "Earth Day", "month": 4, "day": 22, "category": "cultural",
     "description": "Sustainable sneakers, eco-friendly materials spotlight."},
    {"name": "Eid al-Fitr", "month": 4, "day": 1, "category": "festival",
     "description": "Festival collection, celebration-ready kicks."},
    {"name": "Mother's Day", "month": 5, "day": 11, "category": "cultural",
     "description": "Gift guide content, family-oriented messaging."},
    {"name": "Summer Drop Season", "month": 6, "day": 1, "category": "brand_drop",
     "description": "Summer collection launch, bright colors, light materials."},
    {"name": "Father's Day", "month": 6, "day": 15, "category": "cultural",
     "description": "Dad shoe appreciation, gift guide."},
    {"name": "Back to School", "month": 8, "day": 1, "category": "sale",
     "description": "Student-focused collection, back to school sale."},
    {"name": "Independence Day (India)", "month": 8, "day": 15, "category": "festival",
     "description": "Patriotic themed content, tricolor inspiration."},
    {"name": "Sneaker Con Season", "month": 9, "day": 15, "category": "sneaker_event",
     "description": "Sneaker convention content, community engagement."},
    {"name": "Navratri", "month": 10, "day": 2, "category": "festival",
     "description": "Color-of-the-day sneaker content for 9 days."},
    {"name": "Dussehra", "month": 10, "day": 12, "category": "festival",
     "description": "Victory of good, triumph-themed content."},
    {"name": "Halloween", "month": 10, "day": 31, "category": "cultural",
     "description": "Spooky sneaker content, dark themed drops."},
    {"name": "Diwali", "month": 11, "day": 1, "category": "festival",
     "description": "Biggest festival sale. Gold/premium collection. Gift content."},
    {"name": "Singles Day (11.11)", "month": 11, "day": 11, "category": "sale",
     "description": "Massive sale day, global shopping event."},
    {"name": "Black Friday", "month": 11, "day": 28, "category": "sale",
     "description": "Biggest sale of the year. Hype buildup needed."},
    {"name": "Cyber Monday", "month": 12, "day": 1, "category": "sale",
     "description": "Online exclusive deals, digital-first content."},
    {"name": "Christmas", "month": 12, "day": 25, "category": "festival",
     "description": "Holiday collection, gift wrapping content, festive drops."},
    {"name": "New Year's Eve", "month": 12, "day": 31, "category": "cultural",
     "description": "Year in review, top kicks of the year, countdown content."},
]


class CalendarManager:
    """Manages events and festival calendar."""

    def __init__(self):
        self.db = get_database()

    def load_default_events(self, year: int | None = None) -> int:
        """
        Load all pre-defined events for the given year.
        Returns count of events loaded.
        """
        if year is None:
            year = datetime.now(timezone.utc).year

        loaded = 0
        for event_data in SNEAKER_EVENTS:
            event_date = datetime(
                year,
                event_data["month"],
                event_data["day"],
                tzinfo=timezone.utc,
            )

            # Skip past events
            if event_date < datetime.now(timezone.utc):
                # Try next year
                event_date = event_date.replace(year=year + 1)

            # Check if already exists
            existing = self.db.events.find_one({
                "name": event_data["name"],
                "event_date": event_date,
            })
            if existing:
                continue

            event = make_event(
                name=event_data["name"],
                event_date=event_date,
                category=event_data["category"],
                description=event_data["description"],
            )
            self.db.events.insert_one(event)
            loaded += 1

        return loaded

    def add_custom_event(
        self,
        name: str,
        event_date: datetime,
        category: str = "custom",
        description: str = "",
    ) -> str:
        """Add a custom event. Returns the event ID."""
        event = make_event(
            name=name,
            event_date=event_date,
            category=category,
            description=description,
        )
        result = self.db.events.insert_one(event)
        return str(result.inserted_id)

    def get_upcoming(self, days: int = 7) -> list[dict]:
        """Get events in the next N days."""
        now = datetime.now(timezone.utc)
        future = now + __import__("datetime").timedelta(days=days)
        return list(
            self.db.events.find({"event_date": {"$gte": now, "$lte": future}})
            .sort("event_date", 1)
        )

    def get_today(self) -> list[dict]:
        """Get today's events."""
        now = datetime.now(timezone.utc)
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now.replace(hour=23, minute=59, second=59)
        return list(
            self.db.events.find({"event_date": {"$gte": start, "$lte": end}})
        )

    def remove_event(self, event_id: str) -> bool:
        """Remove an event by ID."""
        from bson import ObjectId
        result = self.db.events.delete_one({"_id": ObjectId(event_id)})
        return result.deleted_count > 0
