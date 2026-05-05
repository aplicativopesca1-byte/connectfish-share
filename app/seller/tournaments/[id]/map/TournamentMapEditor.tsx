"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { db } from "../../../../../src/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import BoundaryMapEditor from "../../components/map/boundary/BoundaryMapEditor";

type Props = {
  tournamentId: string;
};

type LatLng = {
  latitude: number;
  longitude: number;
};

type CircleBoundary = {
  type: "circle";
  center: LatLng;
  radiusM: number;
};

type PolygonBoundary = {
  type: "polygon";
  points: LatLng[];
};

type TournamentBoundary = CircleBoundary | PolygonBoundary | null;
type BoundaryType = "circle" | "polygon";
type TournamentStatus = "draft" | "scheduled" | "live" | "finished" | string;

type TournamentDoc = {
  title?: string;
  location?: string;
  status?: TournamentStatus;
  visibility?: string;
  boundaryEnabled?: boolean;
  boundary?: TournamentBoundary;
  boundaryCompleted?: boolean;
  setupStep?: number;
  boundaryType?: BoundaryType | null;
  boundaryCenter?: LatLng | null;
  boundaryRadiusM?: number | null;
  boundaryPolygonPoints?: LatLng[] | null;
};

const DEFAULT_CENTER: LatLng = {
  latitude: -14.235,
  longitude: -51.9253,
};

const DEFAULT_RADIUS_M = 5000;

const RADIUS_PRESETS = [
  { label: "500 m", value: 500 },
  { label: "1 km", value: 1000 },
  { label: "3 km", value: 3000 },
  { label: "5 km", value: 5000 },
  { label: "10 km", value: 10000 },
  { label: "20 km", value: 20000 },
];

export default function TournamentMapEditor({ tournamentId }: Props) {
  const router = useRouter();

  const { uid } = useAuth() as {
    uid?: string | null;
  };

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("Torneio");
  const [location, setLocation] = useState("Local não definido");
  const [status, setStatus] = useState<TournamentStatus>("draft");
  const [visibility, setVisibility] = useState("draft");

  const [boundaryEnabled, setBoundaryEnabled] = useState(true);
  const [boundaryType, setBoundaryType] = useState<BoundaryType>("circle");

  const [latitude, setLatitude] = useState<number>(DEFAULT_CENTER.latitude);
  const [longitude, setLongitude] = useState<number>(DEFAULT_CENTER.longitude);
  const [radiusM, setRadiusM] = useState<number>(DEFAULT_RADIUS_M);

  const [polygonPoints, setPolygonPoints] = useState<LatLng[]>([]);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const safeTournamentId = useMemo(() => {
    return typeof tournamentId === "string" ? tournamentId.trim() : "";
  }, [tournamentId]);

  const isOperationallyLocked = useMemo(() => {
    const normalizedStatus = String(status || "").toLowerCase();
    return normalizedStatus === "live" || normalizedStatus === "finished";
  }, [status]);

  useEffect(() => {
    if (!safeTournamentId) {
      setLoading(false);
      return;
    }

    void loadTournament();
  }, [safeTournamentId]);

  async function loadTournament() {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (!safeTournamentId) return;

      const ref = doc(db, "tournaments", safeTournamentId);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        setError("Torneio não encontrado.");
        return;
      }

      const data = snap.data() as TournamentDoc;

      setTitle(data.title || "Torneio");
      setLocation(data.location || "Local não definido");
      setStatus(data.status || "draft");
      setVisibility(data.visibility || "draft");

      const enabled = data.boundaryEnabled !== false;
      setBoundaryEnabled(enabled);

      const boundary = data.boundary;

      if (boundary?.type === "circle") {
        if (
          Number.isFinite(boundary.center?.latitude) &&
          Number.isFinite(boundary.center?.longitude) &&
          Number.isFinite(boundary.radiusM)
        ) {
          setBoundaryType("circle");
          setLatitude(boundary.center.latitude);
          setLongitude(boundary.center.longitude);
          setRadiusM(boundary.radiusM);
          setPolygonPoints([]);
          return;
        }
      }

      if (boundary?.type === "polygon") {
        const safePoints = Array.isArray(boundary.points)
          ? boundary.points.filter(
              (point) =>
                Number.isFinite(point?.latitude) &&
                Number.isFinite(point?.longitude)
            )
          : [];

        setBoundaryType("polygon");
        setPolygonPoints(safePoints);

        if (safePoints.length > 0) {
          const center = calculatePolygonCenter(safePoints);
          setLatitude(center.latitude);
          setLongitude(center.longitude);
        } else {
          setLatitude(DEFAULT_CENTER.latitude);
          setLongitude(DEFAULT_CENTER.longitude);
        }

        return;
      }

      // Fallback para documentos antigos que salvaram metadados separados.
      if (
        data.boundaryType === "circle" &&
        data.boundaryCenter &&
        Number.isFinite(data.boundaryCenter.latitude) &&
        Number.isFinite(data.boundaryCenter.longitude)
      ) {
        setBoundaryType("circle");
        setLatitude(data.boundaryCenter.latitude);
        setLongitude(data.boundaryCenter.longitude);
        setRadiusM(Number(data.boundaryRadiusM ?? DEFAULT_RADIUS_M));
        setPolygonPoints([]);
        return;
      }

      if (
        data.boundaryType === "polygon" &&
        Array.isArray(data.boundaryPolygonPoints)
      ) {
        const safePoints = data.boundaryPolygonPoints.filter(
          (point) =>
            Number.isFinite(point?.latitude) &&
            Number.isFinite(point?.longitude)
        );

        setBoundaryType("polygon");
        setPolygonPoints(safePoints);

        const center = safePoints.length
          ? calculatePolygonCenter(safePoints)
          : DEFAULT_CENTER;

        setLatitude(center.latitude);
        setLongitude(center.longitude);
        return;
      }

      setBoundaryType("circle");
      setLatitude(DEFAULT_CENTER.latitude);
      setLongitude(DEFAULT_CENTER.longitude);
      setRadiusM(DEFAULT_RADIUS_M);
      setPolygonPoints([]);
    } catch (err) {
      console.error("Erro ao carregar mapa do torneio:", err);
      setError("Não foi possível carregar os dados do torneio.");
    } finally {
      setLoading(false);
    }
  }

  function clearFeedback() {
    setMessage(null);
    setError(null);
  }

  function validateBeforeSave() {
    if (isOperationallyLocked) {
      return {
        ok: false as const,
        message:
          "Este torneio está ao vivo ou finalizado. O perímetro não pode ser alterado.",
      };
    }

    if (!boundaryEnabled) {
      return { ok: true as const };
    }

    if (boundaryType === "circle") {
      if (!isValidLatitude(latitude)) {
        return { ok: false as const, message: "Latitude inválida." };
      }

      if (!isValidLongitude(longitude)) {
        return { ok: false as const, message: "Longitude inválida." };
      }

      if (!Number.isFinite(radiusM) || radiusM < 100 || radiusM > 100000) {
        return {
          ok: false as const,
          message: "O raio deve ficar entre 100 m e 100000 m.",
        };
      }

      return { ok: true as const };
    }

    if (boundaryType === "polygon") {
      if (!Array.isArray(polygonPoints) || polygonPoints.length < 3) {
        return {
          ok: false as const,
          message: "O polígono precisa ter pelo menos 3 pontos.",
        };
      }

      const allValid = polygonPoints.every(
        (point) =>
          isValidLatitude(point.latitude) && isValidLongitude(point.longitude)
      );

      if (!allValid) {
        return {
          ok: false as const,
          message: "Existem pontos inválidos no polígono.",
        };
      }

      return { ok: true as const };
    }

    return { ok: false as const, message: "Tipo de perímetro inválido." };
  }

  function buildBoundary(): TournamentBoundary {
    if (!boundaryEnabled) return null;

    if (boundaryType === "circle") {
      return {
        type: "circle",
        center: {
          latitude,
          longitude,
        },
        radiusM,
      };
    }

    return {
      type: "polygon",
      points: polygonPoints.map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
      })),
    };
  }

  function buildBoundaryMetadata() {
    if (!boundaryEnabled) {
      return {
        boundaryType: null,
        boundaryCenter: null,
        boundaryRadiusM: null,
        boundaryPolygonPoints: [],
        boundaryAreaKm2: null,
        boundaryAreaHectares: null,
        boundaryPointCount: 0,
      };
    }

    if (boundaryType === "circle") {
      const areaKm2 = calculateCircleAreaKm2(radiusM);

      return {
        boundaryType: "circle" as const,
        boundaryCenter: {
          latitude,
          longitude,
        },
        boundaryRadiusM: radiusM,
        boundaryPolygonPoints: [],
        boundaryAreaKm2: roundNumber(areaKm2, 4),
        boundaryAreaHectares: roundNumber(areaKm2 * 100, 2),
        boundaryPointCount: 0,
      };
    }

    const center = polygonPoints.length
      ? calculatePolygonCenter(polygonPoints)
      : null;

    const areaKm2 =
      polygonPoints.length >= 3 ? calculatePolygonAreaKm2(polygonPoints) : 0;

    return {
      boundaryType: "polygon" as const,
      boundaryCenter: center,
      boundaryRadiusM: null,
      boundaryPolygonPoints: polygonPoints.map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
      })),
      boundaryAreaKm2: roundNumber(areaKm2, 4),
      boundaryAreaHectares: roundNumber(areaKm2 * 100, 2),
      boundaryPointCount: polygonPoints.length,
    };
  }

  async function persistBoundary() {
    if (!safeTournamentId) {
      throw new Error("ID do torneio inválido.");
    }

    const validation = validateBeforeSave();
    if (!validation.ok) {
      throw new Error(validation.message);
    }

    const ref = doc(db, "tournaments", safeTournamentId);

    await updateDoc(ref, {
      boundaryEnabled,
      boundary: buildBoundary(),
      ...buildBoundaryMetadata(),
      boundaryCompleted: boundaryEnabled ? true : true,
      boundaryUpdatedAt: serverTimestamp(),
      boundaryUpdatedBy: uid || null,
      setupStep: 2,
      updatedAt: serverTimestamp(),
    });
  }

  async function handleSave() {
    setSaving(true);
    clearFeedback();

    try {
      await persistBoundary();
      setMessage("Perímetro salvo com sucesso.");
    } catch (err) {
      console.error("Erro ao salvar perímetro:", err);
      setError(
        err instanceof Error ? err.message : "Não foi possível salvar o perímetro."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndGoToReview() {
    setSaving(true);
    clearFeedback();

    try {
      await persistBoundary();
      router.push(`/seller/tournaments/${safeTournamentId}/edit?step=3`);
    } catch (err) {
      console.error("Erro ao salvar perímetro e ir para revisão:", err);
      setError(err instanceof Error ? err.message : "Não foi possível continuar.");
    } finally {
      setSaving(false);
    }
  }

  function resetCircle() {
    setLatitude(DEFAULT_CENTER.latitude);
    setLongitude(DEFAULT_CENTER.longitude);
    setRadiusM(DEFAULT_RADIUS_M);
    clearFeedback();
  }

  function clearPolygon() {
    setPolygonPoints([]);
    clearFeedback();
  }

  function removeLastPolygonPoint() {
    setPolygonPoints((prev) => prev.slice(0, -1));
    clearFeedback();
  }

  function useCurrentLocation() {
    clearFeedback();

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Seu navegador não permite acessar a localização atual.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);

        if (boundaryType === "polygon") {
          setBoundaryType("circle");
          setPolygonPoints([]);
        }

        setMessage("Localização atual aplicada ao mapa.");
      },
      () => {
        setError("Não foi possível obter sua localização atual.");
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000,
      }
    );
  }

  function centerByTournamentLocation() {
    clearFeedback();

    const query = encodeURIComponent(location || title || "Brasil");

    if (typeof window !== "undefined") {
      window.open(`https://www.google.com/maps/search/${query}`, "_blank");
    }

    setMessage(
      "Abrimos a busca no Google Maps. Copie as coordenadas do local e ajuste no mapa."
    );
  }

  const previewMapUrl = useMemo(() => {
    if (boundaryType === "polygon" && polygonPoints.length > 0) {
      const center = calculatePolygonCenter(polygonPoints);
      return `https://www.google.com/maps?q=${center.latitude},${center.longitude}`;
    }

    return `https://www.google.com/maps?q=${latitude},${longitude}`;
  }, [boundaryType, polygonPoints, latitude, longitude]);

  const approxKm = useMemo(() => {
    return (radiusM / 1000).toFixed(radiusM >= 1000 ? 1 : 2);
  }, [radiusM]);

  const polygonCenter = useMemo(() => {
    if (polygonPoints.length === 0) return null;
    return calculatePolygonCenter(polygonPoints);
  }, [polygonPoints]);

  const circleAreaKm2 = useMemo(() => {
    return calculateCircleAreaKm2(radiusM);
  }, [radiusM]);

  const polygonAreaKm2 = useMemo(() => {
    if (polygonPoints.length < 3) return 0;
    return calculatePolygonAreaKm2(polygonPoints);
  }, [polygonPoints]);

  const selectedAreaKm2 = useMemo(() => {
    if (!boundaryEnabled) return 0;
    if (boundaryType === "circle") return circleAreaKm2;
    return polygonAreaKm2;
  }, [boundaryEnabled, boundaryType, circleAreaKm2, polygonAreaKm2]);

  const selectedAreaLabel = useMemo(() => {
    if (!boundaryEnabled) return "—";

    if (!selectedAreaKm2 || selectedAreaKm2 <= 0) {
      return boundaryType === "polygon" ? "Desenhe ao menos 3 pontos" : "—";
    }

    return `${formatNumber(selectedAreaKm2, 2)} km² · ${formatNumber(
      selectedAreaKm2 * 100,
      1
    )} ha`;
  }, [boundaryEnabled, boundaryType, selectedAreaKm2]);

  const statusLabel = useMemo(() => {
    if (!boundaryEnabled) return "Perímetro desativado";

    if (boundaryType === "circle") {
      return `Círculo • ${radiusM} m`;
    }

    return polygonPoints.length >= 3
      ? `Área desenhada • ${polygonPoints.length} pontos`
      : `Área em edição • ${polygonPoints.length} ponto${
          polygonPoints.length === 1 ? "" : "s"
        }`;
  }, [boundaryEnabled, boundaryType, radiusM, polygonPoints.length]);

  const statusBadgeStyle = boundaryEnabled ? styles.metaSuccess : styles.metaNeutral;

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <div style={styles.card}>
            <h1 style={styles.title}>Mapa do torneio</h1>
            <p style={styles.muted}>Carregando configuração do perímetro...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!safeTournamentId) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <div style={styles.card}>
            <h1 style={styles.title}>Mapa do torneio</h1>
            <p style={styles.errorText}>ID do torneio inválido.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.headerRow}>
          <div style={styles.headerInfo}>
            <h1 style={styles.title}>Mapa do torneio</h1>
            <p style={styles.subtitle}>
              Etapa 2 de 3 · Configure a área oficial usada para validar as
              capturas enviadas pelos participantes.
            </p>

            <div style={styles.headerMeta}>
              <span style={styles.metaPrimary}>{title}</span>
              <span style={styles.metaSecondary}>{location}</span>
              <span style={statusBadgeStyle}>{statusLabel}</span>
              <span style={styles.metaNeutral}>
                Status: {getStatusLabel(status)} · {visibility || "draft"}
              </span>
            </div>
          </div>

          <div style={styles.topActions}>
            <button
              type="button"
              onClick={() =>
                router.push(`/seller/tournaments/${safeTournamentId}/edit?step=1`)
              }
              style={styles.secondaryButton}
            >
              Voltar para etapa 1
            </button>

            <button
              type="button"
              onClick={() => router.push(`/seller/tournaments/${safeTournamentId}`)}
              style={styles.secondaryButton}
            >
              Voltar ao torneio
            </button>
          </div>
        </div>

        {isOperationallyLocked ? (
          <div style={styles.lockedBanner}>
            <strong>Perímetro bloqueado.</strong>
            <span>
              Torneios ao vivo ou finalizados não devem ter a área oficial
              alterada para preservar a integridade das capturas.
            </span>
          </div>
        ) : null}

        <div style={styles.stepBanner}>
          <div style={styles.stepBannerLeft}>
            <strong style={styles.stepBannerTitle}>Fluxo de criação</strong>
            <span style={styles.stepBannerText}>
              Depois de salvar o perímetro, siga para a revisão final e publicação.
            </span>
          </div>

          <button
            type="button"
            onClick={handleSaveAndGoToReview}
            disabled={saving || isOperationallyLocked}
            style={{
              ...styles.primaryButton,
              ...(saving || isOperationallyLocked ? styles.disabledButton : {}),
            }}
          >
            {saving ? "Salvando..." : "Salvar e ir para etapa 3"}
          </button>
        </div>

        <div style={styles.grid}>
          <section style={styles.card}>
            <div style={styles.sectionHeaderCompact}>
              <h3 style={styles.sectionTitle}>Configuração</h3>
              <p style={styles.sectionDescription}>
                Defina se o torneio usará um raio simples ou uma área desenhada
                no mapa. Capturas fora dessa área poderão ser recusadas
                automaticamente no futuro.
              </p>
            </div>

            <label style={styles.toggleRow}>
              <input
                type="checkbox"
                checked={boundaryEnabled}
                disabled={isOperationallyLocked}
                onChange={(e) => {
                  setBoundaryEnabled(e.target.checked);
                  clearFeedback();
                }}
              />
              <span style={styles.toggleLabel}>Ativar perímetro do torneio</span>
            </label>

            <div style={styles.modeSwitchWrap}>
              <button
                type="button"
                disabled={isOperationallyLocked}
                onClick={() => {
                  setBoundaryType("circle");
                  clearFeedback();
                }}
                style={
                  boundaryType === "circle"
                    ? styles.segmentButtonActive
                    : styles.segmentButton
                }
              >
                Círculo
              </button>

              <button
                type="button"
                disabled={isOperationallyLocked}
                onClick={() => {
                  setBoundaryType("polygon");
                  clearFeedback();
                }}
                style={
                  boundaryType === "polygon"
                    ? styles.segmentButtonActive
                    : styles.segmentButton
                }
              >
                Área desenhada
              </button>
            </div>

            <div style={styles.quickActions}>
              <button
                type="button"
                onClick={useCurrentLocation}
                disabled={isOperationallyLocked}
                style={styles.secondaryBlueButton}
              >
                Usar minha localização
              </button>

              <button
                type="button"
                onClick={centerByTournamentLocation}
                style={styles.secondaryButton}
              >
                Buscar local no Google Maps
              </button>
            </div>

            {boundaryType === "circle" ? (
              <>
                <div style={styles.formGrid}>
                  <Field label="Latitude">
                    <input
                      type="number"
                      step="0.000001"
                      value={latitude}
                      disabled={isOperationallyLocked}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (Number.isFinite(value)) setLatitude(value);
                        clearFeedback();
                      }}
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Longitude">
                    <input
                      type="number"
                      step="0.000001"
                      value={longitude}
                      disabled={isOperationallyLocked}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (Number.isFinite(value)) setLongitude(value);
                        clearFeedback();
                      }}
                      style={styles.input}
                    />
                  </Field>
                </div>

                <Field label="Raio em metros">
                  <input
                    type="number"
                    min={100}
                    step={100}
                    value={radiusM}
                    disabled={isOperationallyLocked}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      if (Number.isFinite(value) && value > 0) setRadiusM(value);
                      clearFeedback();
                    }}
                    style={styles.input}
                  />
                </Field>

                <div style={styles.presetGrid}>
                  {RADIUS_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      disabled={isOperationallyLocked}
                      onClick={() => {
                        setRadiusM(preset.value);
                        clearFeedback();
                      }}
                      style={
                        radiusM === preset.value
                          ? styles.presetButtonActive
                          : styles.presetButton
                      }
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div style={styles.sliderWrap}>
                  <input
                    type="range"
                    min={500}
                    max={30000}
                    step={100}
                    value={radiusM}
                    disabled={isOperationallyLocked}
                    onChange={(e) => {
                      setRadiusM(Number(e.target.value));
                      clearFeedback();
                    }}
                    style={{ width: "100%" }}
                  />
                  <p style={styles.helperText}>
                    Raio atual: <strong>{radiusM} m</strong> ({approxKm} km)
                  </p>
                </div>
              </>
            ) : (
              <>
                <div style={styles.metricStack}>
                  <div style={styles.metricRow}>
                    <span style={styles.metricRowLabel}>Pontos</span>
                    <strong style={styles.metricRowValue}>
                      {polygonPoints.length}
                    </strong>
                  </div>

                  <div style={styles.metricRow}>
                    <span style={styles.metricRowLabel}>Status</span>
                    <strong style={styles.metricRowValue}>
                      {polygonPoints.length >= 3 ? "Válido" : "Em edição"}
                    </strong>
                  </div>

                  <div style={styles.metricRow}>
                    <span style={styles.metricRowLabel}>Centro aproximado</span>
                    <strong style={styles.metricRowValue}>
                      {polygonCenter
                        ? `${polygonCenter.latitude.toFixed(
                            4
                          )}, ${polygonCenter.longitude.toFixed(4)}`
                        : "—"}
                    </strong>
                  </div>
                </div>

                <p style={styles.helperText}>
                  Clique no mapa para adicionar pontos e arraste os vértices para
                  ajustar. Use pelo menos 3 pontos.
                </p>

                <div style={styles.actionsRowCompact}>
                  <button
                    type="button"
                    onClick={removeLastPolygonPoint}
                    disabled={polygonPoints.length === 0 || isOperationallyLocked}
                    style={styles.secondaryButton}
                  >
                    Remover último
                  </button>

                  <button
                    type="button"
                    onClick={clearPolygon}
                    disabled={polygonPoints.length === 0 || isOperationallyLocked}
                    style={styles.secondaryButton}
                  >
                    Limpar área
                  </button>
                </div>
              </>
            )}

            <div style={styles.metricsCard}>
              <div style={styles.metricRow}>
                <span style={styles.metricRowLabel}>Área aproximada</span>
                <strong style={styles.metricRowValue}>{selectedAreaLabel}</strong>
              </div>

              <div style={styles.metricRow}>
                <span style={styles.metricRowLabel}>Validação</span>
                <strong style={styles.metricRowValue}>
                  {boundaryEnabled
                    ? "Capturas devem estar dentro da área"
                    : "Validação geográfica desativada"}
                </strong>
              </div>
            </div>

            <div style={styles.warningBox}>
              <strong style={styles.warningTitle}>Atenção</strong>
              <p style={styles.warningText}>
                Configure essa área com cuidado. Ela será a referência oficial
                para validar capturas do torneio. Em torneios publicados, evite
                alterar o perímetro sem avisar os participantes.
              </p>
            </div>

            <div style={styles.footerActions}>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || isOperationallyLocked}
                style={{
                  ...styles.primaryButton,
                  ...(saving || isOperationallyLocked ? styles.disabledButton : {}),
                }}
              >
                {saving ? "Salvando..." : "Salvar perímetro"}
              </button>

              <button
                type="button"
                onClick={handleSaveAndGoToReview}
                disabled={saving || isOperationallyLocked}
                style={{
                  ...styles.secondaryBlueButton,
                  ...(saving || isOperationallyLocked ? styles.disabledButton : {}),
                }}
              >
                {saving ? "Salvando..." : "Ir para etapa 3"}
              </button>

              <button
                type="button"
                disabled={isOperationallyLocked}
                onClick={() => {
                  if (boundaryType === "circle") {
                    resetCircle();
                  } else {
                    clearPolygon();
                  }
                }}
                style={styles.secondaryButton}
              >
                {boundaryType === "circle" ? "Resetar posição" : "Resetar área"}
              </button>
            </div>

            {message ? <p style={styles.successText}>{message}</p> : null}
            {error ? <p style={styles.errorText}>{error}</p> : null}
          </section>

          <section style={styles.mapCard}>
            <div style={styles.mapHeader}>
              <div>
                <h3 style={styles.sectionTitle}>Editor visual</h3>
                <p style={styles.sectionDescription}>
                  Ajuste a área oficial diretamente no mapa.
                </p>
              </div>

              <a
                href={previewMapUrl}
                target="_blank"
                rel="noreferrer"
                style={styles.linkButton}
              >
                Abrir no Google Maps
              </a>
            </div>

            <div style={styles.mapWrap}>
              {mounted ? (
                <BoundaryMapEditor
                  center={{ latitude, longitude }}
                  radiusM={radiusM}
                  boundaryEnabled={boundaryEnabled}
                  boundaryType={boundaryType}
                  polygonPoints={polygonPoints}
                  onChangeCenter={(nextCenter: LatLng) => {
                    if (isOperationallyLocked) return;

                    setLatitude(nextCenter.latitude);
                    setLongitude(nextCenter.longitude);
                    clearFeedback();
                  }}
                  onChangePolygonPoints={(nextPoints: LatLng[]) => {
                    if (isOperationallyLocked) return;

                    setPolygonPoints(nextPoints);
                    clearFeedback();

                    if (nextPoints.length > 0) {
                      const center = calculatePolygonCenter(nextPoints);
                      setLatitude(center.latitude);
                      setLongitude(center.longitude);
                    }
                  }}
                />
              ) : (
                <div style={styles.mapLoading}>Carregando editor visual...</div>
              )}

              {isOperationallyLocked ? (
                <div style={styles.mapOverlay}>
                  <strong>Mapa bloqueado</strong>
                  <span>Este torneio não permite edição do perímetro.</span>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  );
}

function isValidLatitude(value: number) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value: number) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

function calculatePolygonCenter(points: LatLng[]): LatLng {
  if (!points.length) return DEFAULT_CENTER;

  const sum = points.reduce(
    (acc, point) => {
      acc.latitude += point.latitude;
      acc.longitude += point.longitude;
      return acc;
    },
    { latitude: 0, longitude: 0 }
  );

  return {
    latitude: sum.latitude / points.length,
    longitude: sum.longitude / points.length,
  };
}

function calculateCircleAreaKm2(radiusM: number) {
  if (!Number.isFinite(radiusM) || radiusM <= 0) return 0;

  const radiusKm = radiusM / 1000;
  return Math.PI * radiusKm * radiusKm;
}

function calculatePolygonAreaKm2(points: LatLng[]) {
  if (!Array.isArray(points) || points.length < 3) return 0;

  const earthRadiusM = 6378137;
  const avgLat =
    points.reduce((sum, point) => sum + point.latitude, 0) / points.length;
  const avgLatRad = degreesToRadians(avgLat);

  const projected = points.map((point) => ({
    x: earthRadiusM * degreesToRadians(point.longitude) * Math.cos(avgLatRad),
    y: earthRadiusM * degreesToRadians(point.latitude),
  }));

  let areaM2 = 0;

  for (let index = 0; index < projected.length; index += 1) {
    const current = projected[index];
    const next = projected[(index + 1) % projected.length];

    areaM2 += current.x * next.y - next.x * current.y;
  }

  return Math.abs(areaM2 / 2) / 1_000_000;
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function roundNumber(value: number, decimals: number) {
  if (!Number.isFinite(value)) return 0;

  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatNumber(value: number, decimals: number) {
  if (!Number.isFinite(value)) return "0";

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function getStatusLabel(status: TournamentStatus) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "live") return "Ao vivo";
  if (normalized === "finished") return "Finalizado";
  if (normalized === "scheduled") return "Publicado";
  return "Rascunho";
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#F8FAFC",
    padding: 24,
  },
  container: {
    maxWidth: 1260,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },
  headerInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  topActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: 30,
    fontWeight: 900,
    color: "#0B3C5D",
  },
  subtitle: {
    margin: 0,
    color: "#64748B",
    fontSize: 15,
    fontWeight: 600,
    lineHeight: 1.5,
  },
  headerMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  metaPrimary: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#EAF2F7",
    color: "#0B3C5D",
    fontSize: 13,
    fontWeight: 800,
  },
  metaSecondary: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#F1F5F9",
    color: "#334155",
    fontSize: 13,
    fontWeight: 800,
  },
  metaSuccess: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#DCFCE7",
    color: "#166534",
    fontSize: 13,
    fontWeight: 800,
  },
  metaNeutral: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#E5E7EB",
    color: "#374151",
    fontSize: 13,
    fontWeight: 800,
  },
  lockedBanner: {
    background: "#FEF3C7",
    border: "1px solid #FCD34D",
    borderRadius: 18,
    padding: 16,
    color: "#92400E",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 14,
    lineHeight: 1.5,
  },
  stepBanner: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 10px 30px rgba(15,23,42,0.04)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  stepBannerLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  stepBannerTitle: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 900,
  },
  stepBannerText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.5,
  },
  muted: {
    margin: 0,
    color: "#64748B",
    fontSize: 14,
    fontWeight: 600,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(340px, 420px) minmax(0, 1fr)",
    gap: 16,
    alignItems: "start",
  },
  card: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 20,
    padding: 20,
    boxShadow: "0 10px 30px rgba(15,23,42,0.04)",
  },
  mapCard: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 20,
    padding: 20,
    boxShadow: "0 10px 30px rgba(15,23,42,0.04)",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  sectionHeaderCompact: {
    marginBottom: 14,
  },
  mapHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: "#0F172A",
  },
  sectionDescription: {
    margin: "8px 0 0 0",
    fontSize: 13,
    lineHeight: 1.55,
    color: "#64748B",
    fontWeight: 600,
  },
  toggleRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
    fontWeight: 700,
    color: "#0F172A",
  },
  toggleLabel: {
    fontSize: 14,
  },
  modeSwitchWrap: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginBottom: 14,
    padding: 6,
    borderRadius: 14,
    background: "#F1F5F9",
  },
  segmentButton: {
    border: "none",
    borderRadius: 10,
    padding: "12px 14px",
    background: "transparent",
    color: "#475569",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  },
  segmentButtonActive: {
    border: "none",
    borderRadius: 10,
    padding: "12px 14px",
    background: "#FFFFFF",
    color: "#0B3C5D",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(15,23,42,0.08)",
  },
  quickActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 18,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    color: "#475569",
    fontWeight: 800,
  },
  input: {
    width: "100%",
    border: "1px solid rgba(15,23,42,0.12)",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 14,
    color: "#0F172A",
    background: "#FFFFFF",
    outline: "none",
  },
  presetGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
    marginBottom: 12,
  },
  presetButton: {
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 12,
    padding: "10px 12px",
    background: "#FFFFFF",
    color: "#334155",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },
  presetButtonActive: {
    border: "1px solid #0B3C5D",
    borderRadius: 12,
    padding: "10px 12px",
    background: "#EAF2F7",
    color: "#0B3C5D",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
  sliderWrap: {
    marginTop: 4,
  },
  helperText: {
    margin: "10px 0 0 0",
    color: "#64748B",
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.6,
  },
  metricStack: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginTop: 4,
  },
  metricsCard: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginTop: 18,
    padding: 14,
    borderRadius: 16,
    background: "#F8FAFC",
    border: "1px solid rgba(15,23,42,0.08)",
  },
  metricRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    borderRadius: 14,
    background: "#F8FAFC",
    border: "1px solid rgba(15,23,42,0.06)",
  },
  metricRowLabel: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: 800,
  },
  metricRowValue: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: 900,
    textAlign: "right",
  },
  actionsRowCompact: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 14,
  },
  warningBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    background: "#FFF7ED",
    border: "1px solid #FED7AA",
  },
  warningTitle: {
    display: "block",
    color: "#9A3412",
    fontSize: 14,
    fontWeight: 900,
    marginBottom: 6,
  },
  warningText: {
    margin: 0,
    color: "#9A3412",
    fontSize: 13,
    lineHeight: 1.55,
    fontWeight: 600,
  },
  footerActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 18,
  },
  primaryButton: {
    border: "none",
    borderRadius: 12,
    padding: "12px 16px",
    background: "#0B3C5D",
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 12,
    padding: "12px 16px",
    background: "#FFFFFF",
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    textDecoration: "none",
  },
  secondaryBlueButton: {
    border: "1px solid #BFDBFE",
    borderRadius: 12,
    padding: "12px 16px",
    background: "#EFF6FF",
    color: "#1D4ED8",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  },
  disabledButton: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  successText: {
    marginTop: 14,
    color: "#166534",
    fontWeight: 700,
  },
  errorText: {
    marginTop: 14,
    color: "#B91C1C",
    fontWeight: 700,
  },
  mapWrap: {
    width: "100%",
    height: 560,
    minHeight: 560,
    overflow: "hidden",
    borderRadius: 18,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#F8FAFC",
    position: "relative",
  },
  mapLoading: {
    width: "100%",
    height: "100%",
    minHeight: 560,
    display: "grid",
    placeItems: "center",
    color: "#64748B",
    fontWeight: 700,
    background: "#F8FAFC",
  },
  mapOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(15,23,42,0.55)",
    color: "#FFFFFF",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 24,
    zIndex: 999,
  },
  linkButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    borderRadius: 12,
    padding: "10px 14px",
    background: "#EAF2F7",
    color: "#0B3C5D",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 800,
  },
};
