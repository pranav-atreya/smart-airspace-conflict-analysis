
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Plane, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("operator@airspace.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        setError(result.message || "Login failed.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("Unable to contact the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080e1b] px-5 py-12 text-slate-100">
      <div className="w-full max-w-[430px]">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 shadow-xl shadow-blue-950/60">
            <Plane size={29} />
          </div>
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.24em] text-blue-300">
            Flight Operations Intelligence
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            Welcome back
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Sign in to access the Smart Airspace Conflict Analysis system.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-7 shadow-2xl shadow-black/25 sm:p-8"
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
              <LockKeyhole size={19} />
            </div>
            <div>
              <h2 className="text-sm font-bold">Secure sign in</h2>
              <p className="mt-1 text-xs text-slate-500">
                Operator and administrator access
              </p>
            </div>
          </div>

          <label className="mb-2 block text-xs font-semibold text-slate-300">
            Email address
          </label>
          <input
            type="email"
            autoComplete="username"
            required
            maxLength={150}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mb-5 h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            placeholder="you@airspace.local"
          />

          <label className="mb-2 block text-xs font-semibold text-slate-300">
            Password
          </label>
          <input
            type="password"
            autoComplete="current-password"
            required
            maxLength={256}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            placeholder="Enter your password"
          />

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs leading-5 text-rose-200"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60"
          >
            <ShieldCheck size={17} />
            {loading ? "Signing in..." : "Sign in securely"}
          </button>

          <p className="mt-4 text-center text-[10px] leading-5 text-slate-500">
            Authentication is verified by the PostgreSQL user database.
          </p>
        </form>

        <footer className="mt-7 border-t border-slate-800 pt-5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Smart Airspace Conflict Analysis and Flight Intelligence System
          </p>
          <p className="mt-3 text-xs text-slate-300">
            Pranav Shashikiran Atreya (PES2UG24CS912)
          </p>
          <p className="mt-1 text-xs text-slate-300">
            Yash Raghavendra A (PES2UG24CS913)
          </p>
        </footer>
      </div>
    </main>
  );
}
