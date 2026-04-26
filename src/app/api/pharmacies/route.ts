import { NextResponse } from "next/server";

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const radiusKm = Number(searchParams.get("radiusKm") ?? "3");

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "Invalid lat/lon" }, { status: 400 });
  }
  const radiusMeters = Math.max(500, Math.min(20000, Math.round(radiusKm * 1000)));

  // Overpass QL: search for pharmacies around point.
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="pharmacy"](around:${radiusMeters},${lat},${lon});
      way["amenity"="pharmacy"](around:${radiusMeters},${lat},${lon});
      relation["amenity"="pharmacy"](around:${radiusMeters},${lat},${lon});
    );
    out center tags;
  `.trim();

  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.nchc.org.tw/api/interpreter",
  ];

  let overpass: Response | null = null;
  for (const ep of endpoints) {
    try {
      const r = await fetch(ep, {
        method: "POST",
        headers: { "content-type": "text/plain; charset=utf-8" },
        body: query,
        cache: "no-store",
      });
      if (r.ok) {
        overpass = r;
        break;
      }
      overpass = r;
    } catch {
      // try next endpoint
    }
  }

  if (!overpass || !overpass.ok) {
    return NextResponse.json(
      { error: "Overpass error", status: overpass?.status ?? 0 },
      { status: 502 }
    );
  }

  const data = (await overpass.json()) as { elements: OverpassElement[] };

  const places = (data.elements ?? [])
    .map((el) => {
      const p = el.center ?? (el.lat && el.lon ? { lat: el.lat, lon: el.lon } : null);
      if (!p) return null;
      const tags = el.tags ?? {};
      const addressParts = [
        tags["addr:housenumber"],
        tags["addr:street"],
        tags["addr:suburb"],
        tags["addr:city"],
        tags["addr:postcode"],
      ].filter(Boolean);
      return {
        id: `${el.type}_${el.id}`,
        name: tags.name ?? tags.brand ?? "",
        address: addressParts.length ? addressParts.join(", ") : undefined,
        lat: p.lat,
        lon: p.lon,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ places });
}

