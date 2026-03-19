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

type TournamentDoc = {
  title?: string;
  location?: string;
  boundaryEnabled?: boolean;
  boundary?: TournamentBoundary;
  boundaryCompleted?: boolean;
  setupStep?: number;
};

const DEFAULT_CENTER: LatLng = {
  latitude: -14.235,
  longitude: -51.9253,
};

const DEFAULT_RADIUS_M = 5000;

export default function TournamentMapEditor({ tournamentId }: Props) {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("Torneio");
  const [location, setLocation] = useState("Local não definido");

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

  function validateBeforeSave() {
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
      boundaryCompleted: true,
      setupStep: 2,
      updatedAt: serverTimestamp(),
    });
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      await persistBoundary();
      setMessage("Perímetro salvo com sucesso.");
    } catch (err) {
      console.error("Erro ao salvar perímetro:", err);
      setError(err instanceof Error ? err.message : "Não foi possível salvar o perímetro.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndGoToReview() {
    setSaving(true);
    setMessage(null);
    setError(null);

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
    setMessage(null);
    setError(null);
  }

  function clearPolygon() {
    setPolygonPoints([]);
    setMessage(null);
    setError(null);
  }

  function removeLastPolygonPoint() {
    setPolygonPoints((prev) => prev.slice(0, -1));
    setMessage(null);
    setError(null);
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
              Etapa 2 de 3 · Configure a área oficial de validação das capturas.
            </p>

            <div style={styles.headerMeta}>
              <span style={styles.metaPrimary}>{title}</span>
              <span style={styles.metaSecondary}>{location}</span>
              <span
                style={boundaryEnabled ? styles.metaSuccess : styles.metaNeutral}
              >
                {statusLabel}
              </span>
            </div>
          </div>

          <div style={styles.topActions}>
            <button
              type="button"
              onClick={() => router.push(`/seller/tournaments/${safeTournamentId}/edit?step=1`)}
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
            disabled={saving}
            style={{
              ...styles.primaryButton,
              ...(saving ? styles.disabledButton : {}),
            }}
          >
            {saving ? "Salvando..." : "Salvar e ir para etapa 3"}
          </button>
        </div>

        <div style={styles.grid}>
          <section style={styles.card}>
            <div style={styles.sectionHeaderCompact}>
              <h3 style={styles.sectionTitle}>Configuração</h3>
            </div>

            <label style={styles.toggleRow}>
              <input
                type="checkbox"
                checked={boundaryEnabled}
                onChange={(e) => {
                  setBoundaryEnabled(e.target.checked);
                  setMessage(null);
                  setError(null);
                }}
              />
              <span style={styles.toggleLabel}>
                Ativar perímetro do torneio
              </span>
            </label>

            <div style={styles.modeSwitchWrap}>
              <button
                type="button"
                onClick={() => {
                  setBoundaryType("circle");
                  setMessage(null);
                  setError(null);
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
                onClick={() => {
                  setBoundaryType("polygon");
                  setMessage(null);
                  setError(null);
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

            {boundaryType === "circle" ? (
              <>
                <div style={styles.formGrid}>
                  <Field label="Latitude">
                    <input
                      type="number"
                      step="0.000001"
                      value={latitude}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (Number.isFinite(value)) setLatitude(value);
                        setMessage(null);
                        setError(null);
                      }}
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Longitude">
                    <input
                      type="number"
                      step="0.000001"
                      value={longitude}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (Number.isFinite(value)) setLongitude(value);
                        setMessage(null);
                        setError(null);
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
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      if (Number.isFinite(value) && value > 0) setRadiusM(value);
                      setMessage(null);
                      setError(null);
                    }}
                    style={styles.input}
                  />
                </Field>

                <div style={styles.sliderWrap}>
                  <input
                    type="range"
                    min={500}
                    max={30000}
                    step={100}
                    value={radiusM}
                    onChange={(e) => {
                      setRadiusM(Number(e.target.value));
                      setMessage(null);
                      setError(null);
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
                  ajustar.
                </p>

                <div style={styles.actionsRowCompact}>
                  <button
                    type="button"
                    onClick={removeLastPolygonPoint}
                    disabled={polygonPoints.length === 0}
                    style={styles.secondaryButton}
                  >
                    Remover último
                  </button>

                  <button
                    type="button"
                    onClick={clearPolygon}
                    disabled={polygonPoints.length === 0}
                    style={styles.secondaryButton}
                  >
                    Limpar área
                  </button>
                </div>
              </>
            )}

            <div style={styles.footerActions}>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{
                  ...styles.primaryButton,
                  ...(saving ? styles.disabledButton : {}),
                }}
              >
                {saving ? "Salvando..." : "Salvar perímetro"}
              </button>

              <button
                type="button"
                onClick={handleSaveAndGoToReview}
                disabled={saving}
                style={{
                  ...styles.secondaryBlueButton,
                  ...(saving ? styles.disabledButton : {}),
                }}
              >
                {saving ? "Salvando..." : "Ir para etapa 3"}
              </button>

              <button
                type="button"
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
              <h3 style={styles.sectionTitle}>Editor visual</h3>

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
                    setLatitude(nextCenter.latitude);
                    setLongitude(nextCenter.longitude);
                    setMessage(null);
                    setError(null);
                  }}
                  onChangePolygonPoints={(nextPoints: LatLng[]) => {
                    setPolygonPoints(nextPoints);
                    setMessage(null);
                    setError(null);

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
    gridTemplateColumns: "minmax(340px, 400px) minmax(0, 1fr)",
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
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: "#0F172A",
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
    marginBottom: 18,
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
    height: 520,
    minHeight: 520,
    overflow: "hidden",
    borderRadius: 18,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#F8FAFC",
    position: "relative",
  },
  mapLoading: {
    width: "100%",
    height: "100%",
    minHeight: 520,
    display: "grid",
    placeItems: "center",
    color: "#64748B",
    fontWeight: 700,
    background: "#F8FAFC",
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