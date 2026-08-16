"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Feather, Eye, EyeOff, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

function LoginForm() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function requestOtp() {
    setSendingOtp(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestOtp: true }),
      });
      if (res.ok) {
        toast.success("Code sent to your Telegram");
      } else {
        const d = await res.json();
        toast.error(d.error || "Could not send code");
      }
    } catch {
      toast.error("Network error — try again");
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) {
      toast.error("Enter your password or Telegram code");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Login failed");
        setLoading(false);
        return;
      }

      const from = searchParams.get("from") || "/";
      router.push(from);
      router.refresh();
    } catch {
      toast.error("Network error — try again");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleLogin} className="space-y-3">
      <div className="relative">
        <Input
          type={showPassword ? "text" : "password"}
          placeholder="Password or 6-digit Telegram code"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-12 border-zinc-800 bg-zinc-900/50 pr-10 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-zinc-500/20"
          autoFocus
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="h-12 w-full bg-white font-semibold text-black hover:bg-zinc-200"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
      </Button>

      <Button
        type="button"
        variant="outline"
        disabled={sendingOtp}
        onClick={requestOtp}
        className="h-12 w-full border-zinc-800 text-zinc-300 hover:bg-zinc-900"
      >
        {sendingOtp ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" /> Send code to Telegram
          </>
        )}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="relative z-10 w-full max-w-sm px-6">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
            <Feather className="h-7 w-7 text-zinc-100" />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">FineTweet</h1>
          <p className="mt-2 text-sm text-zinc-500">Your agent team for a sharper Twitter</p>
        </div>

        <Suspense
          fallback={
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
