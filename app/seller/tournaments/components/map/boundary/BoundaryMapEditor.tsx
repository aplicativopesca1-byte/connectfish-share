"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MutableRefObject,
} from "react";
import maplibregl from "maplibre-gl";
import { TerraDraw, TerraDrawSelectMode } from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";

import MapCanvas from "../MapCanvas";
import { searchLocation } from "../search/geocodeService";
import type { BoundaryType, LatLng } from "../geo";

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

type TerraFeature = {
  id: string;
  type?: string;
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
  properties?: Record<string, unknown>;
};

type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features: any[];
};

const POLYGON_SOURCE_ID = "cf-polygon-preview-source";
const POLYGON_FILL_ID = "cf-polygon-preview-fill";
const POLYGON_LINE_ID = "cf-polygon-preview-line";

export default function BoundaryMapEditor({
  center,
  radiusM,
  boundaryEnabled,
  boundaryType,
  polygonPoints,
  onChangeCenter,
  onChangePolygonPoints,
}: Props) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const readyRef = useRef(false);
  const locationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const lastViewportSignatureRef = useRef<string>("");
  const hasDoneInitialViewportRef = useRef(false);

  const latestRef = useRef({
    center,
    radiusM,
    boundaryEnabled,
    boundaryType,
    polygonPoints,
    onChangeCenter,
    onChangePolygonPoints,
  });

  latestRef.current = {
    center,
    radiusM,
    boundaryEnabled,
    boundaryType,
    polygonPoints,
    onChangeCenter,
    onChangePolygonPoints,
  };

  const [searchText, setSearchText] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);

  const [isPolygonDrawing, setIsPolygonDrawing] = useState(false);
  const [draftPolygonPoints, setDraftPolygonPoints] = useState<LatLng[]>([]);
  const [polygonError, setPolygonError] = useState<string | null>(null);

  const isPolygonDrawingRef = useRef(false);
  const draftPolygonPointsRef = useRef<LatLng[]>([]);

  useEffect(() => {
    isPolygonDrawingRef.current = isPolygonDrawing;
  }, [isPolygonDrawing]);

  useEffect(() => {
    draftPolygonPointsRef.current = draftPolygonPoints;
  }, [draftPolygonPoints]);

  const helperText = useMemo(() => {
    if (!boundaryEnabled) {
      return "Perímetro desativado. Ative para configurar a área oficial do torneio.";
    }

    if (boundaryType === "circle") {
      const km = (radiusM / 1000).toFixed(radiusM >= 1000 ? 1 : 2);
      return `Clique no mapa para definir o centro. Raio atual: ${radiusM} m (${km} km).`;
    }

    if (isPolygonDrawing) {
      return `Modo desenho ativo. Clique no mapa para adicionar os pontos do perímetro. Pontos atuais: ${draftPolygonPoints.length}. Finalize quando terminar.`;
    }

    if (polygonPoints.length === 0) {
      return "Clique em desenhar área e marque os pontos do perímetro.";
    }

    return `Área com ${polygonPoints.length} ponto${
      polygonPoints.length === 1 ? "" : "s"
    }. As linhas e o sombreamento mostram a área oficial do torneio.`;
  }, [
    boundaryEnabled,
    boundaryType,
    radiusM,
    isPolygonDrawing,
    draftPolygonPoints.length,
    polygonPoints.length,
  ]);

  const onMapReady = useCallback((map: maplibregl.Map) => {
    mapRef.current = map;

    try {
      if (!isMapStyleSafe(map)) return;

      ensurePolygonPreviewLayers(map);

      const adapter = new TerraDrawMapLibreGLAdapter({ map });

      const draw = new TerraDraw({
        adapter,
        modes: [
          new TerraDrawSelectMode({
            flags: {
              polygon: {
                feature: {
                  draggable: true,
                  coordinates: {
                    midpoints: true,
                    draggable: true,
                    deletable: true,
                  },
                },
              },
            },
          }),
        ],
      });

      draw.start();
      drawRef.current = draw;
      readyRef.current = true;

      map.on("click", (event) => {
        const current = latestRef.current;

        if (!current.boundaryEnabled) return;

        if (current.boundaryType === "circle") {
          current.onChangeCenter({
            latitude: event.lngLat.lat,
            longitude: event.lngLat.lng,
          });
          return;
        }

        if (
          current.boundaryType === "polygon" &&
          isPolygonDrawingRef.current
        ) {
          setPolygonError(null);

          setDraftPolygonPoints((prev) => {
            const next = [
              ...prev,
              {
                latitude: event.lngLat.lat,
                longitude: event.lngLat.lng,
              },
            ];
            draftPolygonPointsRef.current = next;
            return next;
          });
        }
      });

      const current = latestRef.current;

      syncCircleLayer(
        map,
        current.center,
        current.radiusM,
        current.boundaryEnabled && current.boundaryType === "circle"
      );

      syncUserLocationMarker(map, locationMarkerRef, userLocation);

      if (current.boundaryType === "polygon" && current.polygonPoints.length >= 3) {
        syncPolygonInDraw(draw, current.polygonPoints);
        syncPolygonPreviewFromPoints(map, current.polygonPoints);

        try {
          draw.setMode("select");
        } catch {}
      } else {
        clearDraw(draw);
        clearPolygonPreviewLayer(map);
      }

      syncViewportOnceOrWhenStructureChanges(
        map,
        current.center,
        current.radiusM,
        current.boundaryEnabled,
        current.boundaryType,
        current.polygonPoints,
        lastViewportSignatureRef,
        hasDoneInitialViewportRef
      );
    } catch (error) {
      console.error("Erro ao inicializar editor de mapa:", error);
    }
  }, [userLocation]);

  useEffect(() => {
    return () => {
      try {
        drawRef.current?.stop();
      } catch {}

      try {
        locationMarkerRef.current?.remove();
      } catch {}

      locationMarkerRef.current = null;
      drawRef.current = null;
      mapRef.current = null;
      readyRef.current = false;
      hasDoneInitialViewportRef.current = false;
      lastViewportSignatureRef.current = "";
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    if (!isMapStyleSafe(map)) return;

    syncCircleLayer(
      map,
      center,
      radiusM,
      boundaryEnabled && boundaryType === "circle"
    );

    if (!boundaryEnabled || boundaryType !== "polygon") {
      clearPolygonPreviewLayer(map);
      return;
    }

    if (isPolygonDrawing) {
      syncPolygonPreviewFromPoints(map, draftPolygonPoints);
      return;
    }

    syncPolygonPreviewFromPoints(map, polygonPoints);
  }, [
    center,
    radiusM,
    boundaryEnabled,
    boundaryType,
    polygonPoints,
    isPolygonDrawing,
    draftPolygonPoints,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    syncUserLocationMarker(map, locationMarkerRef, userLocation);
  }, [userLocation]);

  useEffect(() => {
    const draw = drawRef.current;
    const map = mapRef.current;
    if (!draw || !map || !readyRef.current) return;
    if (!isMapStyleSafe(map)) return;

    if (!boundaryEnabled) {
      clearDraw(draw);
      clearPolygonPreviewLayer(map);
      setIsPolygonDrawing(false);
      setDraftPolygonPoints([]);
      draftPolygonPointsRef.current = [];
      isPolygonDrawingRef.current = false;
      return;
    }

    if (boundaryType === "polygon") {
      if (isPolygonDrawing) {
        clearDraw(draw);
        syncPolygonPreviewFromPoints(map, draftPolygonPoints);
        return;
      }

      try {
        draw.setMode("select");
      } catch {}

      syncPolygonInDraw(draw, polygonPoints);
      syncPolygonPreviewFromPoints(map, polygonPoints);

      if (polygonPoints.length >= 3) {
        try {
          draw.setMode("select");
        } catch {}
      }

      return;
    }

    clearDraw(draw);
    clearPolygonPreviewLayer(map);
    setIsPolygonDrawing(false);
    setDraftPolygonPoints([]);
    draftPolygonPointsRef.current = [];
    isPolygonDrawingRef.current = false;
  }, [
    boundaryEnabled,
    boundaryType,
    polygonPoints,
    isPolygonDrawing,
    draftPolygonPoints,
  ]);

  async function handleSearchPlace() {
    const query = searchText.trim();

    if (!query) {
      setSearchError("Digite um local para buscar.");
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      setSearchError(null);
      setLocateError(null);

      const results = await searchLocation(query);
      setSearchResults(results);

      if (results.length === 0) {
        setSearchError("Nenhum local encontrado.");
      }
    } catch (error) {
      console.error("Erro ao buscar local:", error);
      setSearchError("Não foi possível buscar esse local.");
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function handlePickSearchResult(result: SearchResult) {
    try {
      const nextCenter = {
        latitude: result.latitude,
        longitude: result.longitude,
      };

      onChangeCenter(nextCenter);
      setSearchText(result.name);
      setSearchResults([]);
      setSearchError(null);
      setLocateError(null);

      const map = mapRef.current;
      if (map) {
        map.flyTo({
          center: [result.longitude, result.latitude],
          zoom: 13,
          essential: true,
        });
      }
    } catch (error) {
      console.error("Erro ao aplicar resultado da busca no mapa:", error);
      setLocateError("Não foi possível centralizar o mapa.");
    }
  }

  function handleUseMyLocation() {
    setLocateError(null);

    if (typeof window === "undefined" || !navigator.geolocation) {
      setLocateError("Geolocalização não suportada neste navegador.");
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        try {
          const nextCenter = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };

          setUserLocation(nextCenter);
          onChangeCenter(nextCenter);

          const map = mapRef.current;
          if (map) {
            map.flyTo({
              center: [nextCenter.longitude, nextCenter.latitude],
              zoom: 16,
              essential: true,
            });
          }
        } catch (error) {
          console.error("Erro ao aplicar localização no mapa:", error);
          setLocateError("Não foi possível centralizar o mapa.");
        } finally {
          setIsLocating(false);
        }
      },
      (geoError) => {
        console.error("Erro de geolocalização:", geoError);
        setLocateError("Não foi possível obter sua localização.");
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }

  function handleStartPolygonDraw() {
    const draw = drawRef.current;
    const map = mapRef.current;
    if (!draw || !map) return;
    if (!isMapStyleSafe(map)) return;

    setPolygonError(null);

    try {
      try {
        draw.setMode("select");
      } catch {}

      clearDraw(draw);
      clearPolygonPreviewLayer(map);

      draftPolygonPointsRef.current = [];
      isPolygonDrawingRef.current = true;

      setDraftPolygonPoints([]);
      setIsPolygonDrawing(true);
    } catch (error) {
      console.error("Erro ao iniciar desenho:", error);
      isPolygonDrawingRef.current = false;
      setIsPolygonDrawing(false);
    }
  }

  function handleUndoLastPoint() {
    if (!isPolygonDrawingRef.current) return;

    setPolygonError(null);
    setDraftPolygonPoints((prev) => {
      const next = prev.slice(0, -1);
      draftPolygonPointsRef.current = next;
      return next;
    });
  }

  function handleFinishPolygonDraw() {
    const draw = drawRef.current;
    const map = mapRef.current;
    if (!draw || !map) return;
    if (!isMapStyleSafe(map)) return;

    const finalPoints = draftPolygonPointsRef.current;

    if (finalPoints.length < 3) {
      setPolygonError("Adicione pelo menos 3 pontos para finalizar a área.");
      return;
    }

    try {
      setPolygonError(null);

      onChangePolygonPoints(finalPoints);
      isPolygonDrawingRef.current = false;
      setIsPolygonDrawing(false);
      setDraftPolygonPoints([]);
      draftPolygonPointsRef.current = [];

      try {
        draw.setMode("select");
      } catch {}

      syncPolygonInDraw(draw, finalPoints);
      syncPolygonPreviewFromPoints(map, finalPoints);

      try {
        draw.setMode("select");
      } catch {}
    } catch (error) {
      console.error("Erro ao finalizar desenho:", error);
      setPolygonError("Não foi possível finalizar a área.");
    }
  }

  function handleClearPolygonDraw() {
    const draw = drawRef.current;
    const map = mapRef.current;
    if (!draw || !map) return;
    if (!isMapStyleSafe(map)) return;

    try {
      try {
        draw.setMode("select");
      } catch {}

      clearDraw(draw);
      clearPolygonPreviewLayer(map);
    } catch {}

    setPolygonError(null);
    isPolygonDrawingRef.current = false;
    setIsPolygonDrawing(false);
    setDraftPolygonPoints([]);
    draftPolygonPointsRef.current = [];
    onChangePolygonPoints([]);

    try {
      draw.setMode("select");
    } catch {}
  }

  return (
    <div style={styles.host}>
      <MapCanvas
        initialCenter={[center.longitude, center.latitude]}
        initialZoom={getZoomForRadius(radiusM)}
        onReady={onMapReady}
      />

      <div style={styles.toolbar}>
        <div style={styles.modePill}>
          {!boundaryEnabled
            ? "Perímetro desativado"
            : boundaryType === "circle"
            ? "Modo círculo"
            : isPolygonDrawing
            ? `Desenhando área (${draftPolygonPoints.length})`
            : "Área desenhada"}
        </div>

        <div style={styles.searchCard}>
          <div style={styles.searchRow}>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter") {
                  void handleSearchPlace();
                }
              }}
              placeholder="Buscar cidade, lago, marina..."
              style={styles.searchInput}
            />

            <button
              type="button"
              onClick={() => void handleSearchPlace()}
              style={styles.primaryButton}
            >
              {searching ? "Buscando..." : "Buscar"}
            </button>
          </div>

          <button
            type="button"
            onClick={handleUseMyLocation}
            style={styles.secondaryButton}
          >
            {isLocating ? "Localizando..." : "Usar minha localização"}
          </button>

          {boundaryType === "polygon" ? (
            <div style={styles.drawActions}>
              <button
                type="button"
                onClick={handleStartPolygonDraw}
                style={styles.secondaryButton}
              >
                Desenhar área
              </button>

              {isPolygonDrawing ? (
                <>
                  <button
                    type="button"
                    onClick={handleUndoLastPoint}
                    style={styles.secondaryButton}
                  >
                    Voltar último ponto
                  </button>

                  <button
                    type="button"
                    onClick={handleFinishPolygonDraw}
                    style={styles.primaryButton}
                  >
                    Finalizar área
                  </button>
                </>
              ) : null}

              <button
                type="button"
                onClick={handleClearPolygonDraw}
                style={styles.secondaryButton}
              >
                Limpar desenho
              </button>
            </div>
          ) : null}

          {searchResults.length > 0 ? (
            <div style={styles.searchResults}>
              {searchResults.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handlePickSearchResult(r)}
                  style={styles.searchResultItem}
                >
                  {r.name}
                </button>
              ))}
            </div>
          ) : null}

          {searchError ? <div style={styles.searchError}>{searchError}</div> : null}
          {polygonError ? <div style={styles.searchError}>{polygonError}</div> : null}
        </div>
      </div>

      {locateError ? <div style={styles.errorPill}>{locateError}</div> : null}

      <div style={styles.footerHint}>{helperText}</div>
    </div>
  );
}

function isMapStyleSafe(map: maplibregl.Map | null | undefined) {
  if (!map) return false;

  try {
    return typeof map.isStyleLoaded === "function" && map.isStyleLoaded();
  } catch {
    return false;
  }
}

function getGeoJsonSourceSafe(map: maplibregl.Map, sourceId: string) {
  try {
    if (!isMapStyleSafe(map)) return null;
    const source = map.getSource(sourceId);
    return source as maplibregl.GeoJSONSource | null;
  } catch {
    return null;
  }
}

function clearDraw(draw: TerraDraw) {
  const snapshot = draw.getSnapshot() as TerraFeature[];

  snapshot.forEach((feature) => {
    if (!feature?.id) return;

    try {
      draw.removeFeatures([feature.id]);
    } catch {}
  });
}

function syncPolygonInDraw(draw: TerraDraw, polygonPoints: LatLng[]) {
  clearDraw(draw);

  if (!Array.isArray(polygonPoints) || polygonPoints.length < 3) return;

  const coordinates: [number, number][][] = [
    [
      ...polygonPoints.map(
        (point): [number, number] => [point.longitude, point.latitude]
      ),
      [polygonPoints[0].longitude, polygonPoints[0].latitude],
    ],
  ];

  try {
    draw.addFeatures([
      {
        id: "cf-boundary-polygon",
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates,
        },
      } as any,
    ]);
  } catch (error) {
    console.error("Erro ao sincronizar polígono:", error);
  }
}

function ensurePolygonPreviewLayers(map: maplibregl.Map) {
  if (!isMapStyleSafe(map)) return false;

  try {
    if (!map.getSource(POLYGON_SOURCE_ID)) {
      map.addSource(POLYGON_SOURCE_ID, {
        type: "geojson",
        data: emptyFeatureCollection(),
      });
    }

    if (!map.getLayer(POLYGON_FILL_ID)) {
      map.addLayer({
        id: POLYGON_FILL_ID,
        type: "fill",
        source: POLYGON_SOURCE_ID,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-color": "#2563EB",
          "fill-opacity": 0.1,
        },
      });
    }

    if (!map.getLayer(POLYGON_LINE_ID)) {
      map.addLayer({
        id: POLYGON_LINE_ID,
        type: "line",
        source: POLYGON_SOURCE_ID,
        paint: {
          "line-color": "#2563EB",
          "line-width": 3,
          "line-opacity": 0.95,
        },
      });
    }

    return true;
  } catch (error) {
    console.error("Erro ao garantir camadas de preview do polígono:", error);
    return false;
  }
}

function clearPolygonPreviewLayer(map: maplibregl.Map) {
  const source = getGeoJsonSourceSafe(map, POLYGON_SOURCE_ID);
  if (!source) return;

  try {
    source.setData(emptyFeatureCollection() as any);
  } catch (error) {
    console.error("Erro ao limpar preview do polígono:", error);
  }
}

function syncPolygonPreviewFromPoints(map: maplibregl.Map, points: LatLng[]) {
  const ok = ensurePolygonPreviewLayers(map);
  if (!ok) return;

  const source = getGeoJsonSourceSafe(map, POLYGON_SOURCE_ID);
  if (!source) return;

  try {
    if (!Array.isArray(points) || points.length === 0) {
      source.setData(emptyFeatureCollection() as any);
      return;
    }

    const lineCoords = points.map(
      (point): [number, number] => [point.longitude, point.latitude]
    );

    const features: any[] = [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: lineCoords,
        },
      },
    ];

    if (points.length >= 3) {
      features.unshift({
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [[...lineCoords, lineCoords[0]]],
        },
      });
    }

    source.setData({
      type: "FeatureCollection",
      features,
    } as any);
  } catch (error) {
    console.error("Erro ao sincronizar preview do polígono por pontos:", error);
  }
}

function emptyFeatureCollection(): GeoJsonFeatureCollection {
  return {
    type: "FeatureCollection",
    features: [],
  };
}

function syncCircleLayer(
  map: maplibregl.Map,
  center: LatLng,
  radiusM: number,
  showCircle: boolean
) {
  if (!map || !isMapStyleSafe(map)) return;

  const sourceId = "cf-circle-source";
  const fillId = "cf-circle-fill";
  const lineId = "cf-circle-line";

  try {
    if (map.getLayer(fillId)) map.removeLayer(fillId);
    if (map.getLayer(lineId)) map.removeLayer(lineId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);

    if (!showCircle) return;

    const circleGeoJson = createCircleGeoJSON(center, radiusM);

    map.addSource(sourceId, {
      type: "geojson",
      data: circleGeoJson as any,
    });

    map.addLayer({
      id: fillId,
      type: "fill",
      source: sourceId,
      paint: {
        "fill-color": "#0B3C5D",
        "fill-opacity": 0.15,
      },
    });

    map.addLayer({
      id: lineId,
      type: "line",
      source: sourceId,
      paint: {
        "line-color": "#0B3C5D",
        "line-width": 2,
      },
    });
  } catch (error) {
    console.error("Erro ao sincronizar círculo no mapa:", error);
  }
}

function syncViewportOnceOrWhenStructureChanges(
  map: maplibregl.Map,
  center: LatLng,
  radiusM: number,
  boundaryEnabled: boolean,
  boundaryType: BoundaryType,
  polygonPoints: LatLng[],
  lastViewportSignatureRef: MutableRefObject<string>,
  hasDoneInitialViewportRef: MutableRefObject<boolean>
) {
  if (!map || !isMapStyleSafe(map)) return;

  const signature =
    boundaryType === "circle"
      ? `circle:${boundaryEnabled}:${center.latitude}:${center.longitude}:${radiusM}`
      : `polygon:${boundaryEnabled}:${polygonPoints
          .map((p) => `${p.latitude}:${p.longitude}`)
          .join("|")}`;

  if (hasDoneInitialViewportRef.current && lastViewportSignatureRef.current === signature) {
    return;
  }

  lastViewportSignatureRef.current = signature;
  hasDoneInitialViewportRef.current = true;

  try {
    if (!boundaryEnabled) {
      map.jumpTo({
        center: [center.longitude, center.latitude],
        zoom: 13,
      });
      return;
    }

    if (boundaryType === "circle") {
      const bounds = createBoundsFromRadius(center, radiusM);

      map.fitBounds(bounds, {
        padding: 40,
        duration: 0,
      });

      return;
    }

    if (polygonPoints.length === 0) {
      map.jumpTo({
        center: [center.longitude, center.latitude],
        zoom: 13,
      });
      return;
    }

    const bounds = polygonPoints.reduce(
      (acc, point) => {
        acc.extend([point.longitude, point.latitude]);
        return acc;
      },
      new maplibregl.LngLatBounds(
        [polygonPoints[0].longitude, polygonPoints[0].latitude],
        [polygonPoints[0].longitude, polygonPoints[0].latitude]
      )
    );

    map.fitBounds(bounds, {
      padding: 40,
      duration: 0,
    });
  } catch (error) {
    console.error("Erro ao ajustar viewport do mapa:", error);
  }
}

function syncUserLocationMarker(
  map: maplibregl.Map,
  markerRef: MutableRefObject<maplibregl.Marker | null>,
  userLocation: LatLng | null
) {
  if (!map || !isMapStyleSafe(map)) return;

  try {
    if (!userLocation) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    if (!markerRef.current) {
      const wrapper = document.createElement("div");
      wrapper.style.width = "28px";
      wrapper.style.height = "28px";
      wrapper.style.display = "flex";
      wrapper.style.alignItems = "center";
      wrapper.style.justifyContent = "center";
      wrapper.style.pointerEvents = "none";

      const halo = document.createElement("div");
      halo.style.width = "28px";
      halo.style.height = "28px";
      halo.style.borderRadius = "999px";
      halo.style.background = "rgba(37,99,235,0.18)";
      halo.style.display = "flex";
      halo.style.alignItems = "center";
      halo.style.justifyContent = "center";

      const dot = document.createElement("div");
      dot.style.width = "14px";
      dot.style.height = "14px";
      dot.style.borderRadius = "999px";
      dot.style.background = "#2563EB";
      dot.style.border = "3px solid #FFFFFF";
      dot.style.boxShadow = "0 4px 12px rgba(37,99,235,0.35)";

      halo.appendChild(dot);
      wrapper.appendChild(halo);

      markerRef.current = new maplibregl.Marker({
        element: wrapper,
        anchor: "center",
      });
    }

    markerRef.current
      .setLngLat([userLocation.longitude, userLocation.latitude])
      .addTo(map);
  } catch (error) {
    console.error("Erro ao atualizar marcador de localização:", error);
  }
}

function createBoundsFromRadius(center: LatLng, radiusM: number) {
  const safeRadius = Math.max(radiusM, 50);
  const deltaLat = safeRadius / 111320;
  const safeCos = Math.max(Math.cos((center.latitude * Math.PI) / 180), 0.01);
  const deltaLng = safeRadius / (111320 * safeCos);

  return new maplibregl.LngLatBounds(
    [center.longitude - deltaLng, center.latitude - deltaLat],
    [center.longitude + deltaLng, center.latitude + deltaLat]
  );
}

function createCircleGeoJSON(center: LatLng, radiusM: number) {
  const points = 64;
  const coords: [number, number][] = [];

  for (let i = 0; i <= points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    const dx = radiusM * Math.cos(angle);
    const dy = radiusM * Math.sin(angle);

    const deltaLat = dy / 111320;
    const deltaLng =
      dx /
      (111320 * Math.max(Math.cos((center.latitude * Math.PI) / 180), 0.01));

    coords.push([center.longitude + deltaLng, center.latitude + deltaLat]);
  }

  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [coords],
    },
  };
}

function getZoomForRadius(radiusM: number) {
  if (radiusM <= 800) return 15;
  if (radiusM <= 1500) return 14;
  if (radiusM <= 3000) return 13;
  if (radiusM <= 7000) return 12;
  if (radiusM <= 15000) return 11;
  if (radiusM <= 30000) return 10;
  return 8;
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
  toolbar: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
    zIndex: 10,
    pointerEvents: "none",
  },
  modePill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "10px 12px",
    borderRadius: 999,
    background: "rgba(11,60,93,0.92)",
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: 800,
    boxShadow: "0 10px 30px rgba(15,23,42,0.12)",
  },
  searchCard: {
    width: 360,
    maxWidth: "min(360px, calc(100vw - 40px))",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 10,
    borderRadius: 16,
    background: "rgba(255,255,255,0.96)",
    boxShadow: "0 10px 30px rgba(15,23,42,0.10)",
    pointerEvents: "auto",
  },
  searchRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 8,
  },
  searchInput: {
    width: "100%",
    border: "1px solid rgba(15,23,42,0.12)",
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 13,
    color: "#0F172A",
    background: "#FFFFFF",
    outline: "none",
  },
  primaryButton: {
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 12,
    padding: "10px 12px",
    background: "#0B3C5D",
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  secondaryButton: {
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 12,
    padding: "10px 12px",
    background: "#F8FAFC",
    color: "#0F172A",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },
  drawActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  searchResults: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    maxHeight: 220,
    overflowY: "auto",
  },
  searchResultItem: {
    textAlign: "left",
    border: "1px solid rgba(15,23,42,0.08)",
    padding: "10px 12px",
    borderRadius: 12,
    background: "#FFFFFF",
    color: "#0F172A",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    lineHeight: 1.4,
  },
  searchError: {
    color: "#B91C1C",
    fontSize: 12,
    fontWeight: 700,
  },
  footerHint: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    zIndex: 10,
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.94)",
    color: "#334155",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.5,
    boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
    pointerEvents: "none",
  },
  errorPill: {
    position: "absolute",
    left: 14,
    bottom: 70,
    zIndex: 10,
    maxWidth: 320,
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(127,29,29,0.94)",
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: 800,
    boxShadow: "0 10px 30px rgba(15,23,42,0.14)",
  },
};