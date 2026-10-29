
"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock3,
  FileSearch,
  LoaderCircle,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

type SearchResult = {
  source_type: "NOTAM" | "INCIDENT";
  source_id: number;
  title: string;
  content: string;
  record_status: string;
  event_date: string;
  similarity: number;
};

type SearchResponse = {
  ok: boolean;
  query: string;
  model: string;
  dimensions: number;
  similarityMetric: string;
  resultCount: number;
  results: SearchResult[];
  message?: string;
};

const examples = [
  "restricted training area altitude limits",
  "temporary security closure around a prohibited zone",
  "aircraft entered restricted airspace",
  "aircraft approaching another flight too closely",
];

function formatDate(value: string) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function IntelligencePage() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState<SearchResponse | null>(null);

  async function runSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResponse(null);

    const trimmed = query.trim();

    if (trimmed.length < 3) {
      setError("Enter at least 3 characters to search.");
      return;
    }

    setSearching(true);

    try {
      const result = await fetch("/api/search/semantic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed, limit: 8 }),
      });

      const body = await result.json();

      if (!result.ok || !body.ok) {
        throw new Error(body.message || "Search request failed.");
      }

      setResponse(body);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to perform semantic search."
      );
    } finally {
      setSearching(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b1120] px-5 py-8 text-slate-100 md:px-9 md:py-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
              <FileSearch size={23} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">
                Flight intelligence
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">
                Semantic NOTAM Search
              </h1>
            </div>
          </div>

          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
          >
            <ArrowLeft size={15} />
            Dashboard
          </Link>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 md:p-8">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-300">
            <Sparkles size={16} />
            MEANING-BASED RETRIEVAL
          </div>

          <h2 className="mt-4 text-xl font-bold md:text-2xl">
            Search by meaning, not just matching words
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Find relevant aviation notices and incidents using a natural-language
            description. Results are ranked using cosine similarity between
            sentence embeddings stored in PostgreSQL with pgvector.
          </p>

          <form onSubmit={runSearch} className="mt-7 space-y-3">
            <label
              htmlFor="semantic-query"
              className="block text-xs font-semibold text-slate-300"
            >
              Describe the aviation information you want to find
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex min-h-12 flex-1 items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 px-4 focus-within:border-blue-500">
                <Search size={18} className="shrink-0 text-slate-500" />
                <input
                  id="semantic-query"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  maxLength={500}
                  minLength={3}
                  required
                  placeholder="e.g. temporary restrictions around flight operations"
                  className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-slate-600"
                />
              </div>

              <button
                type="submit"
                disabled={searching}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60"
              >
                {searching ? (
                  <LoaderCircle className="animate-spin" size={17} />
                ) : (
                  <Search size={17} />
                )}
                {searching ? "Searching..." : "Search"}
              </button>
            </div>
          </form>

          <div className="mt-5">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Try an example
            </p>
            <div className="flex flex-wrap gap-2">
              {examples.map((example) => (
                <button
                  type="button"
                  key={example}
                  onClick={() => setQuery(example)}
                  className="rounded-full border border-slate-700 px-3 py-2 text-xs text-slate-400 transition hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-200"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-200"
            >
              {error}
            </div>
          )}
        </section>

        {response && (
          <section className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  Search completed
                </p>
                <h2 className="mt-2 text-xl font-bold">
                  {response.resultCount} matching records
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Query: “{response.query}”
                </p>
              </div>

              <div className="text-right text-[10px] leading-5 text-slate-500">
                <p>{response.model}</p>
                <p>
                  {response.dimensions}-dimensional vectors ·{" "}
                  {response.similarityMetric}
                </p>
              </div>
            </div>

            {response.results.length === 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">
                No embedded records are available to search.
              </div>
            )}

            {response.results.map((result, index) => {
              const score = Number(result.similarity);
              const percentage = Number.isFinite(score)
                ? Math.round(Math.max(0, Math.min(1, score)) * 100)
                : 0;

              return (
                <article
                  key={`${result.source_type}-${result.source_id}`}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-5 md:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          result.source_type === "NOTAM"
                            ? "bg-blue-500/15 text-blue-300"
                            : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {result.source_type === "NOTAM" ? (
                          <FileSearch size={18} />
                        ) : (
                          <ShieldAlert size={18} />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {result.source_type} · #{result.source_id}
                          </span>
                          <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] text-slate-300">
                            {result.record_status}
                          </span>
                        </div>

                        <h3 className="text-base font-bold leading-6">
                          {result.title}
                        </h3>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-xl font-bold text-emerald-300">
                        {percentage}%
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        Similarity score
                      </p>
                    </div>
                  </div>

                  <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-300">
                    {result.content}
                  </p>

                  <div className="mt-5 flex items-center gap-2 border-t border-slate-800 pt-4 text-[10px] text-slate-500">
                    <Clock3 size={13} />
                    {formatDate(result.event_date)}
                    <span className="ml-auto">Rank #{index + 1}</span>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <footer className="border-t border-slate-800 pt-6 text-center">
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
