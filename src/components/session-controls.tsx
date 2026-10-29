"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";

type User = {
  userId: number;
  fullName: string;
  email: string;
  role: "ADMIN" | "OPERATOR";
};

export default function SessionControls() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSession(showLoading = true) {
      if (showLoading) setLoading(true);

      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok || !result.ok || !result.user) {
          if (!cancelled) {
            setUser(null);
            setError("");
            setLoggingOut(false);
          }
          return;
        }

        if (!cancelled) {
          setUser(result.user);
          setError("");
          setLoggingOut(false);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setError("Session unavailable");
          setLoggingOut(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const refreshSession = () => {
      if (document.visibilityState === "visible") {
        void loadSession(false);
      }
    };

    void loadSession();

    window.addEventListener("focus", refreshSession);
    document.addEventListener("visibilitychange", refreshSession);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshSession);
      document.removeEventListener("visibilitychange", refreshSession);
    };
  }, []);

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setError("");

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Logout failed. Please try again.");
      }

      setUser(null);
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Could not log out. Please retry.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden max-w-[200px] text-right sm:block">
        <p className="truncate text-xs font-semibold text-slate-200">
          {loading ? "Checking session..." : user?.fullName || "Unknown user"}
        </p>

        <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-blue-300">
          <ShieldCheck size={12} />
          {user?.role ?? (error || "Verifying")}
        </p>
      </div>

      <button
        type="button"
        onClick={logout}
        disabled={loading || loggingOut || !user}
        title={error || "Sign out of your account"}
        className="flex h-10 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-300 transition hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <LogOut size={15} />
        <span>{loggingOut ? "Signing out..." : "Logout"}</span>
      </button>
    </div>
  );
}
