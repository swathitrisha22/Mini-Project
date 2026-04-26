"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useLocation } from "@/lib/useLocation";

type Place = {
  id: string;
  name: string;
  address?: string;
  distanceMeters?: number;
  lat: number;
  lon: number;
};

function haversineMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export default function PharmacyPage() {
  const [radiusKm, setRadiusKm] = useState(3);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [placeQuery, setPlaceQuery] = useState("");
  const [medicineName, setMedicineName] = useState("");

  const loc = useLocation();

  const sorted = useMemo(() => {
    if (!loc.coords) return places;
    return [...places]
      .map((p) => ({ ...p, distanceMeters: haversineMeters(loc.coords!, p) }))
      .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
  }, [places, loc.coords]);

  async function search() {
    if (!loc.coords) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/pharmacies?lat=${encodeURIComponent(loc.coords.lat)}&lon=${encodeURIComponent(
          loc.coords.lon
        )}&radiusKm=${encodeURIComponent(radiusKm)}`
      );
      if (!res.ok) throw new Error("Failed to fetch pharmacies");
      const data = (await res.json()) as { places: Place[] };
      setPlaces(data.places);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Something went wrong";
      setErr(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!loc.coords) return;
    void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.coords, radiusKm]);

  return (
    <AppShell>
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
          Nearby pharmacies
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Find nearby pharmacies and check medicine availability via Google Maps.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <div className="text-xs font-medium text-zinc-700">Find location</div>
            <input
              value={placeQuery}
              onChange={(e) => setPlaceQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void loc.searchPlace(placeQuery);
                }
              }}
              className="mt-1 w-72 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
              placeholder="Type location and press Enter"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-zinc-700">Radius (km)</div>
            <input
              type="number"
              min={1}
              max={20}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="mt-1 w-36 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-zinc-700">Medicine name</div>
            <input
              value={medicineName}
              onChange={(e) => setMedicineName(e.target.value)}
              className="mt-1 w-56 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
              placeholder="e.g. Paracetamol 650"
            />
          </label>
          <a
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            href={
              loc.coords
                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${medicineName.trim() || "pharmacy"} near ${loc.coords.lat},${loc.coords.lon}`
                  )}`
                : "#"
            }
            target="_blank"
            rel="noreferrer"
            aria-disabled={!loc.coords}
          >
            Search on Google Maps
          </a>
          <div className="text-xs text-zinc-600">
            {loc.coords ? (
              <>
                Location: {loc.label ? `${loc.label} · ` : ""}
                {loc.coords.lat.toFixed(4)}, {loc.coords.lon.toFixed(4)}
              </>
            ) : (
              "Location unavailable. Allow browser location or enter place and press Enter."
            )}
          </div>
        </div>

        {loc.error ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {loc.error}
          </div>
        ) : null}

        {err ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        ) : null}

        <div className="mt-6 divide-y divide-zinc-100">
          {sorted.length === 0 && !loading ? (
            <div className="py-8 text-sm text-zinc-600">
              No pharmacies found in this radius.
            </div>
          ) : null}
          {sorted.map((p) => (
            <div key={p.id} className="py-3">
              <div className="text-sm font-semibold text-zinc-900">
                {p.name || "Pharmacy"}
              </div>
              <div className="mt-0.5 text-xs text-zinc-600">
                {p.address ? p.address : "Address not available"}
                {typeof p.distanceMeters === "number"
                  ? ` · ${(p.distanceMeters / 1000).toFixed(2)} km`
                  : ""}
              </div>
              <div className="mt-1">
                <a
                  className="text-xs font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-600"
                  href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
                    `${loc.coords?.lat ?? p.lat},${loc.coords?.lon ?? p.lon}`
                  )}&destination=${encodeURIComponent(`${p.lat},${p.lon}`)}&travelmode=driving`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Directions on Google Maps
                </a>
                <span className="mx-2 text-zinc-300">|</span>
                <a
                  className="text-xs font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-600"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${medicineName.trim() || "medicine"} ${p.name} ${p.address ?? ""}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Check medicine nearby
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

