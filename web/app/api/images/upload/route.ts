import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { images } from "@/lib/schema";
import { saveImage } from "@/lib/storage";

/**
 * POST /api/images/upload
 * Upload an image file (multipart form data) → R2 (or local dev fallback).
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, GIF, WebP" },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Maximum: 10MB" }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const saved = await saveImage(bytes, file.type, "uploads");

    const category = (formData.get("category") as string) || null;
    const tagsRaw = formData.get("tags") as string;
    const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()) : [];

    const [record] = await db
      .insert(images)
      .values({
        url: saved.url,
        source: "uploaded",
        tags,
        category,
        fileSize: file.size,
        platformFit: ["twitter", "instagram", "facebook", "linkedin"],
      })
      .returning();

    return NextResponse.json(record);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
