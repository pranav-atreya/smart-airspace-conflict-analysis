
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";

type ConflictEvent = {
  conflict_id: number;
  detected_at: string;
  conflict_type: string;
  severity: string;
  description: string | null;
  minimum_distance_nm: number | null;
  altitude_difference_ft: number | null;
  resolved: boolean;
  primary_flight_number: string | null;
  secondary_flight_number: string | null;
  airspace_code: string | null;
  airspace_name: string | null;
};

function severityStyle(value: string) {
  switch (value.toUpperCase()) {
    case "CRITICAL":
      return "bg-rose-500/15 text-rose-300 ring-rose-400/25";
    case "HIGH":
      return "bg-orange-500/15 text-orange-300 ring-orange-400/25";
    case "MEDIUM":
      return "bg-amber-500/15 text-amber-300 ring-amber-400/25";
    default:
      return "bg-slate-800 text-slate-300 ring-slate-700";
  }
}

export default function ConflictEventsPage() {
  const [events, setEvents] = useState<ConflictEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("ALL");
  const [openOnly, setOpenOnly] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/conflicts", {
          cache: "no-store",
        });
        const result = await response.json();

        if (!response.ok || !result.ok) {
          throw new Error(result.message || "Could not load conflicts.");
        }

        if (!cancelled) {
          setEvents(result.events);
        }
      } catch (error) {
        if (!cancelled) {
          setError(
            error instanceof Error
              ? error.message
              : "Could not load conflict events."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadEvents();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const filteredEvents = useMemo(() => {
    const searchText = query.toLowerCase();

    return events.filter((event) => {
      const text = [
        event.conflict_id,
        event.conflict_type,
        event.severity,
        event.primary_flight_number,
        event.secondary_flight_number,
        event.airspace_code,
        event.airspace_name,
        event.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        text.includes(searchText) &&
        (severity === "ALL" || event.severity === severity) &&
        (!openOnly || !event.resolved)
      );
    });
  }, [events, query, severity, openOnly]);

  const openCount = events.filter((event) => !event.resolved).length;
  const criticalCount = events.filter(
    (event) =>
      !event.resolved &&
      ["HIGH", "CRITICAL"].includes(event.severity.toUpperCase())
  ).length;
  const resolvedCount = events.filter((event) => event.resolved).length;

  return (
    <main className="min-h-screen bg-[#0b1120] p-5 text-slate-100 md:p-9">
      <div className="mx-auto max-w-[1450px] space-y-7">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
              <ShieldAlert size={23} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">
                Flight Operations
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">
                Conflict Events
              </h1>
            </div>
          </div>

          <div className="flex gap-3">
            <Link
              href="/"
              className="flex h-10 items-center gap-2 rounded-xl border border-slate-700 px-4 text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              <ArrowLeft size={15} />
              Dashboard
            </Link>

            <button
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
              className="flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold hover:bg-blue-500"
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>
        </header>

        <section>
          <p className="max-w-2xl text-sm leading-6 text-slate-400">
            Review recorded flight conflict events, inspect their severity,
            and filter unresolved events using live PostgreSQL data.
          </p>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              label: "Total events",
              value: events.length,
              description: "All recorded events",
              icon: ShieldAlert,
              colour: "text-blue-300 bg-blue-500/15",
            },
            {
              label: "Open events",
              value: openCount,
              description: "Awaiting review",
              icon: Clock3,
              colour: "text-amber-300 bg-amber-500/15",
            },
            {
              label: "High priority",
              value: criticalCount,
              description: "Unresolved high or critical events",
              icon: AlertTriangle,
              colour: "text-rose-300 bg-rose-500/15",
            },
          ].map((card) => {
            const Icon = card.icon;

            return (
              <article
                key={card.label}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-400">{card.label}</p>
                  <span className={`rounded-xl p-2 ${card.colour}`}>
                    <Icon size={19} />
                  </span>
                </div>
                <p className="mt-4 text-3xl font-bold">{card.value}</p>
                <p className="mt-2 text-xs text-slate-500">{card.description}</p>
              </article>
            );
          })}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-800 p-5 xl:flex-row xl:items-center">
            <div>
              <h2 className="font-bold">Recorded Events</h2>
              <p className="mt-1 text-xs text-slate-500">
                {filteredEvents.length} results displayed · {resolvedCount} resolved
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-700 px-3 sm:w-64">
                <Search size={15} className="shrink-0 text-slate-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search flight, type, airspace..."
                  className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-slate-500"
                />
              </label>

              <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-700 px-3">
                <Filter size={14} className="text-slate-500" />
                <select
                  value={severity}
                  onChange={(event) => setSeverity(event.target.value)}
                  className="bg-slate-900 text-xs outline-none"
                >
                  <option value="ALL">All severity levels</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </label>

              <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-700 px-3 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={openOnly}
                  onChange={(event) => setOpenOnly(event.target.checked)}
                  className="accent-blue-500"
                />
                Open only
              </label>
            </div>
          </div>

          {error && (
            <div className="m-5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
              {error}
            </div>
          )}

          {loading ? (
            <p className="p-8 text-sm text-slate-400">
              Loading conflict events…
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead className="bg-slate-800/60">
                  <tr className="text-[10px] uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-4">Event</th>
                    <th className="px-5 py-4">Flight / airspace</th>
                    <th className="px-5 py-4">Severity</th>
                    <th className="px-5 py-4">Measured separation</th>
                    <th className="px-5 py-4">Detected</th>
                    <th className="px-5 py-4">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800">
                  {filteredEvents.map((event) => (
                    <tr
                      key={event.conflict_id}
                      className="transition hover:bg-slate-800/30"
                    >
                      <td className="px-5 py-5">
                        <p className="text-xs font-bold text-slate-200">
                          #{event.conflict_id} ·{" "}
                          {event.conflict_type.replaceAll("_", " ")}
                        </p>
                        <p className="mt-2 max-w-sm whitespace-normal text-[11px] leading-5 text-slate-400">
                          {event.description || "No description provided."}
                        </p>
                      </td>

                      <td className="px-5 py-5">
                        <p className="text-xs font-semibold">
                          {event.primary_flight_number || "Unknown flight"}
                          {event.secondary_flight_number
                            ? ` / ${event.secondary_flight_number}`
                            : ""}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {event.airspace_name || "No airspace linked"}
                        </p>
                        {event.airspace_code && (
                          <p className="mt-1 text-[10px] text-slate-600">
                            {event.airspace_code}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${severityStyle(
                            event.severity
                          )}`}
                        >
                          {event.severity}
                        </span>
                      </td>

                      <td className="px-5 py-5 text-xs text-slate-300">
                        {event.minimum_distance_nm == null
                          ? "—"
                          : `${Number(event.minimum_distance_nm).toFixed(2)} NM`}
                        <p className="mt-1 text-[10px] text-slate-500">
                          {event.altitude_difference_ft == null
                            ? "Altitude difference: —"
                            : `Altitude difference: ${Number(
                                event.altitude_difference_ft
                              ).toLocaleString()} ft`}
                        </p>
                      </td>

                      <td className="px-5 py-5 text-xs text-slate-400">
                        {new Date(event.detected_at).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      <td className="px-5 py-5">
                        {event.resolved ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                            <CheckCircle2 size={14} />
                            Resolved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                            Open
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {filteredEvents.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-12 text-center text-sm text-slate-500"
                      >
                        No events match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>


        <footer className="flex flex-col justify-between gap-5 border-t border-slate-800 pt-6 pb-4 text-xs text-slate-500 sm:flex-row sm:items-end">
          <div>
            <p className="font-semibold uppercase tracking-wider text-slate-300">
              Smart Airspace Conflict Analysis and Flight Intelligence System
            </p>
            <p className="mt-2">
              Academic prototype · Sample aviation dataset
            </p>
          </div>

          <div className="text-left sm:text-right">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">
              Developed by
            </p>
            <p className="text-xs font-medium text-slate-200">
              Pranav Shashikiran Atreya (PES2UG24CS912)
            </p>
            <p className="mt-1 text-xs font-medium text-slate-200">
              Yash Raghavendra A (PES2UG24CS913)
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
