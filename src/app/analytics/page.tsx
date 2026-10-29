"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity, AlertTriangle, ArrowLeft, Plane, RefreshCw,
  ShieldCheck, RadioTower, MapPinned, FileText,
} from "lucide-react";

type CountRow = {
  label: string;
  value: number;
  open_count?: number;
  resolved_count?: number;
};
type AnalyticsData = {
  ok: boolean;
  message?: string;
  summary: Record<string, number>;
  flightsByStatus: CountRow[];
  conflictsBySeverity: CountRow[];
  airspacesByType: CountRow[];
  notamsByStatus: CountRow[];
  conflictsByAirspace: CountRow[];
  checked_at: string;
};

const panel = "rounded-2xl border border-slate-800 bg-slate-900/80";
const muted = "text-xs leading-5 text-slate-400";

function BarPanel({
  title, description, rows, detail,
}: {
  title: string;
  description: string;
  rows: CountRow[];
  detail?: "conflicts" | "airspace";
}) {
  const maximum = Math.max(1, ...rows.map(row => Number(row.value) || 0));

  return (
    <section className={panel + " p-5"}>
      <h2 className="font-bold">{title}</h2>
      <p className={"mt-1 " + muted}>{description}</p>
      <div className="mt-5 space-y-5">
        {rows.length === 0 && <p className="py-5 text-sm text-slate-500">No records available.</p>}
        {rows.map(row => (
          <div key={row.label}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="truncate text-xs font-medium text-slate-300">{row.label.replaceAll("_", " ")}</span>
              <span className="shrink-0 text-xs font-bold tabular-nums">{row.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-blue-500" style={{ width: Math.max(2, (row.value / maximum) * 100) + "%" }} />
            </div>
            {detail === "conflicts" && <p className="mt-1 text-[10px] text-slate-500">Open: {row.open_count ?? 0} · Resolved: {row.resolved_count ?? 0}</p>}
            {detail === "airspace" && <p className="mt-1 text-[10px] text-slate-500">Open events: {row.open_count ?? 0}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function MetricCard({
  label, value, description, icon: Icon,
}: {
  label: string;
  value: number;
  description: string;
  icon: typeof Plane;
}) {
  return (
    <div className={panel + " p-5"}>
      <div className="flex items-center justify-between gap-2">
        <p className={muted}>{label}</p><Icon size={18} className="text-blue-300" />
      </div>
      <p className="mt-4 text-3xl font-bold tabular-nums">{value ?? 0}</p>
      <p className="mt-1 text-[10px] text-slate-500">{description}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/analytics", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok || !result.ok) {
          throw new Error(result.message || "Could not load analytics.");
        }
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Request failed.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const s = data?.summary;

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-100 md:px-10">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-blue-600 p-3"><Activity size={24} /></div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">System / Reporting</p>
              <h1 className="mt-1 text-2xl font-bold">Airspace Analytics</h1>
              <p className={muted}>Live aggregates from the project database</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/" className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold hover:bg-slate-800">
              <ArrowLeft size={15} /> Dashboard
            </Link>
            <button onClick={() => setRefreshKey(v => v + 1)} className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold hover:bg-slate-800"><RefreshCw size={14} /> Refresh</button>
          </div>
        </header>

        {error && <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>}
        {loading && !data && <div className={panel + " p-6 text-sm text-slate-400"}>Loading analytics from PostgreSQL...</div>}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total flights" value={Number(s?.total_flights ?? 0)} description="Registered flights" icon={Plane} />
          <MetricCard label="Active flights" value={Number(s?.active_flights ?? 0)} description="Currently marked active" icon={RadioTower} />
          <MetricCard label="Open conflicts" value={Number(s?.open_conflicts ?? 0)} description="Unresolved conflict events" icon={AlertTriangle} />
          <MetricCard label="High-priority open" value={Number(s?.high_priority_conflicts ?? 0)} description="HIGH and CRITICAL severity" icon={ShieldCheck} />
        </section>

        {data && <>
          <section className="grid gap-4 lg:grid-cols-2">
            <BarPanel title="Flights by status" description="Distribution of registered flight records" rows={data.flightsByStatus} />
            <BarPanel title="Conflicts by severity" description="Total, open, and resolved events by severity" rows={data.conflictsBySeverity} detail="conflicts" />
            <BarPanel title="Restricted airspace types" description="Current zones grouped by restriction type" rows={data.airspacesByType} />
            <BarPanel title="NOTAM records by status" description="Current notices grouped by database status" rows={data.notamsByStatus} />
          </section>

          <section className={panel + " p-5"}>
            <div className="flex items-center gap-2"><MapPinned size={18} className="text-blue-300" /><h2 className="font-bold">Conflict events by restricted airspace</h2></div>
            <p className={"mt-1 " + muted}>Airspaces with the highest recorded conflict counts</p>
            <div className="mt-5">
              <BarPanel title="Airspace comparison" description="Recorded events for each airspace" rows={data.conflictsByAirspace} detail="airspace" />
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className={panel + " p-5"}><p className={muted}>Completed flights</p><p className="mt-3 text-2xl font-bold">{s?.completed_flights ?? 0}</p></div>
            <div className={panel + " p-5"}><p className={muted}>Recorded positions</p><p className="mt-3 text-2xl font-bold">{s?.recorded_positions ?? 0}</p></div>
            <div className={panel + " p-5"}><p className={muted}>Incidents</p><p className="mt-3 text-2xl font-bold">{s?.total_incidents ?? 0}</p></div>
            <div className={panel + " p-5"}><div className="flex items-center gap-2"><FileText size={16} className="text-blue-300" /><p className={muted}>NOTAMs</p></div><p className="mt-3 text-2xl font-bold">{s?.total_notams ?? 0}</p></div>
          </section>
        </>}

        <footer className="border-t border-slate-800 pt-5 text-[11px] text-slate-500">
          Smart Airspace Conflict Analysis and Flight Intelligence System · Analytics
          <div className="mt-2">Pranav Shashikiran Atreya (PES2UG24CS912) · Yash Raghavendra A (PES2UG24CS913)</div>
          <div className="mt-2">Last data response: {data ? new Date(data.checked_at).toLocaleString() : "Not loaded"}</div>
        </footer>
      </div>
    </main>
  );
}
