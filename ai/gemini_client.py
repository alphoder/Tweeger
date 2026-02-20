"""AI integration using Groq REST API for content generation and image analysis."""

from __future__ import annotations

import base64
import json
import os

import requests

from config.settings import settings

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
HEADERS = {
    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
    "Content-Type": "application/json",
}


class GeminiAI:
    """Handles all AI-powered content generation using Groq.

    Class name kept as GeminiAI to avoid changing imports everywhere.
    Uses raw REST API calls — no groq package needed.
    """

    def __init__(self):
        self.text_model = "llama-3.3-70b-versatile"
        self.vision_model = "meta-llama/llama-4-scout-17b-16e-instruct"

        # Brand context injected into every prompt
        self.brand_context = f"""
You are the social media manager for {settings.BRAND_NAME}.
Brand: {settings.BRAND_DESCRIPTION}
Tone: {settings.BRAND_TONE}
Core hashtags: {', '.join(settings.BRAND_HASHTAGS)}

Rules:
- Keep tweets under 260 characters (leave room for hashtags)
- Be authentic to sneaker/streetwear culture
- Never use generic corporate language
- Use 2-4 relevant hashtags max
- Emojis are okay but don't overdo it (1-2 max)
- Reference current trends when relevant
"""

    # ---- Helper: call Groq REST API ----

    def _chat(self, prompt: str, model: str = None) -> str:
        """Send a text prompt to Groq and return the response."""
        payload = {
            "model": model or self.text_model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.8,
            "max_tokens": 1024,
        }
        resp = requests.post(GROQ_API_URL, headers=HEADERS, json=payload, timeout=30)
        if resp.status_code != 200:
            error_detail = resp.text
            raise Exception(f"Groq API error {resp.status_code}: {error_detail}")
        data = resp.json()
        return data["choices"][0]["message"]["content"]

    def _chat_with_image(self, prompt: str, image_path: str) -> str:
        """Send a prompt with an image to Groq vision model."""
        with open(image_path, "rb") as f:
            image_data = base64.b64encode(f.read()).decode("utf-8")

        # Detect mime type
        ext = os.path.splitext(image_path)[1].lower()
        mime_map = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
        }
        mime_type = mime_map.get(ext, "image/jpeg")

        payload = {
            "model": self.vision_model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{image_data}"
                            },
                        },
                    ],
                }
            ],
            "temperature": 0.8,
            "max_tokens": 1024,
        }
        resp = requests.post(GROQ_API_URL, headers=HEADERS, json=payload, timeout=60)
        if resp.status_code != 200:
            error_detail = resp.text
            raise Exception(f"Groq Vision API error {resp.status_code}: {error_detail}")
        data = resp.json()
        return data["choices"][0]["message"]["content"]

    # ---- Image Analysis + Tweet Generation ----

    def analyze_image_and_generate_tweet(
        self,
        image_path: str,
        additional_context: str = "",
    ) -> dict:
        """
        Analyze an image and generate a tweet about it.
        Returns dict with 'analysis', 'tweet', and 'hashtags'.
        """
        prompt = f"""{self.brand_context}

Task: Look at this image and create a tweet for our sneaker brand's Twitter account.

Additional context from the user: {additional_context if additional_context else 'None'}

Respond in this exact format:
IMAGE_ANALYSIS: [What you see in the image - 1 sentence]
TWEET: [The tweet text without hashtags]
HASHTAGS: [Comma-separated hashtags including # symbol]
"""

        response = self._chat_with_image(prompt, image_path)
        return self._parse_tweet_response(response)

    # ---- Trend-Based Content ----

    def generate_trend_tweet(
        self,
        trend_name: str,
        trend_context: str = "",
    ) -> dict:
        """Generate a tweet that ties a trending topic to the brand."""
        prompt = f"""{self.brand_context}

Trending topic: {trend_name}
Context about the trend: {trend_context if trend_context else 'Currently trending on Twitter/X'}

Task: Create a tweet that naturally connects this trend to our sneaker brand.
Don't force it — if the trend doesn't fit, make it loosely related or use it as a conversation starter.

Respond in this exact format:
TWEET: [The tweet text without hashtags]
HASHTAGS: [Comma-separated hashtags including # symbol]
"""

        response = self._chat(prompt)
        return self._parse_tweet_response(response)

    # ---- Event-Based Content ----

    def generate_event_content(
        self,
        event_name: str,
        event_date: str,
        event_description: str = "",
    ) -> dict:
        """Generate tweet content for an upcoming event/festival."""
        prompt = f"""{self.brand_context}

Upcoming event: {event_name}
Date: {event_date}
Description: {event_description}

Task: Create a tweet that connects this event/festival to our sneaker brand.
Think about: special drops, sales, themed content, cultural relevance.
Make it feel organic, not forced promotional.

Respond in this exact format:
TWEET: [The tweet text without hashtags]
HASHTAGS: [Comma-separated hashtags including # symbol]
CONTENT_IDEA: [A brief content idea for this event - what kind of image/video would pair well]
"""

        response = self._chat(prompt)
        return self._parse_event_response(response)

    # ---- Thread Generation ----

    def generate_thread(
        self,
        topic: str,
        num_tweets: int = 5,
    ) -> list:
        """Generate a Twitter thread on a given topic."""
        prompt = f"""{self.brand_context}

Task: Write a {num_tweets}-tweet thread about: {topic}

Rules:
- First tweet should hook the reader
- Each tweet should stand on its own but flow as a story
- Last tweet should have a CTA (call to action)
- Each tweet under 260 characters
- Only use hashtags in the last tweet
- Number each tweet (1/, 2/, etc.)

Return each tweet on a new line, prefixed with TWEET_N: where N is the number.
"""

        response = self._chat(prompt)
        return self._parse_thread_response(response, num_tweets)

    # ---- Content Ideas ----

    def generate_content_ideas(
        self,
        recent_performance: str = "",
        upcoming_events: str = "",
        count: int = 5,
    ) -> list:
        """Generate content ideas for the week ahead."""
        prompt = f"""{self.brand_context}

Recent account performance: {recent_performance if recent_performance else 'No data yet'}
Upcoming events this week: {upcoming_events if upcoming_events else 'None specific'}

Task: Generate {count} tweet ideas for this week. Mix of:
- Product/brand content (40%)
- Engagement/community posts (30%)
- Trend-riding/cultural content (30%)

For each idea respond with:
IDEA_N:
TYPE: [product | engagement | trend | event]
CONCEPT: [1 sentence describing the tweet concept]
TWEET: [The actual draft tweet]
BEST_TIME: [morning | afternoon | evening | night]
---
"""

        response = self._chat(prompt)
        return self._parse_ideas_response(response, count)

    # ---- Bio Suggestion ----

    def suggest_bio_update(
        self,
        current_bio: str,
        recent_performance: str = "",
        upcoming_events: str = "",
    ) -> str:
        """Suggest an updated Twitter bio based on current context."""
        prompt = f"""{self.brand_context}

Current bio: {current_bio}
Recent performance: {recent_performance}
Upcoming events: {upcoming_events}

Task: Suggest an updated bio (max 160 characters) that:
- Keeps the core brand identity
- References anything timely (drops, events)
- Feels fresh and current

Respond with just the bio text, nothing else.
"""

        response = self._chat(prompt)
        return response.strip()

    # ---- Parsing Helpers ----

    def _parse_tweet_response(self, text: str) -> dict:
        """Parse the structured response into a dict."""
        result = {"analysis": "", "tweet": "", "hashtags": [], "raw": text}

        for line in text.strip().split("\n"):
            line = line.strip()
            if line.startswith("IMAGE_ANALYSIS:"):
                result["analysis"] = line.replace("IMAGE_ANALYSIS:", "").strip()
            elif line.startswith("TWEET:"):
                result["tweet"] = line.replace("TWEET:", "").strip()
            elif line.startswith("HASHTAGS:"):
                tags = line.replace("HASHTAGS:", "").strip()
                result["hashtags"] = [
                    t.strip() for t in tags.split(",") if t.strip()
                ]

        # Fallback: if parsing failed, use raw text as tweet
        if not result["tweet"]:
            result["tweet"] = text.strip()[:260]

        return result

    def _parse_event_response(self, text: str) -> dict:
        """Parse event content response."""
        result = self._parse_tweet_response(text)
        result["content_idea"] = ""

        for line in text.strip().split("\n"):
            line = line.strip()
            if line.startswith("CONTENT_IDEA:"):
                result["content_idea"] = line.replace("CONTENT_IDEA:", "").strip()

        return result

    def _parse_thread_response(self, text: str, expected: int) -> list:
        """Parse a thread response into individual tweets."""
        tweets = []
        for line in text.strip().split("\n"):
            line = line.strip()
            for i in range(1, expected + 1):
                prefix = "TWEET_%d:" % i
                if line.startswith(prefix):
                    tweets.append(line.replace(prefix, "").strip())

        # Fallback: split by numbered lines
        if len(tweets) < 2:
            tweets = []
            for line in text.strip().split("\n"):
                line = line.strip()
                if line and (line[0].isdigit() and ("/" in line[:4] or "." in line[:4])):
                    cleaned = line.lstrip("0123456789/.)" ).strip()
                    if cleaned:
                        tweets.append(cleaned)

        return tweets[:expected]

    def _parse_ideas_response(self, text: str, count: int) -> list:
        """Parse content ideas response."""
        ideas = []
        current = {}

        for line in text.strip().split("\n"):
            line = line.strip()
            if line.startswith("IDEA_"):
                if current:
                    ideas.append(current)
                current = {"type": "", "concept": "", "tweet": "", "best_time": ""}
            elif line.startswith("TYPE:"):
                current["type"] = line.replace("TYPE:", "").strip()
            elif line.startswith("CONCEPT:"):
                current["concept"] = line.replace("CONCEPT:", "").strip()
            elif line.startswith("TWEET:"):
                current["tweet"] = line.replace("TWEET:", "").strip()
            elif line.startswith("BEST_TIME:"):
                current["best_time"] = line.replace("BEST_TIME:", "").strip()

        if current and current.get("tweet"):
            ideas.append(current)

        return ideas[:count]
