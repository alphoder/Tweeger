"use client";

// ─── MOBILE SWIPE REVIEW ────────────────────────────────────────────────────
// Opened from a Telegram link. Renders the drafted post exactly like a tweet.
// Swipe right = approve (scheduled into the calendar), left = reject.

import { use, useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";

interface ReviewItem {
  id: number;
  previewData: { text?: string; imagePath?: string | null; topic?: string };
  aiReasoning: string;
  aiScore: number;
  suggestedTime: string;
  reviewStatus: string;
}

interface Profile {
  name: string;
  handle: string;
  avatar: string | null;
}

export default function MobileReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || "";

  const [item, setItem] = useState<ReviewItem | null>(null);
  const [profile, setProfile] = useState<Profile>({ name: "You", handle: "you", avatar: null });
  const [error, setError] = useState<string | null>(null);
  const [decided, setDecided] = useState<"approved" | "rejected" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Swipe state
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/m/review/${id}?t=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed to load");
        setItem(d.item);
        setProfile(d.profile);
        if (d.item.reviewStatus === "approved" || d.item.reviewStatus === "rejected") {
          setDecided(d.item.reviewStatus);
        }
      })
      .catch((e) => setError(e.message));
  }, [id, token]);

  const decide = useCallback(
    async (action: "approve" | "reject") => {
      if (submitting || decided) return;
      setSubmitting(true);
      try {
        const res = await fetch(`/api/m/review/${id}?t=${encodeURIComponent(token)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const d = await res.json();
        if (!res.ok && res.status !== 409) throw new Error(d.error || "Failed");
        setDecided(action === "approve" ? "approved" : "rejected");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      } finally {
        setSubmitting(false);
      }
    },
    [id, token, submitting, decided]
  );

  // Touch handlers
  function onTouchStart(e: React.TouchEvent) {
    if (decided) return;
    startX.current = e.touches[0].clientX;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (startX.current === null || decided) return;
    setDx(e.touches[0].clientX - startX.current);
  }
  function onTouchEnd() {
    if (startX.current === null || decided) return;
    const threshold = 110;
    if (dx > threshold) decide("approve");
    else if (dx < -threshold) decide("reject");
    setDx(0);
    startX.current = null;
  }

  const rotation = dx / 22;
  const approveOpacity = Math.min(Math.max(dx - 30, 0) / 90, 1);
  const rejectOpacity = Math.min(Math.max(-dx - 30, 0) / 90, 1);

  if (error) {
    return (
      <div style={S.shell}>
        <div style={{ ...S.center, color: "#f4212e" }}>
          <p style={{ fontSize: 17, fontWeight: 700 }}>Link problem</p>
          <p style={{ color: "#71767b", marginTop: 8 }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div style={S.shell}>
        <div style={S.center}>
          <div style={S.spinner} />
        </div>
      </div>
    );
  }

  const text = item.previewData.text || "";
  const image = item.previewData.imagePath;
  const when = new Date(item.suggestedTime).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div style={S.shell}>
      <header style={S.header}>
        <span style={{ fontWeight: 800, fontSize: 16 }}>Post Review</span>
        <span style={{ color: "#71767b", fontSize: 13 }}>
          {item.previewData.topic || "drafted by the team"}
        </span>
      </header>

      {decided ? (
        <div style={S.center}>
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              background: decided === "approved" ? "rgba(0,186,124,0.12)" : "rgba(244,33,46,0.12)",
              border: `2px solid ${decided === "approved" ? "#00ba7c" : "#f4212e"}`,
            }}
          >
            {decided === "approved" ? "✓" : "✕"}
          </div>
          <p style={{ fontSize: 20, fontWeight: 800, marginTop: 20 }}>
            {decided === "approved" ? "Approved" : "Rejected"}
          </p>
          <p style={{ color: "#71767b", marginTop: 8, textAlign: "center", padding: "0 32px" }}>
            {decided === "approved"
              ? `Scheduled for ${when}. It's on your calendar.`
              : "The team will take another pass."}
          </p>
        </div>
      ) : (
        <>
          <div style={S.cardZone}>
            {/* Swipe verdict stamps */}
            <div style={{ ...S.stamp, left: 24, color: "#00ba7c", borderColor: "#00ba7c", opacity: approveOpacity, transform: "rotate(-12deg)" }}>
              APPROVE
            </div>
            <div style={{ ...S.stamp, right: 24, color: "#f4212e", borderColor: "#f4212e", opacity: rejectOpacity, transform: "rotate(12deg)" }}>
              REJECT
            </div>

            <div
              ref={cardRef}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              style={{
                ...S.tweetCard,
                transform: `translateX(${dx}px) rotate(${rotation}deg)`,
                transition: startX.current !== null ? "none" : "transform 0.25s ease",
              }}
            >
              {/* Tweet header */}
              <div style={{ display: "flex", gap: 10 }}>
                {profile.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar} alt="" style={S.avatar} />
                ) : (
                  <div style={{ ...S.avatar, background: "#333639", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                    {profile.name[0]?.toUpperCase()}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{profile.name}</span>
                    <svg viewBox="0 0 22 22" width="17" height="17" fill="#1d9bf0">
                      <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
                    </svg>
                  </div>
                  <span style={{ color: "#71767b", fontSize: 14 }}>@{profile.handle}</span>
                </div>
              </div>

              {/* Tweet text */}
              <p style={S.tweetText}>{text}</p>

              {/* Tweet image */}
              {image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" style={S.tweetImage} />
              )}

              <p style={{ color: "#71767b", fontSize: 14, marginTop: 12 }}>
                {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                <span style={{ color: "#e7e9ea", fontWeight: 700 }}>—</span> Views
              </p>

              {/* Action bar */}
              <div style={S.actionBar}>
                {[
                  { d: "M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01z", n: "" },
                  { d: "M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55v6.34c0 1.1.896 2.03 2 2.03h5v2h-5c-2.209 0-4-1.8-4-4.03V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6.08h-5v-2h5c2.209 0 4 1.8 4 4.03v6.34l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8.11c0-1.1-.896-2.03-2-2.03z", n: "" },
                  { d: "M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91z", n: "" },
                  { d: "M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z", n: "" },
                ].map((icon, i) => (
                  <svg key={i} viewBox="0 0 24 24" width="19" height="19" fill="#71767b">
                    <path d={icon.d} />
                  </svg>
                ))}
              </div>
            </div>
          </div>

          {/* Meta strip */}
          <div style={S.metaStrip}>
            <span style={{ color: "#71767b", fontSize: 13 }}>
              Team score <span style={{ color: "#e7e9ea", fontWeight: 700 }}>{item.aiScore}/10</span>
            </span>
            <span style={{ color: "#71767b", fontSize: 13 }}>
              Posts <span style={{ color: "#e7e9ea", fontWeight: 700 }}>{when}</span>
            </span>
          </div>

          {/* Fallback buttons */}
          <div style={S.buttonRow}>
            <button style={{ ...S.btn, borderColor: "#f4212e", color: "#f4212e" }} disabled={submitting} onClick={() => decide("reject")}>
              ✕ Reject
            </button>
            <button style={{ ...S.btn, background: "#00ba7c", borderColor: "#00ba7c", color: "#fff" }} disabled={submitting} onClick={() => decide("approve")}>
              ✓ Approve
            </button>
          </div>
          <p style={{ textAlign: "center", color: "#536471", fontSize: 12, paddingBottom: 20 }}>
            swipe right to approve · swipe left to reject
          </p>
        </>
      )}
    </div>
  );
}

// Twitter-dark styling, inline so this page has zero dependency on the
// dashboard's stylesheet.
const S: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: "100dvh",
    background: "#000",
    color: "#e7e9ea",
    fontFamily:
      '"TwitterChirp", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    touchAction: "pan-y",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "16px 20px 8px",
    borderBottom: "1px solid #2f3336",
  },
  center: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" },
  cardZone: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", padding: 16 },
  tweetCard: {
    width: "100%",
    maxWidth: 440,
    background: "#000",
    border: "1px solid #2f3336",
    borderRadius: 16,
    padding: 16,
    userSelect: "none",
    boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
  },
  avatar: { width: 40, height: 40, borderRadius: "50%", objectFit: "cover" },
  tweetText: { fontSize: 17, lineHeight: 1.35, marginTop: 12, whiteSpace: "pre-wrap", wordBreak: "break-word" },
  tweetImage: { width: "100%", borderRadius: 16, border: "1px solid #2f3336", marginTop: 12, display: "block" },
  actionBar: {
    display: "flex",
    justifyContent: "space-between",
    padding: "12px 8px 0",
    borderTop: "1px solid #2f3336",
    marginTop: 12,
  },
  stamp: {
    position: "absolute",
    top: 40,
    zIndex: 2,
    border: "3px solid",
    borderRadius: 8,
    padding: "6px 14px",
    fontWeight: 900,
    fontSize: 22,
    letterSpacing: 2,
    pointerEvents: "none",
  },
  metaStrip: { display: "flex", justifyContent: "space-between", padding: "0 24px 12px" },
  buttonRow: { display: "flex", gap: 12, padding: "0 16px 12px" },
  btn: {
    flex: 1,
    padding: "14px 0",
    borderRadius: 999,
    border: "1.5px solid",
    background: "transparent",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },
  spinner: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    border: "3px solid #2f3336",
    borderTopColor: "#1d9bf0",
    animation: "spin 0.8s linear infinite",
  },
};
