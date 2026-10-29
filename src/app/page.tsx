"use client";

import { useEffect, useState } from "react";
import SessionControls from "@/components/session-controls";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  FileSearch,
  Gauge,
  MapPin,
  Navigation,
  Plane,
  Radar,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Wifi,
} from "lucide-react";

type Summary = {
  total_flights: number;
  active_flights: number;
  open_conflicts: number;
  high_priority: number;
  total_airspaces: number;
  total_notams: number;
  total_incidents: number;
};

type Flight = {
  flight_id: number;
  flight_number: string;
  registration_no: string;
  aircraft_type: string;
  departure_airport: string;
  arrival_airport: string;
  scheduled_departure: string;
  scheduled_arrival: string;
  status: string;
};

type Conflict = {
  conflict_id: number;
  detected_at: string;
  conflict_type: string;
  severity: string;
  description: string | null;
  resolved: boolean;
  flight_number: string | null;
  airspace_name: string | null;
};

type Airspace = {
  airspace_id: number;
  airspace_code: string;
  airspace_name: string;
  restriction_type: string;
  lower_altitude_ft: number;
  upper_altitude_ft: number;
  radius_nm: number;
  valid_from: string;
  valid_to: string;
};

type DashboardData = {
  ok: boolean;
  summary: Summary;
  recentFlights: Flight[];
  recentConflicts: Conflict[];
  airspaces: Airspace[];
};

const navigationItems = [
  { label: "Overview", href: "#overview", icon: Gauge },
  { label: "Flights", href: "/flights", icon: Plane },
  { label: "Conflict Events", href: "/conflicts", icon: ShieldAlert },
  { label: "Restricted Airspace", href: "/airspaces", icon: Radar },
  { label: "NOTAM Intelligence", href: "/intelligence", icon: FileSearch },
];

function formatDate(value: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function statusStyle(status: string) {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30";
    case "SCHEDULED":
      return "bg-blue-500/15 text-blue-300 ring-blue-400/30";
    case "COMPLETED":
    case "RESOLVED":
      return "bg-slate-800 text-slate-300 ring-slate-700";
    case "CANCELLED":
      return "bg-rose-500/15 text-rose-300 ring-rose-400/30";
    default:
      return "bg-slate-800 text-slate-300 ring-slate-700";
  }
}

function severityStyle(severity: string) {
  switch (severity.toUpperCase()) {
    case "CRITICAL":
      return "bg-rose-500/15 text-rose-300";
    case "HIGH":
      return "bg-orange-500/15 text-orange-300";
    case "MEDIUM":
      return "bg-amber-500/15 text-amber-300";
    default:
      return "bg-slate-800 text-slate-300";
  }
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<number[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(
          "airspace-dismissed-notification-ids"
        );

        if (saved) {
          const parsed: unknown = JSON.parse(saved);

          if (Array.isArray(parsed)) {
            setDismissedNotificationIds(
              parsed.filter(
                (value): value is number =>
                  typeof value === "number" && Number.isFinite(value)
              )
            );
          }
        }
      } catch {
        // Notifications still work if browser storage is unavailable.
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState("");

  const visibleNotifications = (data?.recentConflicts ?? []).filter(
    (item) =>
      !item.resolved &&
      !dismissedNotificationIds.includes(item.conflict_id)
  );

  function clearNotifications() {
    const currentIds = (data?.recentConflicts ?? [])
      .filter((item) => !item.resolved)
      .map((item) => item.conflict_id);

    const nextIds = [...new Set([...dismissedNotificationIds, ...currentIds])];

    setDismissedNotificationIds(nextIds);

    try {
      window.localStorage.setItem(
        "airspace-dismissed-notification-ids",
        JSON.stringify(nextIds)
      );
    } catch {
      // The alerts are still cleared from the current UI.
    }
  }

  async function runConflictAnalysis() {
    setRunningAnalysis(true);
    setAnalysisMessage("");

    try {
      const response = await fetch("/api/analysis/run", {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(
          result.message || "Conflict analysis failed."
        );
      }

      setAnalysisMessage(
        `Analysis complete: ${result.analysedPositions} positions checked, ${result.candidateEvents} candidate events found, and ${result.insertedEvents} new events saved.`
      );

      setRefreshKey((value) => value + 1);
    } catch (error) {
      console.error("Conflict analysis failed:", error);

      setAnalysisMessage(
        error instanceof Error
          ? error.message
          : "Analysis failed. Check the server terminal."
      );
    } finally {
      setRunningAnalysis(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/dashboard", {
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok || !result.ok) {
          throw new Error("Unable to retrieve dashboard data.");
        }

        if (!cancelled) {
          setData(result);
        }
      } catch {
        if (!cancelled) {
          setError(
            "Could not load dashboard data. Check the Next.js terminal."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const filteredFlights = (data?.recentFlights ?? []).filter((flight) => {
    const query = search.toLowerCase();

    return [
      flight.flight_number,
      flight.registration_no,
      flight.aircraft_type,
      flight.departure_airport,
      flight.arrival_airport,
      flight.status,
    ]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query));
  });

  const stats = data?.summary;

  return (
    <main className="min-h-screen bg-[#0b1120] text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-[248px] shrink-0 flex-col border-r border-slate-800 bg-slate-900 lg:flex">
          <div className="flex h-[82px] items-center gap-3 border-b border-slate-800 px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-white shadow-lg shadow-blue-200">
              <Plane size={22} />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight">
                AIRSPACE INTEL
              </h1>


              <p className="mt-1 text-[10px] font-medium tracking-[0.2em] text-slate-400">
                FLIGHT OPERATIONS
              </p>
            </div>
          </div>

          <div className="px-4 pt-7">
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Workspace
            </p>

            <nav className="space-y-1">
              {navigationItems.map((item, index) => {
                const Icon = item.icon;
                const active = index === 0;

                return (
                  <a
                    key={item.label}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-medium transition ${
                      active
                        ? "bg-blue-500/15 text-blue-300"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                    }`}
                  >
                    <Icon size={17} />
                    <span>{item.label}</span>
                    {active && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600" />
                    )}
                  </a>
                );
              })}
            </nav>
          </div>

          <div className="mt-8 px-4">
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              System
            </p>

            <div className="space-y-1">
              <a
                href="/database"
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
              >
                <Database size={17} />
                <span>Database Status</span>
              </a>
              <a
                href="/analytics"
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
              >
                <Activity size={17} />
                <span>Analytics</span>
              </a>
            </div>
          </div>

          <div className="mt-auto p-4">
            <div className="rounded-2xl bg-slate-900 p-4 text-white">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <ShieldCheck size={16} className="text-emerald-400" />
                Database Connected
              </div>
              <p className="mt-2 text-[11px] leading-5 text-slate-400">
                PostgreSQL 18 · Local environment
              </p>
              <div className="mt-4 flex items-center gap-2 text-[10px] text-emerald-400">
                <Wifi size={13} />
                Connection verified
              </div>
            </div>
            <p className="mt-4 text-center text-[10px] text-slate-400">
              DBMS LEVEL 3 MINI-PROJECT
            </p>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 flex h-[72px] items-center justify-between border-b border-slate-800 bg-slate-950/95 px-5 backdrop-blur-md md:px-9">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">
                Operations Centre
              </p>
              <h2 className="mt-1 text-lg font-bold tracking-tight">
                Flight Intelligence
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-2 text-[11px] font-semibold text-emerald-300 sm:flex">
                <span className="h-2 w-2 rounded-full bg-emerald-500/150" />
                SYSTEM ONLINE
              </div>
              <button
                type="button"
                onClick={() => setRefreshKey((value) => value + 1)}
                className="flex h-10 items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
              >
                <RefreshCw size={14} />
                <span className="hidden sm:inline">Refresh data</span>
              </button>

              <button
                type="button"
                onClick={runConflictAnalysis}
                disabled={runningAnalysis}
                className="flex h-10 items-center gap-2 rounded-xl border border-blue-500/40 bg-blue-600 px-3 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60"
              >
                <span aria-hidden="true">↻</span>
                <span>
                  {runningAnalysis
                    ? "Analysing..."
                    : "Run conflict analysis"}
                </span>
              </button>
<div className="relative">
              <button
                type="button"
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((open) => !open)}
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
              >
                <Bell size={17} />
                {visibleNotifications.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white ring-2 ring-slate-950">
                    {visibleNotifications.length}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 top-12 z-50 w-[min(92vw,390px)] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/40">
                  <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">
                        Conflict notifications
                      </h3>
                      <p className="mt-1 text-[10px] text-slate-400">
                        Recent unresolved events
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={clearNotifications}
                        disabled={visibleNotifications.length === 0}
                        className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotificationsOpen(false)}
                        className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-white"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[360px] overflow-y-auto">
                    {visibleNotifications.slice(0, 5).map((item) => (
                        <a
                          key={item.conflict_id}
                          href="/conflicts"
                          onClick={() => setNotificationsOpen(false)}
                          className="block border-b border-slate-800 px-4 py-4 transition hover:bg-slate-800/60"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-xs font-semibold text-slate-200">
                              {item.conflict_type.replaceAll("_", " ")}
                            </p>
                            <span
                              className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${
                                item.severity === "CRITICAL"
                                  ? "bg-rose-500/15 text-rose-300"
                                  : item.severity === "HIGH"
                                    ? "bg-orange-500/15 text-orange-300"
                                    : item.severity === "MEDIUM"
                                      ? "bg-amber-500/15 text-amber-300"
                                      : "bg-slate-800 text-slate-300"
                              }`}
                            >
                              {item.severity}
                            </span>
                          </div>
                          <p className="mt-2 text-[11px] leading-5 text-slate-400">
                            {item.description || "No description provided."}
                          </p>
                          <p className="mt-2 text-[10px] text-slate-500">
                            {item.flight_number || "Unknown flight"}
                            {" · "}
                            {item.airspace_name || "No linked airspace"}
                          </p>
                        </a>
                      ))}

                    {visibleNotifications.length === 0 && (
                      <div className="px-4 py-8 text-center">
                        <CheckCircle2
                          size={22}
                          className="mx-auto text-emerald-400"
                        />
                        <p className="mt-3 text-xs font-semibold text-slate-200">
                          No open events in recent records
                        </p>
                        <p className="mt-1 text-[10px] text-slate-500">
                          Run conflict analysis to refresh the dashboard.
                        </p>
                      </div>
                    )}
                  </div>

                  <a
                    href="/conflicts"
                    onClick={() => setNotificationsOpen(false)}
                    className="block border-t border-slate-800 px-4 py-3 text-center text-xs font-semibold text-blue-300 transition hover:bg-slate-800/60"
                  >
                    View all conflict events
                  </a>
                </div>
              )}
            </div>
              <SessionControls />
            </div>
          </header>

          <div id="overview" className="mx-auto max-w-[1500px] space-y-7 p-5 md:p-9">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-xs font-semibold text-slate-400">
                  FLIGHT MONITORING / OVERVIEW
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight md:text-[30px]">
                  Airspace Overview
                </h2>
                {analysisMessage && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="mt-4 max-w-3xl rounded-xl border border-blue-400/30 bg-blue-500/10 p-4 text-sm leading-6 text-blue-100 shadow-lg shadow-black/10"
                  >
                    <div className="mb-1 flex items-center gap-2 font-semibold text-blue-300">
                      <span aria-hidden="true">●</span>
                      Conflict analysis result
                    </div>
                    {analysisMessage}
                  </div>
                )}
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                  Monitor flight activity, review conflict events, and inspect
                  restricted airspace using your project database.
                </p>
              </div>

              <div className="flex w-fit items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-slate-400">
                <Clock3 size={15} />
                Local database snapshot
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-500/15 p-4 text-sm text-rose-300">
                <AlertTriangle size={19} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Dashboard data unavailable</p>
                  <p className="mt-1">{error}</p>
                  <button
                    type="button"
                    onClick={() => setRefreshKey((value) => value + 1)}
                    className="mt-3 font-semibold underline"
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}

            {loading && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">
                Loading live database records…
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  title: "Total Flights",
                  value: stats?.total_flights,
                  note: "Registered flight records",
                  icon: Plane,
                  iconStyle: "bg-blue-500/15 text-blue-300",
                },
                {
                  title: "Active Flights",
                  value: stats?.active_flights,
                  note: "Currently marked active",
                  icon: Navigation,
                  iconStyle: "bg-emerald-500/15 text-emerald-300",
                },
                {
                  title: "Open Conflicts",
                  value: stats?.open_conflicts,
                  note: "Awaiting resolution",
                  icon: ShieldAlert,
                  iconStyle: "bg-amber-500/15 text-amber-300",
                },
                {
                  title: "High Priority",
                  value: stats?.high_priority,
                  note: "Unresolved high/critical events",
                  icon: AlertTriangle,
                  iconStyle: "bg-rose-500/15 text-rose-300",
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <article
                    key={item.title}
                    className="rounded-2xl border border-slate-800/80 bg-slate-900 p-5 shadow-sm shadow-black/20"
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-[13px] font-medium text-slate-400">
                        {item.title}
                      </p>
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.iconStyle}`}
                      >
                        <Icon size={19} />
                      </div>
                    </div>
                    <p className="mt-5 text-3xl font-bold tracking-tight">
                      {item.value ?? "—"}
                    </p>
                    <p className="mt-2 text-[11px] text-slate-400">
                      {item.note}
                    </p>
                  </article>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                {
                  label: "Restricted Airspaces",
                  value: stats?.total_airspaces,
                  icon: Radar,
                },
                {
                  label: "NOTAM Records",
                  value: stats?.total_notams,
                  icon: FileSearch,
                },
                {
                  label: "Incident Records",
                  value: stats?.total_incidents,
                  icon: Activity,
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-4 rounded-2xl border border-slate-800/80 bg-slate-900 px-5 py-4"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-300">
                      <Icon size={18} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">{item.label}</p>
                      <p className="mt-1 text-xl font-bold">
                        {item.value ?? "—"}
                      </p>
                    </div>
                    <ArrowUpRight
                      size={16}
                      className="ml-auto text-slate-300"
                    />
                  </div>
                );
              })}
            </div>

            <section
              id="flights"
              className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900 shadow-sm shadow-black/20"
            >
              <div className="flex flex-col justify-between gap-4 border-b border-slate-800 p-5 sm:flex-row sm:items-center">
                <div>
                  <h3 className="font-bold">Flight Operations</h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Recent records from active and scheduled flights
                  </p>
                </div>
                <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-800 px-3 sm:w-[250px]">
                  <Search size={16} className="shrink-0 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search flight or aircraft..."
                    className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left">
                  <thead className="bg-slate-800/70">
                    <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="px-5 py-3">Flight</th>
                      <th className="px-5 py-3">Aircraft</th>
                      <th className="px-5 py-3">Route</th>
                      <th className="px-5 py-3">Departure</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredFlights.map((flight) => (
                      <tr
                        key={flight.flight_id}
                        className="transition hover:bg-slate-800/60"
                      >
                        <td className="px-5 py-4">
                          <p className="text-sm font-bold">
                            {flight.flight_number}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            ID #{flight.flight_id}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-xs font-semibold text-slate-200">
                            {flight.registration_no}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            {flight.aircraft_type}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-xs font-medium">
                            {flight.departure_airport}
                            <ChevronRight
                              size={13}
                              className="text-slate-400"
                            />
                            {flight.arrival_airport}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-400">
                          {formatDate(flight.scheduled_departure)}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${statusStyle(
                              flight.status
                            )}`}
                          >
                            {flight.status}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {!loading && filteredFlights.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-5 py-10 text-center text-sm text-slate-400"
                        >
                          No matching flights found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3">
                <p className="text-[11px] text-slate-400">
                  Showing {filteredFlights.length} of{" "}
                  {data?.recentFlights.length ?? 0} recent records
                </p>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-300">
                  <CheckCircle2 size={13} />
                  Database sourced
                </span>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <section
                id="conflicts"
                className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900 shadow-sm shadow-black/20"
              >
                <div className="flex items-center justify-between border-b border-slate-800 p-5">
                  <div>
                    <h3 className="font-bold">Conflict Events</h3>
                    <p className="mt-1 text-xs text-slate-400">
                      Recent recorded analysis events
                    </p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
                    <ShieldAlert size={17} />
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {(data?.recentConflicts ?? []).map((conflict) => (
                    <div key={conflict.conflict_id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">
                            {conflict.conflict_type.replaceAll("_", " ")}
                          </p>
                          <p className="mt-1 text-[11px] leading-5 text-slate-400">
                            {conflict.description || "No description provided."}
                          </p>
                          <p className="mt-2 text-[10px] text-slate-400">
                            {conflict.flight_number || "Flight not assigned"}
                            {" · "}
                            {conflict.airspace_name || "No airspace linked"}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${severityStyle(
                            conflict.severity
                          )}`}
                        >
                          {conflict.severity}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">
                          {formatDate(conflict.detected_at)}
                        </span>
                        <span
                          className={`text-[10px] font-semibold ${
                            conflict.resolved
                              ? "text-emerald-300"
                              : "text-amber-300"
                          }`}
                        >
                          {conflict.resolved ? "Resolved" : "Open"}
                        </span>
                      </div>
                    </div>
                  ))}

                  {!loading && (data?.recentConflicts.length ?? 0) === 0 && (
                    <p className="p-6 text-sm text-slate-400">
                      No conflict events recorded.
                    </p>
                  )}
                </div>
              </section>

              <section
                id="airspace"
                className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900 shadow-sm shadow-black/20"
              >
                <div className="flex items-center justify-between border-b border-slate-800 p-5">
                  <div>
                    <h3 className="font-bold">Restricted Airspace</h3>
                    <p className="mt-1 text-xs text-slate-400">
                      Configured monitoring zones
                    </p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                    <Radar size={17} />
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {(data?.airspaces ?? []).map((airspace) => (
                    <div key={airspace.airspace_id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-300">
                            <MapPin size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">
                              {airspace.airspace_name}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-400">
                              {airspace.airspace_code}
                              {" · "}
                              {airspace.radius_nm} NM radius
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-blue-500/15 px-2.5 py-1 text-[10px] font-bold text-blue-300">
                          {airspace.restriction_type}
                        </span>
                      </div>
                      <div className="ml-12 mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-slate-400">
                        <span>
                          Lower:{" "}
                          {airspace.lower_altitude_ft.toLocaleString()} ft
                        </span>
                        <span>
                          Upper:{" "}
                          {airspace.upper_altitude_ft.toLocaleString()} ft
                        </span>
                        <span>
                          Valid until {formatDate(airspace.valid_to)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section
              id="intelligence"
              className="rounded-2xl bg-slate-900 p-6 text-white md:p-8"
            >
              <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
                <div className="max-w-xl">
                  <div className="flex items-center gap-2 text-xs font-semibold text-blue-300">
                    <FileSearch size={16} />
                    NOTAM INTELLIGENCE
                  </div>
                  <h3 className="mt-3 text-xl font-bold tracking-tight md:text-2xl">
                    Semantic aviation search
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Search NOTAM and incident descriptions using 384-dimensional embeddings and pgvector similarity ranking. Open Semantic Aviation Search to retrieve matching database records.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 rounded-xl border border-white/10 bg-slate-900/5 px-4 py-3">
                  <Database size={20} className="text-blue-300" />
                  <div>
                    <p className="text-xs font-semibold">PostgreSQL + pgvector</p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      Semantic search implemented
                    </p>
                  </div>
                </div>
              </div>
            </section>


            <footer className="flex flex-col justify-between gap-5 border-t border-slate-800 pt-5 pb-4 text-[10px] text-slate-400 md:flex-row md:items-end">
              <div>
                <p className="font-semibold tracking-[0.12em] text-slate-300">
                  SMART AIRSPACE CONFLICT ANALYSIS AND FLIGHT INTELLIGENCE SYSTEM
                </p>
                <p className="mt-2">
                  Academic prototype · Sample aviation dataset
                </p>
              </div>

              <div className="text-left md:text-right">
                <p className="mb-2 font-bold uppercase tracking-[0.18em] text-blue-300">
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
        </section>
      </div>
    </main>
  );
}