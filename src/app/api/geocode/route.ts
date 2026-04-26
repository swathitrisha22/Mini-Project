import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ error: "Missing q" }, { status: 400 });

  // Nominatim usage policy requires a valid User-Agent.
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");

  const r = await fetch(url.toString(), {
    headers: {
      "user-agent": "hospital-care-mvp/1.0 (demo app)",
      "accept-language": "en",
    },
    cache: "no-store",
  });

  if (!r.ok) {
    return NextResponse.json(
      { error: "Geocoding failed", status: r.status },
      { status: 502 }
    );
  }

  const data = (await r.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;

  if (!data?.[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    coords: { lat: Number(data[0].lat), lon: Number(data[0].lon) },
    label: data[0].display_name,
  });
}

