import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export default function Home() {
  return (
    <AppShell>
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Hospital Care MVP
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
          Simple hospital queue management, nearby pharmacy search, and
          prescription analysis for safe medicine usage guidance.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            href="/appointments"
            className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 hover:bg-zinc-100"
          >
            <div className="text-sm font-semibold text-zinc-900">
              Appointments
            </div>
            <div className="mt-1 text-xs text-zinc-600">
              Schedule + priority queue time.
            </div>
          </Link>
          <Link
            href="/pharmacy"
            className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 hover:bg-zinc-100"
          >
            <div className="text-sm font-semibold text-zinc-900">
              Nearby Pharmacy
            </div>
            <div className="mt-1 text-xs text-zinc-600">
              Uses OpenStreetMap (free).
            </div>
          </Link>
          <Link
            href="/prescription-analyzer"
            className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 hover:bg-zinc-100"
          >
            <div className="text-sm font-semibold text-zinc-900">
              Prescription Analyzer
            </div>
            <div className="mt-1 text-xs text-zinc-600">
              Timing, side effects, and what to avoid.
            </div>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
