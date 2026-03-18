"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type Props = {
  initialCenter?: [number, number];
  initialZoom?: number;
  onReady: (map: maplibregl.Map) => void;
};

const mapStyle: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
    },
  ],
};

export default function MapCanvas({
  initialCenter = [-51.9253, -14.235],
  initialZoom = 4,
  onReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const onReadyRef = useRef(onReady);
  const hasCalledReadyRef = useRef(false);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (mapInstanceRef.current) return;

    const map = new maplibregl.Map({
      container,
      style: mapStyle,
      center: initialCenter,
      zoom: initialZoom,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
      }),
      "bottom-right"
    );

    const handleLoad = () => {
      if (hasCalledReadyRef.current) return;
      hasCalledReadyRef.current = true;
      onReadyRef.current(map);
    };

    if (map.isStyleLoaded()) {
      handleLoad();
    } else {
      map.once("load", handleLoad);
    }

    mapInstanceRef.current = map;

    return () => {
      hasCalledReadyRef.current = false;

      try {
        map.remove();
      } catch {}

      mapInstanceRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 520,
      }}
    />
  );
}