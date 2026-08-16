"use client";

import { useState, useEffect } from "react";
import {
  Clock,
  Sparkles,
  Calendar,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface TimeRecommendation {
  time: string; // ISO string
  confidence: number;
  reasoning: string;
}

interface ScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  onSchedule: (scheduledTime: string) => void;
  platform: string;
}

export function ScheduleDialog({
  open,
  onClose,
  onSchedule,
  platform,
}: ScheduleDialogProps) {
  const [aiRecommendation, setAiRecommendation] = useState<TimeRecommendation | null>(null);
  const [alternatives, setAlternatives] = useState<TimeRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualDate, setManualDate] = useState("");
  const [manualTime, setManualTime] = useState("");
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Fetch AI recommendations when dialog opens
  useEffect(() => {
    if (!open) return;

    async function fetchRecommendation() {
      setLoading(true);
      try {
        const res = await fetch(`/api/scheduling/recommend?platform=${platform}`);
        if (res.ok) {
          const data = await res.json();
          setAiRecommendation(data.recommendation);
          setAlternatives(data.alternatives || []);
          setSelectedTime(data.recommendation?.time || null);
        }
      } catch {
        // Use defaults
        const defaultTime = new Date();
        defaultTime.setHours(defaultTime.getHours() + 2, 0, 0, 0);
        setAiRecommendation({
          time: defaultTime.toISOString(),
          confidence: 0.6,
          reasoning: "Default time (AI scheduling unavailable)",
        });
        setSelectedTime(defaultTime.toISOString());
      } finally {
        setLoading(false);
      }
    }

    fetchRecommendation();
  }, [open, platform]);

  // Set manual date/time when selected
  useEffect(() => {
    if (selectedTime) {
      const d = new Date(selectedTime);
      setManualDate(d.toISOString().split("T")[0]);
      setManualTime(
        d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
      );
    }
  }, [selectedTime]);

  if (!open) return null;

  function handleManualChange() {
    if (manualDate && manualTime) {
      const iso = new Date(`${manualDate}T${manualTime}:00`).toISOString();
      setSelectedTime(iso);
    }
  }

  function handleSchedule() {
    if (selectedTime) {
      onSchedule(selectedTime);
    } else if (manualDate && manualTime) {
      onSchedule(new Date(`${manualDate}T${manualTime}:00`).toISOString());
    }
  }

  const confidenceColor = (c: number) =>
    c >= 0.8
      ? "text-green-400"
      : c >= 0.6
      ? "text-zinc-200"
      : "text-zinc-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-center gap-2 mb-5">
          <Calendar className="h-5 w-5 text-zinc-400" />
          <h2 className="text-lg font-semibold text-zinc-100">Schedule Post</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400 mr-2" />
            <span className="text-sm text-zinc-400">
              AI analyzing optimal time...
            </span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* AI Recommendation */}
            {aiRecommendation && (
              <div
                className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                  selectedTime === aiRecommendation.time
                    ? "border-zinc-500 bg-zinc-500/10"
                    : "border-zinc-800 bg-zinc-800/50 hover:border-zinc-700"
                }`}
                onClick={() => setSelectedTime(aiRecommendation.time)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-zinc-400" />
                    <span className="text-sm font-medium text-zinc-100">
                      AI Recommended
                    </span>
                  </div>
                  <Badge className="bg-zinc-500/20 text-zinc-400 text-[10px]">
                    <span className={confidenceColor(aiRecommendation.confidence)}>
                      {Math.round(aiRecommendation.confidence * 100)}% confidence
                    </span>
                  </Badge>
                </div>
                <p className="text-lg font-semibold text-zinc-100">
                  {new Date(aiRecommendation.time).toLocaleString("en-IN", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  IST
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {aiRecommendation.reasoning}
                </p>
                {selectedTime === aiRecommendation.time && (
                  <CheckCircle2 className="h-4 w-4 text-zinc-400 mt-2" />
                )}
              </div>
            )}

            {/* Alternatives */}
            {alternatives.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-zinc-500 font-medium">Alternatives</p>
                {alternatives.map((alt, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                      selectedTime === alt.time
                        ? "border-zinc-500 bg-zinc-500/10"
                        : "border-zinc-800 hover:border-zinc-700"
                    }`}
                    onClick={() => setSelectedTime(alt.time)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-200">
                        {new Date(alt.time).toLocaleString("en-IN", {
                          weekday: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span
                        className={`text-[10px] ${confidenceColor(alt.confidence)}`}
                      >
                        {Math.round(alt.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Manual override */}
            <div className="space-y-2">
              <p className="text-xs text-zinc-500 font-medium">
                Manual Override
              </p>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={manualDate}
                  onChange={(e) => {
                    setManualDate(e.target.value);
                    handleManualChange();
                  }}
                  className="border-zinc-800 bg-zinc-800 text-zinc-100 text-sm flex-1"
                />
                <Input
                  type="time"
                  value={manualTime}
                  onChange={(e) => {
                    setManualTime(e.target.value);
                    handleManualChange();
                  }}
                  className="border-zinc-800 bg-zinc-800 text-zinc-100 text-sm w-28"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleSchedule}
                disabled={!selectedTime && (!manualDate || !manualTime)}
                className="flex-1 bg-white text-black hover:bg-zinc-200 "
              >
                <Clock className="h-4 w-4 mr-2" />
                Schedule
              </Button>
              <Button
                variant="outline"
                onClick={onClose}
                className="border-zinc-700"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
