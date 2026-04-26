"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type Coords = { lat: number; lon: number };

export function useLocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [label, setLabel] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Avoid SSR/CSR hydration mismatch by not reading browser globals
  // until after the first client render.
  useEffect(() => {
    setHydrated(true);
  }, []);

  const geolocationSupported = useMemo(() => {
    if (!hydrated) return false;
    return !!navigator.geolocation;
  }, [hydrated]);

  const locate = useCallback(async () => {
    if (!geolocationSupported) {
      setError("Geolocation is not supported in this browser.");
      return;
    }
    setLoading(true);
    setError(null);
    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          });
          setLabel("Current location");
          resolve();
        },
        () => {
          setError(
            "Location permission denied or unavailable. Use place search below."
          );
          resolve();
        },
        { enableHighAccuracy: true, timeout: 12000 }
      );
    });
    setLoading(false);
  }, [geolocationSupported]);

  const searchPlace = useCallback(async (q: string) => {
    const query = q.trim();
    if (!query) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const data = (await res.json()) as {
        coords?: Coords;
        label?: string;
        error?: string;
      };
      if (!res.ok || !data.coords) throw new Error(data.error ?? "Not found");
      setCoords(data.coords);
      setLabel(data.label ?? query);
    } catch (e: any) {
      setError(e?.message ?? "Place search failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void locate();
  }, [locate]);

  return {
    coords,
    label,
    error,
    loading,
    locate,
    searchPlace,
    geolocationSupported,
  };
}

