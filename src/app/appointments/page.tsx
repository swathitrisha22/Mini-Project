import { AppShell } from "@/components/AppShell";
import { listDoctors } from "@/lib/db";
import { AppointmentForm } from "./ui";

export default function AppointmentsPage() {
  const doctors = listDoctors();
  return (
    <AppShell>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
            Schedule an appointment
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Fill details, pick a doctor, and we’ll assign you a queue time. If
            the case is severe, you’ll be prioritized.
          </p>
          <div className="mt-6">
            <AppointmentForm doctors={doctors} />
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
            Doctors
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Seed dataset (you can replace with Kaggle later).
          </p>
          <div className="mt-4 divide-y divide-zinc-100">
            {doctors.map((d) => (
              <div key={d.id} className="py-3">
                <div className="text-sm font-semibold text-zinc-900">
                  {d.name}
                </div>
                <div className="text-xs text-zinc-600">
                  {d.specialty} · {d.startTime}–{d.endTime} · {d.slotMins} min
                  slots
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

