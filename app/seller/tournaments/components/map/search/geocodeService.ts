export type SearchLocationResult = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

type NominatimItem = {
  place_id: number | string;
  display_name: string;
  lat: string;
  lon: string;
};

export async function searchLocation(
  query: string
): Promise<SearchLocationResult[]> {
  const safeQuery = query.trim();

  if (!safeQuery) return [];

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
    safeQuery
  )}&limit=5`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Falha ao buscar localização.");
  }

  const data = (await response.json()) as NominatimItem[];

  if (!Array.isArray(data)) return [];

  return data
    .map((item) => ({
      id: String(item.place_id),
      name: item.display_name,
      latitude: Number(item.lat),
      longitude: Number(item.lon),
    }))
    .filter(
      (item) =>
        Number.isFinite(item.latitude) && Number.isFinite(item.longitude)
    );
}