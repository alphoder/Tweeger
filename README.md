# SoleStreet — Automated Twitter/X Manager

An AI-powered Twitter/X account manager for a D2C sneaker brand, controlled entirely through a Telegram bot. Built with Python, Google Gemini, MongoDB, and the Twitter/X API.

## Features

- **Image-to-Tweet Pipeline** — Send a sneaker photo via Telegram, AI analyzes it and generates on-brand tweet copy
- **Content Queue & Calendar** — Approve drafts and auto-schedule them at optimal posting times
- **Trend Detection** — Fetches trending topics and generates brand-relevant tweet drafts
- **Event Calendar** — Pre-loaded with 20+ sneaker/cultural events (Diwali, Black Friday, Air Max Day, etc.) with auto-generated content suggestions
- **Analytics Dashboard** — Track followers, engagement, and best-performing content via Telegram commands
- **Profile Management** — AI-generated bio suggestions with one-tap apply
- **Weekly Reports** — Automated performance summaries delivered to Telegram

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Bot Interface | Telegram Bot API (python-telegram-bot) |
| Social Platform | Twitter/X API v2 (Tweepy) |
| AI Engine | Google Gemini 1.5 Flash (vision + text) |
| Database | MongoDB Atlas (free tier) |
| Scheduler | APScheduler |
| Language | Python 3.11+ |

## Architecture

```
User ──► Telegram Bot ──► AI (Gemini) ──► Draft
                                            │
                              User Approves ◄┘
                                   │
                              Queue/Calendar
                                   │
                              Scheduler ──► Twitter/X API
                                   │
                              Analytics ──► Telegram Reports
```

## Setup

### 1. Clone and install

```bash
git clone https://github.com/yourusername/sneaker-twitter-manager.git
cd sneaker-twitter-manager
pip install -r requirements.txt
```

### 2. Create accounts (all free)

- **Telegram Bot**: Message [@BotFather](https://t.me/BotFather) → `/newbot` → copy the token
- **Twitter/X API**: Apply at [developer.x.com](https://developer.x.com) → Free tier ($0) → get API keys
- **Google Gemini**: Get API key at [aistudio.google.com](https://aistudio.google.com/apikey)
- **MongoDB Atlas**: Create free cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

### 4. Get your Telegram user ID

Message [@userinfobot](https://t.me/userinfobot) on Telegram to get your user ID. Set it as `TELEGRAM_ADMIN_ID` in `.env`.

### 5. Run

```bash
python main.py
```

### 6. Load events

In your Telegram chat with the bot:
```
/start
/load_events
```

## Telegram Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and command list |
| `/draft <text>` | Create a manual tweet draft |
| `/queue` | View scheduled posts |
| `/trends` | Fetch trending topics + generate drafts |
| `/ideas` | AI-generated content ideas for the week |
| `/events` | View upcoming events and festivals |
| `/calendar` | 7-day posting calendar view |
| `/analytics` | Account performance summary |
| `/profile` | View/update Twitter profile and bio |
| `/report` | Weekly performance report |
| `/load_events` | Load default events into calendar |
| `/cancel` | Cancel current operation |
| **Send a photo** | AI analyzes image and drafts a tweet |

## How It Works

1. **You send a sneaker photo** to the Telegram bot
2. **Gemini AI** analyzes the image and writes tweet copy in your brand voice
3. **You review** the draft — approve, edit, or reject
4. **Approved tweets** get scheduled at the next optimal time slot
5. **Scheduler** automatically posts at the right time
6. **Analytics** track engagement and send you daily/weekly reports
7. **Event alerts** notify you 3 days before relevant events with content suggestions

## Project Structure

```
├── main.py                  # Entry point
├── config/
│   └── settings.py          # Environment config
├── bot/
│   └── handlers.py          # Telegram command handlers
├── twitter/
│   └── client.py            # Twitter/X API wrapper
├── ai/
│   └── gemini_client.py     # Gemini AI integration
├── scheduler/
│   └── queue_manager.py     # Queue processing & scheduled jobs
├── events/
│   └── calendar_manager.py  # Event/festival calendar
├── analytics/
│   └── tracker.py           # Growth tracking & insights
├── database/
│   ├── connection.py        # MongoDB connection & indexes
│   └── models.py            # Document schemas
├── utils/
│   └── helpers.py           # Shared utilities
├── requirements.txt
├── .env.example
└── .gitignore
```

## License

MIT
