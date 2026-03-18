"use client";

import {
  useEffect,
  useRef,
  useState,
  useMemo,
  type CSSProperties,
  type KeyboardEvent,
} from "react";

type LatLng = {
  latitude: number;
  longitude: number;
};

type BoundaryType = "circle" | "polygon";

type Props = {
  center: LatLng;
  radiusM: number;
  boundaryEnabled: boolean;
  boundaryType: BoundaryType;
  polygonPoints: LatLng[];
  onChangeCenter: (nextCenter: LatLng) => void;
  onChangePolygonPoints: (nextPoints: LatLng[]) => void;
};

type SearchResult = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

type LeafletModule = typeof import("leaflet");

export default function LeafletBoundaryEditor({
  center,
  radiusM,
  boundaryEnabled,
  boundaryType,
  polygonPoints,
  onChangeCenter,
  onChangePolygonPoints,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<LeafletModule | null>(null);

  const markerLayerRef = useRef<any>(null);
  const geometryLayerRef = useRef<any>(null);

  const mapElementRef = useRef<HTMLDivElement | null>(null);

  const [mapReady, setMapReady] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [isLocating, setIsLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const formattedKm = useMemo(
    () => (radiusM / 1000).toFixed(radiusM >= 1000 ? 1 : 2),
    [radiusM]
  );

  useEffect(() => {
    requestAnimationFrame(() => {
      setMapReady(true);
    });
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    if (!mapElementRef.current) return;

    let cancelled = false;

    async function init() {
      const L = await import("leaflet");

      if (cancelled) return;

      leafletRef.current = L;

      delete (L.Icon.Default.prototype as any)._getIconUrl;

      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapElementRef.current!, {
        zoomControl: true,
        scrollWheelZoom: true,
      });

      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      markerLayerRef.current = L.layerGroup().addTo(map);
      geometryLayerRef.current = L.layerGroup().addTo(map);

      map.on("click", (e: any) => {
        const next = {
          latitude: e.latlng.lat,
          longitude: e.latlng.lng,
        };

        if (boundaryType === "circle") {
          onChangeCenter(next);
        } else {
          onChangePolygonPoints([...polygonPoints, next]);
        }
      });

      syncMap();

      hardInvalidate(map);
    }

    init();

    return () => {
      cancelled = true;

      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, [mapReady]);

  useEffect(() => {
    if (!mapRef.current) return;

    syncMap();
  }, [center, radiusM, boundaryEnabled, boundaryType, polygonPoints]);

  function syncMap() {
    const L = leafletRef.current;
    const map = mapRef.current;

    if (!L || !map) return;

    markerLayerRef.current.clearLayers();
    geometryLayerRef.current.clearLayers();

    const safeRadius = Math.max(radiusM, 50);

    if (boundaryType === "circle") {
      const marker = L.marker([center.latitude, center.longitude], {
        draggable: true,
      });

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        onChangeCenter({
          latitude: pos.lat,
          longitude: pos.lng,
        });
      });

      markerLayerRef.current.addLayer(marker);

      if (boundaryEnabled) {
        const circle = L.circle([center.latitude, center.longitude], {
          radius: safeRadius,
          color: "#0B3C5D",
          weight: 2,
          fillOpacity: 0.2,
        });

        geometryLayerRef.current.addLayer(circle);

        const bounds = circle.getBounds();
        map.fitBounds(bounds, { padding: [40, 40] });
      } else {
        map.setView([center.latitude, center.longitude], 13);
      }

      hardInvalidate(map);
      return;
    }

    const vertexIcon = L.divIcon({
      html: `<div style="width:16px;height:16px;border-radius:50%;background:#0B3C5D;border:3px solid white"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    polygonPoints.forEach((p, index) => {
      const marker = L.marker([p.latitude, p.longitude], {
        draggable: true,
        icon: vertexIcon,
      });

      marker.on("dragend", () => {
        const pos = marker.getLatLng();

        const next = polygonPoints.map((pt, i) =>
          i === index
            ? { latitude: pos.lat, longitude: pos.lng }
            : pt
        );

        onChangePolygonPoints(next);
      });

      markerLayerRef.current.addLayer(marker);
    });

    if (boundaryEnabled && polygonPoints.length >= 2) {
      const polygon = L.polygon(
        polygonPoints.map((p) => [p.latitude, p.longitude]),
        {
          color: "#0B3C5D",
          weight: 3,
          fillOpacity: 0.15,
        }
      );

      geometryLayerRef.current.addLayer(polygon);

      map.fitBounds(polygon.getBounds(), { padding: [40, 40] });
    } else {
      map.setView([center.latitude, center.longitude], 13);
    }

    hardInvalidate(map);
  }

  async function handleSearchPlace() {
    const query = searchText.trim();

    if (!query) return;

    try {
      setSearching(true);
      setSearchError(null);

      const params = new URLSearchParams({
        q: query,
        format: "jsonv2",
        limit: "5",
        countrycodes: "br",
      });

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`
      );

      const data = await res.json();

      const results = data.map((item: any) => ({
        id: item.place_id,
        name: item.display_name,
        latitude: Number(item.lat),
        longitude: Number(item.lon),
      }));

      setSearchResults(results);
    } catch {
      setSearchError("Erro ao buscar local.");
    } finally {
      setSearching(false);
    }
  }

  function handlePickSearchResult(r: SearchResult) {
    onChangeCenter({
      latitude: r.latitude,
      longitude: r.longitude,
    });

    setSearchText(r.name);
    setSearchResults([]);
  }

  async function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setLocateError("Geolocalização não suportada.");
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChangeCenter({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });

        setIsLocating(false);
      },
      () => {
        setLocateError("Não foi possível obter localização.");
        setIsLocating(false);
      }
    );
  }

  function handleSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      handleSearchPlace();
    }
  }

  return (
    <div ref={hostRef} style={styles.host}>
      {mapReady ? (
        <div ref={mapElementRef} style={styles.map} />
      ) : (
        <div style={styles.mapSkeleton}>Carregando mapa...</div>
      )}

      <div style={styles.toolbar}>
        <div style={styles.modePill}>
          {boundaryType === "circle" ? "Modo círculo" : "Área desenhada"}
        </div>

        <div style={styles.searchCard}>
          <div style={styles.searchRow}>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={handleSearchKey}
              placeholder="Buscar cidade ou lago..."
              style={styles.searchInput}
            />

            <button
              onClick={handleSearchPlace}
              style={styles.primaryButton}
            >
              {searching ? "Buscando..." : "Buscar"}
            </button>
          </div>

          <button
            onClick={handleUseMyLocation}
            style={styles.secondaryButton}
          >
            {isLocating ? "Localizando..." : "Usar minha localização"}
          </button>

          {searchResults.length > 0 && (
            <div style={styles.searchResults}>
              {searchResults.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handlePickSearchResult(r)}
                  style={styles.searchResultItem}
                >
                  {r.name}
                </button>
              ))}
            </div>
          )}

          {searchError && (
            <div style={styles.searchError}>{searchError}</div>
          )}
        </div>
      </div>

      {locateError && (
        <div style={styles.errorPill}>{locateError}</div>
      )}

      <div style={styles.footerHint}>
        Clique no mapa para definir área do torneio.
      </div>
    </div>
  );
}

function hardInvalidate(map: any) {
  map.invalidateSize();

  requestAnimationFrame(() => {
    map.invalidateSize();
  });
}

const styles: Record<string, CSSProperties> = {
  host: {
    width: "100%",
    height: "100%",
    minHeight: 520,
    position: "relative",
    borderRadius: 18,
    overflow: "hidden",
    background: "#F8FAFC",
  },

  map: {
    width: "100%",
    height: "100%",
  },

  mapSkeleton: {
    width: "100%",
    height: "100%",
    display: "grid",
    placeItems: "center",
    color: "#64748B",
  },

  toolbar: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    display: "flex",
    justifyContent: "space-between",
  },

  modePill: {
    background: "#0B3C5D",
    color: "#FFF",
    padding: "8px 12px",
    borderRadius: 999,
    fontWeight: 700,
  },

  searchCard: {
    width: 320,
    background: "white",
    padding: 10,
    borderRadius: 12,
    boxShadow: "0 10px 20px rgba(0,0,0,0.1)",
  },

  searchRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 8,
  },

  searchInput: {
    border: "1px solid #ddd",
    borderRadius: 10,
    padding: "8px 10px",
  },

  primaryButton: {
    background: "#0B3C5D",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "8px 12px",
    cursor: "pointer",
  },

  secondaryButton: {
    marginTop: 6,
    background: "#f1f5f9",
    border: "none",
    borderRadius: 10,
    padding: "8px",
    cursor: "pointer",
  },

  searchResults: {
    marginTop: 6,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  searchResultItem: {
    textAlign: "left",
    border: "1px solid #eee",
    padding: "6px 8px",
    borderRadius: 8,
    background: "#fff",
    cursor: "pointer",
  },

  searchError: {
    color: "#B91C1C",
    fontSize: 12,
  },

  footerHint: {
    position: "absolute",
    bottom: 14,
    left: 14,
    right: 14,
    background: "white",
    padding: 10,
    borderRadius: 10,
    fontSize: 13,
  },

  errorPill: {
    position: "absolute",
    bottom: 70,
    left: 14,
    background: "#7F1D1D",
    color: "#FFF",
    padding: "8px 10px",
    borderRadius: 10,
  },
};