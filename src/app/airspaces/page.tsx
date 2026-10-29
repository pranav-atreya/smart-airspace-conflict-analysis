
"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

type RestrictionType = "RESTRICTED" | "PROHIBITED" | "DANGER";

type Airspace = {
  airspace_id: number;
  airspace_code: string;
  airspace_name: string;
  restriction_type: RestrictionType;
  center_latitude: number | string;
  center_longitude: number | string;
  radius_nm: number | string;
  lower_altitude_ft: number;
  upper_altitude_ft: number;
  valid_from: string;
  valid_to: string;
};

type AirspaceForm = {
  airspaceCode: string;
  airspaceName: string;
  restrictionType: RestrictionType;
  centerLatitude: string;
  centerLongitude: string;
  radiusNm: string;
  lowerAltitudeFt: string;
  upperAltitudeFt: string;
  validFrom: string;
  validTo: string;
};

type ApiResponse = {
  ok: boolean;
  message?: string;
  role?: "ADMIN" | "OPERATOR";
  airspaces?: Airspace[];
  airspace?: Airspace;
};

const blankForm: AirspaceForm = {
  airspaceCode: "",
  airspaceName: "",
  restrictionType: "RESTRICTED",
  centerLatitude: "",
  centerLongitude: "",
  radiusNm: "",
  lowerAltitudeFt: "0",
  upperAltitudeFt: "25000",
  validFrom: "",
  validTo: "",
};

const inputClass =
  "mt-2 h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition focus:border-blue-500";

function typeClass(type: RestrictionType) {
  switch (type) {
    case "PROHIBITED":
      return "border-rose-500/30 bg-rose-500/10 text-rose-300";
    case "DANGER":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    default:
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  }
}

function displayNumber(value: number | string, digits = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "—";
}

export default function AirspaceManagementPage() {
  const [airspaces, setAirspaces] = useState<Airspace[]>([]);
  const [role, setRole] = useState<"ADMIN" | "OPERATOR" | null>(null);
  const [form, setForm] = useState<AirspaceForm>(blankForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const isAdmin = role === "ADMIN";

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/airspaces", {
        cache: "no-store",
      });
      const result: ApiResponse = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Unable to load airspaces.");
      }

      setAirspaces(result.airspaces ?? []);
      setRole(result.role ?? null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load restricted airspace records."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadData, refreshKey]);

  const filteredAirspaces = airspaces.filter((item) => {
    const searchable = [
      item.airspace_code,
      item.airspace_name,
      item.restriction_type,
      item.center_latitude,
      item.center_longitude,
    ]
      .join(" ")
      .toLowerCase();

    return searchable.includes(search.toLowerCase());
  });

  function updateField<K extends keyof AirspaceForm>(
    key: K,
    value: AirspaceForm[K]
  ) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function resetForm() {
    setForm(blankForm);
    setEditingId(null);
  }

  function beginEdit(item: Airspace) {
    setError("");
    setMessage("");
    setEditingId(item.airspace_id);

    setForm({
      airspaceCode: item.airspace_code,
      airspaceName: item.airspace_name,
      restrictionType: item.restriction_type,
      centerLatitude: String(item.center_latitude),
      centerLongitude: String(item.center_longitude),
      radiusNm: String(item.radius_nm),
      lowerAltitudeFt: String(item.lower_altitude_ft),
      upperAltitudeFt: String(item.upper_altitude_ft),
      validFrom: item.valid_from.slice(0, 16),
      validTo: item.valid_to.slice(0, 16),
    });

    document
      .getElementById("airspace-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveAirspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const latitude = Number(form.centerLatitude);
    const longitude = Number(form.centerLongitude);
    const radius = Number(form.radiusNm);
    const lower = Number(form.lowerAltitudeFt);
    const upper = Number(form.upperAltitudeFt);

    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90
    ) {
      setError("Latitude must be between -90 and 90.");
      return;
    }

    if (
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      setError("Longitude must be between -180 and 180.");
      return;
    }

    if (!Number.isFinite(radius) || radius <= 0 || radius > 1000) {
      setError("Radius must be greater than 0 and no more than 1000 NM.");
      return;
    }

    if (
      !Number.isInteger(lower) ||
      !Number.isInteger(upper) ||
      lower < 0 ||
      upper > 100000 ||
      upper < lower
    ) {
      setError(
        "Enter valid altitudes; the upper altitude must be greater than or equal to the lower altitude."
      );
      return;
    }

    if (
      !form.validFrom ||
      !form.validTo ||
      !Number.isFinite(Date.parse(form.validFrom)) ||
      !Number.isFinite(Date.parse(form.validTo)) ||
      Date.parse(form.validTo) <= Date.parse(form.validFrom)
    ) {
      setError("The validity end date must be later than its start date.");
      return;
    }

    const payload = {
      airspaceCode: form.airspaceCode.trim(),
      airspaceName: form.airspaceName.trim(),
      restrictionType: form.restrictionType,
      centerLatitude: latitude,
      centerLongitude: longitude,
      radiusNm: radius,
      lowerAltitudeFt: lower,
      upperAltitudeFt: upper,
      validFrom: form.validFrom,
      validTo: form.validTo,
      ...(editingId !== null ? { airspaceId: editingId } : {}),
    };

    setSaving(true);

    try {
      const response = await fetch("/api/airspaces", {
        method: editingId !== null ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result: ApiResponse = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Unable to save airspace.");
      }

      setMessage(
        result.message ||
          (editingId !== null
            ? "Airspace updated successfully."
            : "Airspace created successfully.")
      );

      resetForm();
      setRefreshKey((value) => value + 1);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save airspace."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteAirspace(item: Airspace) {
    const confirmed = window.confirm(
      `Delete ${item.airspace_name} (${item.airspace_code})?\n\n` +
        "The database may reject deletion if other records reference this airspace."
    );

    if (!confirmed) return;

    setError("");
    setMessage("");
    setSaving(true);

    try {
      const response = await fetch("/api/airspaces", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ airspaceId: item.airspace_id }),
      });

      const result: ApiResponse = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Unable to delete airspace.");
      }

      setMessage(result.message || "Airspace deleted successfully.");

      if (editingId === item.airspace_id) resetForm();

      setRefreshKey((value) => value + 1);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to delete airspace."
      );
    } finally {
      setSaving(false);
    }
  }

  const prohibitedCount = airspaces.filter(
    (item) => item.restriction_type === "PROHIBITED"
  ).length;

  const dangerCount = airspaces.filter(
    (item) => item.restriction_type === "DANGER"
  ).length;

  return (
    <main className="min-h-screen bg-[#0b1120] px-5 py-8 text-slate-100 md:px-9 md:py-10">
      <div className="mx-auto max-w-[1500px] space-y-7">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
              <MapPin size={23} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">
                Flight Operations
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">
                Restricted Airspace
              </h1>
              <p className="mt-1 text-xs text-slate-400">
                Manage monitored zones, altitude bands and validity periods
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="flex h-10 items-center gap-2 rounded-xl border border-slate-700 px-4 text-sm text-slate-300 transition hover:bg-slate-800"
            >
              <ArrowLeft size={15} />
              Dashboard
            </Link>

            <button
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
              disabled={loading || saving}
              className="flex h-10 items-center gap-2 rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: "Total zones", value: airspaces.length },
            { label: "Prohibited zones", value: prohibitedCount },
            { label: "Danger areas", value: dangerCount },
          ].map((card) => (
            <article
              key={card.label}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
            >
              <p className="text-sm text-slate-400">{card.label}</p>
              <p className="mt-3 text-3xl font-bold">{card.value}</p>
              <p className="mt-2 text-[11px] text-slate-500">
                Current database records
              </p>
            </article>
          ))}
        </section>

        {message && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200"
          >
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            {message}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-200"
          >
            <CircleAlert size={18} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {isAdmin ? (
          <section
            id="airspace-form"
            className="scroll-mt-5 rounded-2xl border border-slate-800 bg-slate-900 p-5 md:p-7"
          >
            <div className="mb-6 flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                {editingId !== null ? <Pencil size={19} /> : <Plus size={19} />}
              </div>
              <div className="flex-1">
                <h2 className="font-bold">
                  {editingId !== null
                    ? `Edit airspace #${editingId}`
                    : "Register restricted airspace"}
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Configure the geographic zone, vertical limits and period
                  during which the restriction applies.
                </p>
              </div>

              {editingId !== null && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
                >
                  <X size={14} />
                  Cancel
                </button>
              )}
            </div>

            <form onSubmit={saveAirspace} className="space-y-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                <label className="text-xs font-semibold text-slate-300">
                  Airspace code *
                  <input
                    required
                    minLength={2}
                    maxLength={30}
                    value={form.airspaceCode}
                    onChange={(e) =>
                      updateField("airspaceCode", e.target.value)
                    }
                    placeholder="e.g. TEST-ZONE-01"
                    className={inputClass}
                  />
                </label>

                <label className="text-xs font-semibold text-slate-300">
                  Airspace name *
                  <input
                    required
                    minLength={3}
                    maxLength={150}
                    value={form.airspaceName}
                    onChange={(e) =>
                      updateField("airspaceName", e.target.value)
                    }
                    placeholder="Demonstration testing zone"
                    className={inputClass}
                  />
                </label>

                <label className="text-xs font-semibold text-slate-300">
                  Restriction type *
                  <select
                    value={form.restrictionType}
                    onChange={(e) =>
                      updateField(
                        "restrictionType",
                        e.target.value as RestrictionType
                      )
                    }
                    className={inputClass}
                  >
                    <option value="RESTRICTED">RESTRICTED</option>
                    <option value="PROHIBITED">PROHIBITED</option>
                    <option value="DANGER">DANGER</option>
                  </select>
                </label>

                <label className="text-xs font-semibold text-slate-300">
                  Centre latitude *
                  <input
                    type="number"
                    required
                    min="-90"
                    max="90"
                    step="any"
                    value={form.centerLatitude}
                    onChange={(e) =>
                      updateField("centerLatitude", e.target.value)
                    }
                    placeholder="28.7000"
                    className={inputClass}
                  />
                </label>

                <label className="text-xs font-semibold text-slate-300">
                  Centre longitude *
                  <input
                    type="number"
                    required
                    min="-180"
                    max="180"
                    step="any"
                    value={form.centerLongitude}
                    onChange={(e) =>
                      updateField("centerLongitude", e.target.value)
                    }
                    placeholder="77.2000"
                    className={inputClass}
                  />
                </label>

                <label className="text-xs font-semibold text-slate-300">
                  Radius (nautical miles) *
                  <input
                    type="number"
                    required
                    min="0.01"
                    max="1000"
                    step="any"
                    value={form.radiusNm}
                    onChange={(e) => updateField("radiusNm", e.target.value)}
                    placeholder="10"
                    className={inputClass}
                  />
                </label>

                <label className="text-xs font-semibold text-slate-300">
                  Lower altitude (ft) *
                  <input
                    type="number"
                    required
                    min="0"
                    max="100000"
                    step="1"
                    value={form.lowerAltitudeFt}
                    onChange={(e) =>
                      updateField("lowerAltitudeFt", e.target.value)
                    }
                    className={inputClass}
                  />
                </label>

                <label className="text-xs font-semibold text-slate-300">
                  Upper altitude (ft) *
                  <input
                    type="number"
                    required
                    min="0"
                    max="100000"
                    step="1"
                    value={form.upperAltitudeFt}
                    onChange={(e) =>
                      updateField("upperAltitudeFt", e.target.value)
                    }
                    className={inputClass}
                  />
                </label>

                <label className="text-xs font-semibold text-slate-300">
                  Valid from *
                  <input
                    type="datetime-local"
                    required
                    value={form.validFrom}
                    onChange={(e) => updateField("validFrom", e.target.value)}
                    className={inputClass}
                  />
                </label>

                <label className="text-xs font-semibold text-slate-300">
                  Valid until *
                  <input
                    type="datetime-local"
                    required
                    value={form.validTo}
                    onChange={(e) => updateField("validTo", e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-5">
                <p className="text-[11px] text-slate-500">
                  Coordinate, radius, altitude and validity rules are also
                  enforced by PostgreSQL.
                </p>
                <button
                  type="submit"
                  disabled={saving || loading}
                  className="flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-500 disabled:opacity-50"
                >
                  {editingId !== null ? <Pencil size={15} /> : <Plus size={16} />}
                  {saving
                    ? "Saving..."
                    : editingId !== null
                      ? "Save changes"
                      : "Create airspace"}
                </button>
              </div>
            </form>
          </section>
        ) : (
          <section className="flex items-start gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
            <ShieldCheck size={19} className="mt-0.5 shrink-0 text-blue-300" />
            <div>
              <h2 className="text-sm font-semibold">Operator access</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                You can view and search restricted airspace. Only Admin users
                can create, edit or delete zones, enforced by the API.
              </p>
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-800 p-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-bold">Configured zones</h2>
              <p className="mt-1 text-xs text-slate-400">
                {filteredAirspaces.length} of {airspaces.length} records displayed
              </p>
            </div>

            <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-700 px-3 sm:w-80">
              <Search size={15} className="shrink-0 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search code, zone or type..."
                className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-slate-500"
              />
            </label>
          </div>

          {loading ? (
            <p className="p-7 text-sm text-slate-400">
              Loading airspace records...
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left">
                <thead className="bg-slate-800/70">
                  <tr className="text-[10px] uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-4">Zone</th>
                    <th className="px-5 py-4">Restriction</th>
                    <th className="px-5 py-4">Centre</th>
                    <th className="px-5 py-4">Radius</th>
                    <th className="px-5 py-4">Altitude band</th>
                    <th className="px-5 py-4">Validity</th>
                    {isAdmin && (
                      <th className="px-5 py-4">Admin actions</th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800">
                  {filteredAirspaces.map((item) => (
                    <tr
                      key={item.airspace_id}
                      className="transition hover:bg-slate-800/30"
                    >
                      <td className="px-5 py-5">
                        <p className="text-sm font-bold">{item.airspace_name}</p>
                        <p className="mt-1 text-[10px] text-slate-500">
                          {item.airspace_code} · ID #{item.airspace_id}
                        </p>
                      </td>

                      <td className="px-5 py-5">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${typeClass(
                            item.restriction_type
                          )}`}
                        >
                          {item.restriction_type}
                        </span>
                      </td>

                      <td className="px-5 py-5">
                        <p className="text-xs font-medium">
                          {displayNumber(item.center_latitude, 4)},{" "}
                          {displayNumber(item.center_longitude, 4)}
                        </p>
                      </td>

                      <td className="px-5 py-5 text-xs">
                        {displayNumber(item.radius_nm)} NM
                      </td>

                      <td className="px-5 py-5 text-xs">
                        <p>{item.lower_altitude_ft.toLocaleString()} ft</p>
                        <p className="mt-1 text-[10px] text-slate-500">
                          to {item.upper_altitude_ft.toLocaleString()} ft
                        </p>
                      </td>

                      <td className="px-5 py-5 text-xs">
                        <p>{item.valid_from.replace("T", " ")}</p>
                        <p className="mt-1 text-[10px] text-slate-500">
                          Until {item.valid_to.replace("T", " ")}
                        </p>
                      </td>

                      {isAdmin && (
                        <td className="px-5 py-5">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => beginEdit(item)}
                              title={`Edit ${item.airspace_code}`}
                              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-[11px] font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
                            >
                              <Pencil size={13} />
                              Edit
                            </button>

                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void deleteAirspace(item)}
                              title={`Delete ${item.airspace_code}`}
                              className="flex items-center gap-1.5 rounded-lg border border-rose-500/25 px-3 py-2 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-50"
                            >
                              <Trash2 size={13} />
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}

                  {filteredAirspaces.length === 0 && (
                    <tr>
                      <td
                        colSpan={isAdmin ? 7 : 6}
                        className="px-5 py-12 text-center text-sm text-slate-500"
                      >
                        {airspaces.length === 0
                          ? "No airspace records were returned by the API."
                          : "No zones match your search."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="flex flex-col justify-between gap-3 border-t border-slate-800 pt-5 text-xs text-slate-500 sm:flex-row">
          <div>
            <p className="font-semibold text-slate-300">
              Smart Airspace Conflict Analysis and Flight Intelligence System
            </p>
            <p className="mt-2">Academic prototype · PostgreSQL</p>
          </div>
          <div className="sm:text-right">
            <p className="text-slate-300">
              Pranav Shashikiran Atreya (PES2UG24CS912)
            </p>
            <p className="mt-1 text-slate-300">
              Yash Raghavendra A (PES2UG24CS913)
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
