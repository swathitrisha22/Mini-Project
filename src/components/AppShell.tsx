"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={[
        "rounded-full px-3 py-1.5 text-sm transition-colors",
        active
          ? "bg-zinc-900 text-white"
          : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="font-semibold tracking-tight text-zinc-900">
            Hospital Care
          </Link>
          <nav className="flex items-center gap-2">
            <NavLink href="/appointments" label="Appointments" />
            <NavLink href="/pharmacy" label="Nearby Pharmacy" />
            <NavLink href="/prescription-analyzer" label="Prescription Analyzer" />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        {children}
      </main>
      <footer className="border-t border-zinc-200 bg-zinc-50">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 text-xs text-zinc-500">
          MVP demo. Do not use for real medical decisions.
        </div>
      </footer>
    </div>
  );
}

