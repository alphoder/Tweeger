import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { events } from "@/lib/schema";
import { eq, gte, and, sql, desc, asc } from "drizzle-orm";

// ─── DEFAULT EVENTS ──────────────────────────────────────────────────────────

const DEFAULT_EVENTS: {
  name: string;
  month: number;
  day: number;
  category: "industry" | "sale" | "product_launch" | "cultural" | "webinar" | "conference";
  description: string;
  targetIndustries?: string[];
  platforms?: string[];
  contentIdeas?: string[];
}[] = [
  // Industry Conferences
  {
    name: "Restaurant Tech Summit",
    month: 3,
    day: 15,
    category: "conference",
    description: "Annual technology summit for the restaurant industry",
    targetIndustries: ["restaurants", "food_tech"],
    contentIdeas: [
      "Share your AI automation success stories",
      "Post about how Axon helps restaurants automate social media",
      "Live-tweet key sessions and insights",
    ],
  },
  {
    name: "HealthTech India",
    month: 4,
    day: 10,
    category: "conference",
    description: "Healthcare technology conference and expo",
    targetIndustries: ["hospitals", "healthcare"],
    contentIdeas: [
      "Showcase healthcare social media case studies",
      "Share patient engagement strategies",
    ],
  },
  {
    name: "PropTech Conference",
    month: 6,
    day: 20,
    category: "conference",
    description: "Real estate technology innovation conference",
    targetIndustries: ["real_estate"],
    contentIdeas: [
      "Highlight property marketing automation",
      "Share real estate social media tips",
    ],
  },
  {
    name: "EdTech India",
    month: 8,
    day: 5,
    category: "conference",
    description: "Education technology summit",
    targetIndustries: ["education"],
    contentIdeas: [
      "Discuss student engagement on social platforms",
      "Share education content creation tips",
    ],
  },
  {
    name: "India SaaS Summit",
    month: 9,
    day: 12,
    category: "conference",
    description: "Premier SaaS conference for Indian startups",
    targetIndustries: ["startups", "saas"],
    contentIdeas: [
      "Share Axon's SaaS journey",
      "Post tips on AI-powered marketing",
    ],
  },
  {
    name: "Startup India Week",
    month: 10,
    day: 8,
    category: "industry",
    description: "Government-backed startup ecosystem event",
    targetIndustries: ["startups"],
    contentIdeas: [
      "Share entrepreneurship content",
      "Highlight how Axon helps startups scale",
    ],
  },
  {
    name: "AI Summit India",
    month: 11,
    day: 18,
    category: "conference",
    description: "Artificial intelligence and automation conference",
    targetIndustries: ["startups", "saas"],
    contentIdeas: [
      "Launch content about Axon's AI capabilities",
      "Post behind-the-scenes of multi-agent architecture",
    ],
  },

  // Cultural Events
  {
    name: "Republic Day",
    month: 1,
    day: 26,
    category: "cultural",
    description: "Indian Republic Day celebrations",
    contentIdeas: [
      "Patriotic themed post with brand colors",
      "Thank your Indian clients and community",
    ],
  },
  {
    name: "Holi",
    month: 3,
    day: 14,
    category: "cultural",
    description: "Festival of Colors",
    contentIdeas: [
      "Colorful creative post",
      "Offer festive discounts",
      "Share celebration vibes",
    ],
  },
  {
    name: "Eid ul-Fitr",
    month: 4,
    day: 1,
    category: "cultural",
    description: "Celebration marking end of Ramadan",
    contentIdeas: [
      "Eid greetings with brand touch",
      "Inclusive festive wishes",
    ],
  },
  {
    name: "Raksha Bandhan",
    month: 8,
    day: 19,
    category: "cultural",
    description: "Festival celebrating brother-sister bond",
    contentIdeas: [
      "Sibling-themed post",
      "Family and togetherness content",
    ],
  },
  {
    name: "Independence Day",
    month: 8,
    day: 15,
    category: "cultural",
    description: "Indian Independence Day",
    contentIdeas: [
      "Patriotic themed content",
      "Celebrate Made in India innovation",
    ],
  },
  {
    name: "Ganesh Chaturthi",
    month: 9,
    day: 7,
    category: "cultural",
    description: "Festival honoring Lord Ganesh",
    contentIdeas: [
      "New beginnings themed content",
      "Festive greetings",
    ],
  },
  {
    name: "Navratri",
    month: 10,
    day: 3,
    category: "cultural",
    description: "Nine nights of celebration",
    contentIdeas: [
      "Daily themed posts for 9 days",
      "Energy and renewal content",
    ],
  },
  {
    name: "Diwali",
    month: 11,
    day: 1,
    category: "cultural",
    description: "Festival of Lights",
    contentIdeas: [
      "Grand festive post with lights theme",
      "Special Diwali offers",
      "Year-end reflection content",
    ],
  },
  {
    name: "Christmas",
    month: 12,
    day: 25,
    category: "cultural",
    description: "Christmas celebrations",
    contentIdeas: [
      "Holiday greetings",
      "Year-end thank you to community",
    ],
  },
  {
    name: "New Year",
    month: 1,
    day: 1,
    category: "cultural",
    description: "New Year celebrations",
    contentIdeas: [
      "New year goals for businesses",
      "Year-in-review post",
      "Resolution themed content",
    ],
  },

  // Sales Events
  {
    name: "Black Friday",
    month: 11,
    day: 29,
    category: "sale",
    description: "Biggest shopping day of the year",
    contentIdeas: [
      "Special pricing announcement",
      "Limited-time automation deals",
    ],
  },
  {
    name: "Cyber Monday",
    month: 12,
    day: 2,
    category: "sale",
    description: "Online shopping event",
    contentIdeas: [
      "Digital-first deals",
      "SaaS subscription offers",
    ],
  },
  {
    name: "Year-End Sale",
    month: 12,
    day: 20,
    category: "sale",
    description: "End of year clearance and deals",
    contentIdeas: [
      "Annual subscription deals",
      "End-of-year business optimization tips",
    ],
  },

  // Monthly Webinars
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => ({
    name: "Automate Your Business Webinar",
    month: m,
    day: 15,
    category: "webinar" as const,
    description: `Monthly webinar on AI-powered business automation (${
      ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]
    })`,
    targetIndustries: [
      "restaurants",
      "hotels",
      "hospitals",
      "real_estate",
      "education",
      "startups",
    ],
    contentIdeas: [
      "Teaser posts 1 week before",
      "Registration link posts",
      "Key takeaways thread after",
    ],
  })),
];

// ─── HANDLERS ────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const upcoming = searchParams.get("upcoming") === "true";
    const daysAhead = parseInt(searchParams.get("days") || "90");
    const category = searchParams.get("category");
    const industry = searchParams.get("industry");

    const conditions = [];

    if (upcoming) {
      conditions.push(gte(events.eventDate, new Date()));
    }

    if (category) {
      conditions.push(
        eq(
          events.category,
          category as
            | "industry"
            | "sale"
            | "product_launch"
            | "cultural"
            | "webinar"
            | "conference"
        )
      );
    }

    if (daysAhead && upcoming) {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + daysAhead);
      conditions.push(
        sql`${events.eventDate} <= ${endDate.toISOString()}::timestamptz`
      );
    }

    if (industry) {
      conditions.push(
        sql`${events.targetIndustries}::jsonb @> ${`["${industry}"]`}::jsonb`
      );
    }

    const data = await db
      .select()
      .from(events)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(events.eventDate));

    return NextResponse.json({ events: data, total: data.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch events" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Load default events action
    if (body.action === "load_defaults") {
      const currentYear = new Date().getFullYear();
      const inserted: { id: number; name: string }[] = [];

      for (const evt of DEFAULT_EVENTS) {
        let eventDate = new Date(currentYear, evt.month - 1, evt.day);

        // If the date has already passed this year, schedule for next year
        if (eventDate < new Date()) {
          eventDate = new Date(currentYear + 1, evt.month - 1, evt.day);
        }

        const [row] = await db
          .insert(events)
          .values({
            name: evt.name,
            eventDate,
            category: evt.category,
            description: evt.description,
            targetIndustries: evt.targetIndustries || [],
            contentIdeas: evt.contentIdeas || [],
            platforms: evt.platforms || [
              "twitter",
              "linkedin",
              "instagram",
              "facebook",
            ],
          })
          .returning({ id: events.id, name: events.name });

        inserted.push(row);
      }

      return NextResponse.json({
        ok: true,
        inserted: inserted.length,
        events: inserted,
      });
    }

    // Create custom event
    const { name, eventDate, category, description, targetIndustries, contentIdeas, platforms } =
      body;

    if (!name || !eventDate || !category) {
      return NextResponse.json(
        { error: "name, eventDate, and category are required" },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(events)
      .values({
        name,
        eventDate: new Date(eventDate),
        category,
        description: description || "",
        targetIndustries: targetIndustries || [],
        contentIdeas: contentIdeas || [],
        platforms: platforms || ["twitter", "linkedin", "instagram", "facebook"],
      })
      .returning();

    return NextResponse.json({ event: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create event" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get("id") || "0");

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    await db.delete(events).where(eq(events.id, id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete event" },
      { status: 500 }
    );
  }
}
