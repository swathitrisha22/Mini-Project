"use client";

import { useMemo, useState, useTransition } from "react";
import type { Doctor } from "@/lib/db";
import { scheduleAppointment } from "./actions";

function nextDays(count: number) {
  const out: { value: string; label: string; weekday: number }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const value = d.toISOString().slice(0, 10);
    out.push({
      value,
      label: d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "2-digit",
      }),
      weekday: d.getDay(),
    });
  }
  return out;
}

export function AppointmentForm({ doctors }: { doctors: Doctor[] }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<Record<string, string[]> | null>(null);
  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? "");

  const selectedDoctor = useMemo(
    () => doctors.find((d) => d.id === doctorId),
    [doctors, doctorId]
  );

  const days = useMemo(() => nextDays(10), []);
  const availableDays = useMemo(() => {
    const wd = new Set(selectedDoctor?.workingDays ?? []);
    return days.filter((d) => wd.has(d.weekday));
  }, [days, selectedDoctor]);

  return (
    <form
      action={(fd) => {
        setResult(null);
        setError(null);
        startTransition(async () => {
          const res = await scheduleAppointment(fd);
          if (res.ok) setResult(res.appointment);
          else setError(res.error as any);
        });
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <div className="text-xs font-medium text-zinc-700">Patient name</div>
          <input
            name="patientName"
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            placeholder="Full name"
            required
          />
          {error?.patientName?.[0] ? (
            <div className="mt-1 text-xs text-red-600">
              {error.patientName[0]}
            </div>
          ) : null}
        </label>
        <label className="block">
          <div className="text-xs font-medium text-zinc-700">Mobile</div>
          <input
            name="phone"
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            placeholder="Phone number"
            required
          />
          {error?.phone?.[0] ? (
            <div className="mt-1 text-xs text-red-600">{error.phone[0]}</div>
          ) : null}
        </label>
        <label className="block">
          <div className="text-xs font-medium text-zinc-700">Email</div>
          <input
            name="email"
            type="email"
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            placeholder="name@example.com"
            required
          />
          {error?.email?.[0] ? (
            <div className="mt-1 text-xs text-red-600">{error.email[0]}</div>
          ) : null}
        </label>
        <label className="block">
          <div className="text-xs font-medium text-zinc-700">Age</div>
          <input
            name="age"
            type="number"
            min={0}
            max={120}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            placeholder="Age"
            required
          />
          {error?.age?.[0] ? (
            <div className="mt-1 text-xs text-red-600">{error.age[0]}</div>
          ) : null}
        </label>
        <label className="block">
          <div className="text-xs font-medium text-zinc-700">Gender</div>
          <select
            name="gender"
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            defaultValue="Prefer not to say"
          >
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
            <option>Prefer not to say</option>
          </select>
          {error?.gender?.[0] ? (
            <div className="mt-1 text-xs text-red-600">{error.gender[0]}</div>
          ) : null}
        </label>
        <label className="block">
          <div className="text-xs font-medium text-zinc-700">Severity</div>
          <select
            name="severity"
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            defaultValue="normal"
          >
            <option value="normal">Normal</option>
            <option value="severe">Severe (priority)</option>
            <option value="emergency">Emergency (priority)</option>
          </select>
          {error?.severity?.[0] ? (
            <div className="mt-1 text-xs text-red-600">
              {error.severity[0]}
            </div>
          ) : null}
        </label>
      </div>

      <label className="block">
        <div className="text-xs font-medium text-zinc-700">
          Previous medical record (optional) / Problem description
        </div>
        <textarea
          name="problemText"
          className="mt-1 min-h-24 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
          placeholder="Describe symptoms, existing conditions, or attach summary text."
          required
        />
        {error?.problemText?.[0] ? (
          <div className="mt-1 text-xs text-red-600">
            {error.problemText[0]}
          </div>
        ) : null}
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <div className="text-xs font-medium text-zinc-700">Doctor</div>
          <select
            name="doctorId"
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
          >
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} — {d.specialty}
              </option>
            ))}
          </select>
          {error?.doctorId?.[0] ? (
            <div className="mt-1 text-xs text-red-600">
              {error.doctorId[0]}
            </div>
          ) : null}
        </label>

        <label className="block">
          <div className="text-xs font-medium text-zinc-700">Date</div>
          <select
            name="date"
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            defaultValue={availableDays[0]?.value}
          >
            {availableDays.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          {error?.date?.[0] ? (
            <div className="mt-1 text-xs text-red-600">{error.date[0]}</div>
          ) : null}
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? "Scheduling..." : "Schedule appointment"}
      </button>

      {result ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <div className="font-semibold">Appointment scheduled</div>
          <div className="mt-2 grid grid-cols-1 gap-1 text-sm">
            <div>
              <span className="text-emerald-900/80">Doctor:</span>{" "}
              {result.doctorName} ({result.specialty})
            </div>
            <div>
              <span className="text-emerald-900/80">Date:</span>{" "}
              {result.niceDate}
            </div>
            <div>
              <span className="text-emerald-900/80">Queue number:</span>{" "}
              {result.queueNumber} / {result.queueCount}
            </div>
            <div>
              <span className="text-emerald-900/80">Estimated time:</span>{" "}
              {result.estimatedStartTime}
            </div>
            <div>
              <span className="text-emerald-900/80">Arrive by:</span>{" "}
              {result.arriveBy}
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}

