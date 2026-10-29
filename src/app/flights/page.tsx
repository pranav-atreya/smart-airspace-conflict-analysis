
"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Plane,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";

type FlightStatus = "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED";

type Flight = {
  flight_id: number;
  flight_number: string;
  aircraft_id: number;
  departure_airport: number;
  arrival_airport: number;
  scheduled_departure: string;
  scheduled_arrival: string;
  status: FlightStatus;
  registration_no: string;
  aircraft_type: string;
  departure_name: string;
  departure_iata: string | null;
  departure_icao: string | null;
  arrival_name: string;
  arrival_iata: string | null;
  arrival_icao: string | null;
};

type Aircraft = {
  aircraft_id: number;
  registration_no: string;
  aircraft_type: string;
};

type Airport = {
  airport_id: number;
  airport_name: string;
  iata_code: string | null;
  icao_code: string | null;
};

type ApiResponse = {
  ok: boolean;
  message?: string;
  user?: {
    fullName: string;
    role: "ADMIN" | "OPERATOR";
  };
  flights?: Flight[];
  aircraft?: Aircraft[];
  airports?: Airport[];
};

const statuses: FlightStatus[] = [
  "SCHEDULED",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
];

function initialLocalDate(offsetHours: number) {
  const date = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function statusClass(status: FlightStatus) {
  switch (status) {
    case "ACTIVE":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "SCHEDULED":
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";
    case "COMPLETED":
      return "border-slate-600 bg-slate-800 text-slate-300";
    case "CANCELLED":
      return "border-rose-500/30 bg-rose-500/10 text-rose-300";
  }
}

const inputClass =
  "mt-2 h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition focus:border-blue-500";

export default function FlightManagementPage() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [role, setRole] = useState<"ADMIN" | "OPERATOR" | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [flightNumber, setFlightNumber] = useState("");
  const [aircraftId, setAircraftId] = useState("");
  const [departureAirportId, setDepartureAirportId] = useState("");
  const [arrivalAirportId, setArrivalAirportId] = useState("");

  // Keep date values empty during prerendering. Set them in a browser effect.
  const [scheduledDeparture, setScheduledDeparture] = useState("");
  const [scheduledArrival, setScheduledArrival] = useState("");

  // Initialize local schedule dates after browser mounting.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setScheduledDeparture(initialLocalDate(1));
      setScheduledArrival(initialLocalDate(3));
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/flights", { cache: "no-store" });
      const result: ApiResponse = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Unable to load flights.");
      }

      setFlights(result.flights ?? []);
      setAircraft(result.aircraft ?? []);
      setAirports(result.airports ?? []);
      setRole(result.user?.role ?? null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load flights."
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

  const isAdmin = role === "ADMIN";

  const filteredFlights = flights.filter((flight) => {
    const searchable = [
      flight.flight_number,
      flight.registration_no,
      flight.aircraft_type,
      flight.departure_name,
      flight.arrival_name,
      flight.departure_iata,
      flight.arrival_iata,
      flight.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchable.includes(search.toLowerCase());
  });

  async function createFlight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (
      !flightNumber.trim() ||
      !aircraftId ||
      !departureAirportId ||
      !arrivalAirportId ||
      !scheduledDeparture ||
      !scheduledArrival
    ) {
      setError("Complete all required flight fields.");
      return;
    }

    if (departureAirportId === arrivalAirportId) {
      setError("Departure and arrival airports must differ.");
      return;
    }

    if (
      new Date(scheduledArrival).getTime() <=
      new Date(scheduledDeparture).getTime()
    ) {
      setError("Arrival must be later than departure.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/flights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flightNumber: flightNumber.trim(),
          aircraftId: Number(aircraftId),
          departureAirportId: Number(departureAirportId),
          arrivalAirportId: Number(arrivalAirportId),
          scheduledDeparture,
          scheduledArrival,
          status: "SCHEDULED",
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Unable to create flight.");
      }

      setMessage(
        `Flight ${result.flight.flight_number} created successfully (ID ${result.flight.flight_id}).`
      );

      setFlightNumber("");
      setAircraftId("");
      setDepartureAirportId("");
      setArrivalAirportId("");
      setRefreshKey((value) => value + 1);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create flight."
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(flight: Flight, status: FlightStatus) {
    if (status === flight.status) return;

    setError("");
    setMessage("");
    setSaving(true);

    try {
      const response = await fetch("/api/flights", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flightId: flight.flight_id,
          status,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Unable to update flight.");
      }

      setMessage(
        `${flight.flight_number} status updated to ${result.flight.status}.`
      );

      setRefreshKey((value) => value + 1);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to update flight."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteFlight(flight: Flight) {
    const confirmed = window.confirm(
      `Delete flight ${flight.flight_number} (ID ${flight.flight_id})?\n\n` +
        "Flights linked to positions, incidents, waypoints or conflicts may be protected by foreign keys."
    );

    if (!confirmed) return;

    setError("");
    setMessage("");
    setSaving(true);

    try {
      const response = await fetch("/api/flights", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flightId: flight.flight_id }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Unable to delete flight.");
      }

      setMessage(`Flight ${flight.flight_number} deleted successfully.`);
      setRefreshKey((value) => value + 1);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to delete flight."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b1120] px-5 py-8 text-slate-100 md:px-9 md:py-10">
      <div className="mx-auto max-w-[1500px] space-y-7">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
              <Plane size={23} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">
                Flight Operations
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">
                Flight Management
              </h1>
              <p className="mt-1 text-xs text-slate-400">
                PostgreSQL-backed flight records and status control
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
            { label: "Total flights", value: flights.length },
            {
              label: "Scheduled",
              value: flights.filter((flight) => flight.status === "SCHEDULED")
                .length,
            },
            {
              label: "Active flights",
              value: flights.filter((flight) => flight.status === "ACTIVE")
                .length,
            },
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
            className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-200"
          >
            {error}
          </div>
        )}

        {isAdmin ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 md:p-7">
            <div className="mb-6 flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                <Plus size={19} />
              </div>
              <div>
                <h2 className="font-bold">Register a flight</h2>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Create a flight using existing aircraft and airport records.
                  Database constraints remain in force.
                </p>
              </div>
            </div>

            {aircraft.length === 0 || airports.length < 2 ? (
              <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">
                At least one aircraft and two airports are required before a
                flight can be registered.
              </p>
            ) : (
              <form onSubmit={createFlight} className="space-y-5">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  <label className="text-xs font-semibold text-slate-300">
                    Flight number *
                    <input
                      required
                      minLength={2}
                      maxLength={20}
                      value={flightNumber}
                      onChange={(event) => setFlightNumber(event.target.value)}
                      placeholder="e.g. TEST701"
                      className={inputClass}
                    />
                  </label>

                  <label className="text-xs font-semibold text-slate-300">
                    Aircraft *
                    <select
                      required
                      value={aircraftId}
                      onChange={(event) => setAircraftId(event.target.value)}
                      className={inputClass}
                    >
                      <option value="">Select aircraft</option>
                      {aircraft.map((item) => (
                        <option key={item.aircraft_id} value={item.aircraft_id}>
                          {item.registration_no} — {item.aircraft_type}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-xs font-semibold text-slate-300">
                    Departure airport *
                    <select
                      required
                      value={departureAirportId}
                      onChange={(event) =>
                        setDepartureAirportId(event.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="">Select departure</option>
                      {airports.map((item) => (
                        <option key={item.airport_id} value={item.airport_id}>
                          {item.airport_name} (
                          {item.iata_code || item.icao_code || "N/A"})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-xs font-semibold text-slate-300">
                    Arrival airport *
                    <select
                      required
                      value={arrivalAirportId}
                      onChange={(event) =>
                        setArrivalAirportId(event.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="">Select arrival</option>
                      {airports.map((item) => (
                        <option key={item.airport_id} value={item.airport_id}>
                          {item.airport_name} (
                          {item.iata_code || item.icao_code || "N/A"})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-xs font-semibold text-slate-300">
                    Scheduled departure *
                    <input
                      type="datetime-local"
                      required
                      value={scheduledDeparture}
                      onChange={(event) =>
                        setScheduledDeparture(event.target.value)
                      }
                      className={inputClass}
                    />
                  </label>

                  <label className="text-xs font-semibold text-slate-300">
                    Scheduled arrival *
                    <input
                      type="datetime-local"
                      required
                      value={scheduledArrival}
                      onChange={(event) =>
                        setScheduledArrival(event.target.value)
                      }
                      className={inputClass}
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-5">
                  <p className="text-[11px] text-slate-500">
                    New flights start in SCHEDULED status.
                  </p>
                  <button
                    type="submit"
                    disabled={saving || loading}
                    className="flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-500 disabled:opacity-50"
                  >
                    <Plus size={16} />
                    {saving ? "Saving..." : "Create flight"}
                  </button>
                </div>
              </form>
            )}
          </section>
        ) : (
          <section className="flex items-start gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
            <ShieldCheck size={19} className="mt-0.5 shrink-0 text-blue-300" />
            <div>
              <h2 className="text-sm font-semibold">Operator access</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                You can view and search flight records. Only Admin users can
                create, modify or delete flights; these permissions are enforced
                by the API.
              </p>
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-800 p-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-bold">Flight records</h2>
              <p className="mt-1 text-xs text-slate-400">
                {filteredFlights.length} of {flights.length} records displayed
              </p>
            </div>

            <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-700 px-3 sm:w-80">
              <Search size={15} className="shrink-0 text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search flight, aircraft, airport..."
                className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-slate-500"
              />
            </label>
          </div>

          {loading ? (
            <p className="p-7 text-sm text-slate-400">
              Loading flight records...
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left">
                <thead className="bg-slate-800/70">
                  <tr className="text-[10px] uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-4">Flight</th>
                    <th className="px-5 py-4">Aircraft</th>
                    <th className="px-5 py-4">Route</th>
                    <th className="px-5 py-4">Scheduled</th>
                    <th className="px-5 py-4">Status</th>
                    {isAdmin && <th className="px-5 py-4">Admin actions</th>}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800">
                  {filteredFlights.map((flight) => (
                    <tr
                      key={flight.flight_id}
                      className="transition hover:bg-slate-800/30"
                    >
                      <td className="px-5 py-5">
                        <p className="text-sm font-bold">
                          {flight.flight_number}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-500">
                          Record ID #{flight.flight_id}
                        </p>
                      </td>

                      <td className="px-5 py-5">
                        <p className="text-xs font-semibold">
                          {flight.registration_no}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {flight.aircraft_type}
                        </p>
                      </td>

                      <td className="px-5 py-5">
                        <p className="text-xs font-medium">
                          {flight.departure_iata || flight.departure_icao || "—"}
                          {" → "}
                          {flight.arrival_iata || flight.arrival_icao || "—"}
                        </p>
                        <p className="mt-1 text-[10px] leading-5 text-slate-400">
                          {flight.departure_name}
                          <br />
                          to {flight.arrival_name}
                        </p>
                      </td>

                      <td className="px-5 py-5">
                        <p className="flex items-center gap-2 text-xs text-slate-300">
                          <Clock3 size={13} className="text-slate-500" />
                          {flight.scheduled_departure.replace("T", " ")}
                        </p>
                        <p className="mt-2 text-[10px] text-slate-500">
                          Arrives {flight.scheduled_arrival.replace("T", " ")}
                        </p>
                      </td>

                      <td className="px-5 py-5">
                        {isAdmin ? (
                          <select
                            aria-label={`Status for ${flight.flight_number}`}
                            value={flight.status}
                            disabled={saving}
                            onChange={(event) =>
                              void updateStatus(
                                flight,
                                event.target.value as FlightStatus
                              )
                            }
                            className={`rounded-full border px-2.5 py-1.5 text-[10px] font-bold outline-none ${statusClass(
                              flight.status
                            )} bg-slate-950 disabled:opacity-50`}
                          >
                            {statuses.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusClass(
                              flight.status
                            )}`}
                          >
                            {flight.status}
                          </span>
                        )}
                      </td>

                      {isAdmin && (
                        <td className="px-5 py-5">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void deleteFlight(flight)}
                            className="flex items-center gap-2 rounded-lg border border-rose-500/25 px-3 py-2 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-50"
                          >
                            <Trash2 size={13} />
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}

                  {filteredFlights.length === 0 && (
                    <tr>
                      <td
                        colSpan={isAdmin ? 6 : 5}
                        className="px-5 py-12 text-center text-sm text-slate-500"
                      >
                        {flights.length === 0
                          ? "No flights were returned by the API."
                          : "No flights match your search."}
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
