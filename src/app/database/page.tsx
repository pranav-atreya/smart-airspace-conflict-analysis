"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Database, RefreshCw, ShieldCheck, Layers3,
  GitBranch, BrainCircuit, Table2, CheckCircle2, AlertCircle,
} from "lucide-react";

type TableStat = { table_name: string; row_count: number };
type EmbeddingStat = {
  source: string;
  total_records: number;
  embedded_records: number;
  min_dimensions: number | null;
  max_dimensions: number | null;
};
type StatusData = {
  ok: boolean;
  message?: string;
  identity: {
    database_name: string;
    postgres_version: string;
    server_started_at: string;
  };
  objects: {
    table_count: number;
    view_count: number;
    trigger_count: number;
    routine_count: number;
    vector_extension: boolean;
    vector_index_count: number;
  };
  tables: TableStat[];
  embeddings: EmbeddingStat[];
  checked_at: string;
};

const panel = "rounded-2xl border border-slate-800 bg-slate-900/80";
const muted = "text-xs leading-5 text-slate-400";

export default function DatabaseStatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/database/status", {
          cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok || !result.ok) {
          throw new Error(result.message || "Could not load database status.");
        }
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Request failed.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const cards = data ? [
    { label: "Base tables", value: data.objects.table_count, icon: Table2 },
    { label: "Views", value: data.objects.view_count, icon: Layers3 },
    { label: "Triggers", value: data.objects.trigger_count, icon: GitBranch },
    { label: "Functions / procedures", value: data.objects.routine_count, icon: ShieldCheck },
    { label: "Vector indexes", value: data.objects.vector_index_count, icon: BrainCircuit },
  ] : [];

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-100 md:px-10">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-blue-600 p-3"><Database size={24} /></div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">System / Infrastructure</p>
              <h1 className="mt-1 text-2xl font-bold">Database Status</h1>
              <p className={muted}>Live PostgreSQL and schema diagnostics</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/" className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold hover:bg-slate-800">
              <ArrowLeft size={15} /> Dashboard
            </Link>
            <button onClick={() => setRefreshKey(v => v + 1)} className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold hover:bg-slate-800">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </header>

        {error && (
          <div role="alert" className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        <section className={panel + " p-5 md:p-6"}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className={muted}>Connection state</p>
              <h2 className="mt-1 text-lg font-bold">
                {loading ? "Checking connection..." : error ? "Status unavailable" : "PostgreSQL connected"}
              </h2>
            </div>
            <span className={"inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold " + (error ? "bg-rose-500/15 text-rose-300" : loading ? "bg-amber-500/15 text-amber-200" : "bg-emerald-500/15 text-emerald-300")}>
              {error ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
              {error ? "Needs attention" : loading ? "Checking" : "Online"}
            </span>
          </div>

          {data && (
            <div className="mt-5 grid gap-4 border-t border-slate-800 pt-5 md:grid-cols-3">
              <div><p className={muted}>Database</p><p className="mt-1 break-all font-semibold">{data.identity.database_name}</p></div>
              <div><p className={muted}>Vector extension</p><p className="mt-1 font-semibold">{data.objects.vector_extension ? "pgvector installed" : "Not detected"}</p></div>
              <div><p className={muted}>Last checked</p><p className="mt-1 font-semibold">{new Date(data.checked_at).toLocaleString()}</p></div>
            </div>
          )}
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {cards.map(card => {
            const Icon = card.icon;
            return (
              <div key={card.label} className={panel + " p-5"}>
                <div className="flex items-center justify-between gap-2">
                  <p className={muted}>{card.label}</p><Icon size={18} className="text-blue-300" />
                </div>
                <p className="mt-4 text-3xl font-bold">{loading ? "—" : card.value}</p>
                <p className="mt-1 text-[10px] text-slate-500">Current schema objects</p>
              </div>
            );
          })}
        </section>

        {data && <>
          <section className={panel + " overflow-hidden"}>
            <div className="border-b border-slate-800 px-5 py-4">
              <h2 className="font-bold">Table inventory</h2>
              <p className={"mt-1 " + muted}>Live row counts from application tables</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px] text-left text-sm">
                <thead className="bg-slate-800/70 text-[10px] uppercase tracking-wider text-slate-400">
                  <tr><th className="px-5 py-3">Table</th><th className="px-5 py-3 text-right">Rows</th></tr>
                </thead>
                <tbody>
                  {data.tables.map(table => (
                    <tr key={table.table_name} className="border-t border-slate-800">
                      <td className="px-5 py-3 font-medium">{table.table_name}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{table.row_count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={panel + " overflow-hidden"}>
            <div className="border-b border-slate-800 px-5 py-4">
              <div className="flex items-center gap-2"><BrainCircuit size={18} className="text-blue-300" /><h2 className="font-bold">Semantic embedding coverage</h2></div>
              <p className={"mt-1 " + muted}>Stored vectors in NOTAM and incident records</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] text-left text-sm">
                <thead className="bg-slate-800/70 text-[10px] uppercase tracking-wider text-slate-400">
                  <tr><th className="px-5 py-3">Source</th><th className="px-5 py-3 text-right">Records</th><th className="px-5 py-3 text-right">Embedded</th><th className="px-5 py-3 text-right">Dimensions</th></tr>
                </thead>
                <tbody>
                  {data.embeddings.map(item => (
                    <tr key={item.source} className="border-t border-slate-800">
                      <td className="px-5 py-3 font-medium">{item.source}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{item.total_records}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{item.embedded_records}</td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {item.min_dimensions == null ? "—" : item.min_dimensions === item.max_dimensions ? item.min_dimensions : item.min_dimensions + "–" + item.max_dimensions}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={panel + " p-5"}>
            <h2 className="font-bold">PostgreSQL server information</h2>
            <p className={"mt-1 " + muted}>Reported by the active database connection</p>
            <p className="mt-4 break-words text-xs leading-6 text-slate-300">{data.identity.postgres_version}</p>
            <p className={"mt-3 " + muted}>Server started: {new Date(data.identity.server_started_at).toLocaleString()}</p>
          </section>
        </>}

        <footer className="border-t border-slate-800 pt-5 text-[11px] text-slate-500">
          Smart Airspace Conflict Analysis and Flight Intelligence System · Database diagnostics
          <div className="mt-2">Pranav Shashikiran Atreya (PES2UG24CS912) · Yash Raghavendra A (PES2UG24CS913)</div>
        </footer>
      </div>
    </main>
  );
}
