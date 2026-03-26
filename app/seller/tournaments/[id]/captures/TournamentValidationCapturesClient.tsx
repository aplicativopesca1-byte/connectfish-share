"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { db } from "../../../../../src/lib/firebase";

type Props = {
  tournamentId: string;
};

type FirestoreTimestampLike = {
  toDate?: () => Date;
};

type TournamentDoc = {
  title?: string;
  location?: string;
  species?: string;
  minSizeCm?: number;
  scheduledStartAt?: unknown;
  scheduledEndAt?: unknown;
};

type CaptureStatus = "pending" | "approved" | "rejected";

type TournamentCapture = {
  id: string;
  tournamentId: string;
  teamId: string | null;
  teamName: string;
  captainId: string | null;
  userId: string | null;
  species: string;
  declaredLengthCm: number;
  approvedLengthCm: number | null;
  photoUrl: string;
  thumbnailUrl: string | null;
  capturedAt: string | null;
  submittedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  insideBoundary: boolean | null;
  status: CaptureStatus;
  judgeId: string | null;
  judgeName: string | null;
  judgeNotes: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
};

type FilterStatus = "all" | CaptureStatus;

type CaptureAlert = {
  key: string;
  label: string;
  tone: "red" | "yellow";
};

function toIsoStringSafe(value: unknown): string | null {
  if (!value) return null;

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as FirestoreTimestampLike).toDate === "function"
  ) {
    const date = (value as FirestoreTimestampLike).toDate?.();
    if (!date || Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  if (typeof value === "string") {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  return null;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function mapCaptureDoc(
  id: string,
  raw: Record<string, unknown>,
  tournamentId: string
): TournamentCapture {
  const statusRaw = String(raw.status ?? "pending").toLowerCase();
  const status: CaptureStatus =
    statusRaw === "approved" || statusRaw === "rejected" ? statusRaw : "pending";

  return {
    id,
    tournamentId,
    teamId: raw.teamId ? String(raw.teamId) : null,
    teamName: raw.teamName ? String(raw.teamName) : "Equipe não identificada",
    captainId: raw.captainId ? String(raw.captainId) : null,
    userId: raw.userId ? String(raw.userId) : null,
    species: raw.species ? String(raw.species) : "Espécie não informada",
    declaredLengthCm: Number(raw.declaredLengthCm ?? raw.lengthCm ?? 0) || 0,
    approvedLengthCm:
      raw.approvedLengthCm !== undefined && raw.approvedLengthCm !== null
        ? Number(raw.approvedLengthCm)
        : null,
    photoUrl: raw.photoUrl ? String(raw.photoUrl) : "",
    thumbnailUrl: raw.thumbnailUrl
      ? String(raw.thumbnailUrl)
      : raw.photoThumbnailUrl
      ? String(raw.photoThumbnailUrl)
      : null,
    capturedAt: toIsoStringSafe(raw.capturedAt),
    submittedAt: toIsoStringSafe(raw.submittedAt),
    latitude:
      raw.latitude !== undefined && raw.latitude !== null
        ? Number(raw.latitude)
        : null,
    longitude:
      raw.longitude !== undefined && raw.longitude !== null
        ? Number(raw.longitude)
        : null,
    insideBoundary:
      typeof raw.insideBoundary === "boolean" ? raw.insideBoundary : null,
    status,
    judgeId: raw.judgeId ? String(raw.judgeId) : null,
    judgeName: raw.judgeName ? String(raw.judgeName) : null,
    judgeNotes: raw.judgeNotes ? String(raw.judgeNotes) : null,
    approvedAt: toIsoStringSafe(raw.approvedAt),
    rejectedAt: toIsoStringSafe(raw.rejectedAt),
  };
}

function deriveCaptureAlerts(params: {
  capture: TournamentCapture;
  minSizeCm: number;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
}) {
  const alerts: CaptureAlert[] = [];

  if (params.minSizeCm > 0 && params.capture.declaredLengthCm < params.minSizeCm) {
    alerts.push({
      key: "min_size",
      label: `Peixe abaixo do mínimo (${params.minSizeCm} cm)`,
      tone: "red",
    });
  }

  if (params.capture.insideBoundary === false) {
    alerts.push({
      key: "boundary",
      label: "Captura fora da área permitida",
      tone: "red",
    });
  }

  if (params.scheduledStartAt && params.capture.capturedAt) {
    const startMs = new Date(params.scheduledStartAt).getTime();
    const captureMs = new Date(params.capture.capturedAt).getTime();

    if (!Number.isNaN(startMs) && !Number.isNaN(captureMs) && captureMs < startMs) {
      alerts.push({
        key: "before_start",
        label: "Captura realizada antes do início",
        tone: "yellow",
      });
    }
  }

  if (params.scheduledEndAt && params.capture.capturedAt) {
    const endMs = new Date(params.scheduledEndAt).getTime();
    const captureMs = new Date(params.capture.capturedAt).getTime();

    if (!Number.isNaN(endMs) && !Number.isNaN(captureMs) && captureMs > endMs) {
      alerts.push({
        key: "after_end",
        label: "Captura realizada após o encerramento",
        tone: "red",
      });
    }
  }

  return alerts;
}

export default function TournamentValidationCapturesClient({ tournamentId }: Props) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [tournamentTitle, setTournamentTitle] = useState("Torneio");
  const [tournamentLocation, setTournamentLocation] = useState("Local não definido");
  const [tournamentMinSizeCm, setTournamentMinSizeCm] = useState(0);
  const [scheduledStartAt, setScheduledStartAt] = useState<string | null>(null);
  const [scheduledEndAt, setScheduledEndAt] = useState<string | null>(null);

  const [captures, setCaptures] = useState<TournamentCapture[]>([]);
  const [selectedCaptureId, setSelectedCaptureId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("pending");

  const [judgeName, setJudgeName] = useState("Organização");
  const [judgeNotes, setJudgeNotes] = useState("");
  const [approvedLengthCm, setApprovedLengthCm] = useState<number>(0);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedCapture = useMemo(
    () => captures.find((item) => item.id === selectedCaptureId) || null,
    [captures, selectedCaptureId]
  );

  const selectedCaptureImageSrc = useMemo(() => {
    if (!selectedCapture) return null;
    return selectedCapture.photoUrl || selectedCapture.thumbnailUrl || null;
  }, [selectedCapture]);

  const selectedCaptureAlerts = useMemo(() => {
    if (!selectedCapture) return [];
    return deriveCaptureAlerts({
      capture: selectedCapture,
      minSizeCm: tournamentMinSizeCm,
      scheduledStartAt,
      scheduledEndAt,
    });
  }, [selectedCapture, tournamentMinSizeCm, scheduledStartAt, scheduledEndAt]);

  const filteredCaptures = useMemo(() => {
    if (filterStatus === "all") return captures;
    return captures.filter((item) => item.status === filterStatus);
  }, [captures, filterStatus]);

  const stats = useMemo(() => {
    const pending = captures.filter((item) => item.status === "pending").length;
    const approved = captures.filter((item) => item.status === "approved").length;
    const rejected = captures.filter((item) => item.status === "rejected").length;
    const flagged = captures.filter(
      (item) =>
        deriveCaptureAlerts({
          capture: item,
          minSizeCm: tournamentMinSizeCm,
          scheduledStartAt,
          scheduledEndAt,
        }).length > 0
    ).length;

    return {
      total: captures.length,
      pending,
      approved,
      rejected,
      flagged,
    };
  }, [captures, tournamentMinSizeCm, scheduledStartAt, scheduledEndAt]);

  useEffect(() => {
    if (!tournamentId?.trim()) {
      setError("ID do torneio inválido.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribers: Array<() => void> = [];

    const tournamentRef = doc(db, "tournaments", tournamentId);
    const capturesQuery = query(
      collection(db, "tournamentCaptures"),
      where("tournamentId", "==", tournamentId),
      orderBy("submittedAt", "desc")
    );

    let tournamentLoaded = false;
    let capturesLoaded = false;

    const resolveLoading = () => {
      if (tournamentLoaded && capturesLoaded) {
        setLoading(false);
      }
    };

    unsubscribers.push(
      onSnapshot(
        tournamentRef,
        (snap) => {
          if (!snap.exists()) {
            setError("Torneio não encontrado.");
            tournamentLoaded = true;
            resolveLoading();
            return;
          }

          const data = snap.data() as TournamentDoc;
          setTournamentTitle(data.title || "Torneio");
          setTournamentLocation(data.location || "Local não definido");
          setTournamentMinSizeCm(Number(data.minSizeCm ?? 0) || 0);
          setScheduledStartAt(toIsoStringSafe(data.scheduledStartAt));
          setScheduledEndAt(toIsoStringSafe(data.scheduledEndAt));

          tournamentLoaded = true;
          resolveLoading();
        },
        (err) => {
          console.error("Erro realtime torneio:", err);
          setError("Não foi possível carregar os dados do torneio.");
          tournamentLoaded = true;
          resolveLoading();
        }
      )
    );

    unsubscribers.push(
      onSnapshot(
        capturesQuery,
        (snapshot) => {
          const items = snapshot.docs.map((item) =>
            mapCaptureDoc(item.id, item.data() as Record<string, unknown>, tournamentId)
          );

          setCaptures(items);
          setSelectedCaptureId((prev) => {
            if (prev && items.some((item) => item.id === prev)) return prev;
            return items[0]?.id || null;
          });

          capturesLoaded = true;
          resolveLoading();
        },
        (err) => {
          console.error("Erro realtime capturas:", err);
          setError("Não foi possível carregar as capturas do torneio.");
          capturesLoaded = true;
          resolveLoading();
        }
      )
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [tournamentId]);

  useEffect(() => {
    if (!selectedCapture) {
      setJudgeNotes("");
      setApprovedLengthCm(0);
      return;
    }

    setJudgeNotes(selectedCapture.judgeNotes || "");
    setApprovedLengthCm(
      selectedCapture.approvedLengthCm ?? selectedCapture.declaredLengthCm ?? 0
    );
  }, [selectedCapture]);

  async function handleApprove() {
    if (!selectedCapture) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const normalizedApprovedLength = Number(approvedLengthCm || 0);

      if (normalizedApprovedLength <= 0) {
        setError("Informe uma medida aprovada válida.");
        return;
      }

      if (tournamentMinSizeCm > 0 && normalizedApprovedLength < tournamentMinSizeCm) {
        setError(`A medida aprovada precisa ser de no mínimo ${tournamentMinSizeCm} cm.`);
        return;
      }

      const ref = doc(db, "tournamentCaptures", selectedCapture.id);

      await updateDoc(ref, {
        status: "approved",
        approvedLengthCm: normalizedApprovedLength,
        judgeName: judgeName.trim() || "Organização",
        judgeNotes: judgeNotes.trim() || null,
        approvedAt: serverTimestamp(),
        rejectedAt: null,
      });

      setMessage("Captura aprovada com sucesso.");
    } catch (err) {
      console.error("Erro ao aprovar captura:", err);
      setError("Não foi possível aprovar a captura.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReject() {
    if (!selectedCapture) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      if (!judgeNotes.trim()) {
        setError("Informe o motivo da reprovação para registrar a decisão.");
        return;
      }

      const ref = doc(db, "tournamentCaptures", selectedCapture.id);

      await updateDoc(ref, {
        status: "rejected",
        judgeName: judgeName.trim() || "Organização",
        judgeNotes: judgeNotes.trim(),
        rejectedAt: serverTimestamp(),
        approvedAt: null,
      });

      setMessage("Captura reprovada com sucesso.");
    } catch (err) {
      console.error("Erro ao reprovar captura:", err);
      setError("Não foi possível reprovar a captura.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <div style={styles.card}>
            <h1 style={styles.title}>Validação de capturas</h1>
            <p style={styles.muted}>Carregando capturas do torneio...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>Validação de capturas</h1>
            <p style={styles.subtitle}>
              Painel operacional para a organização aprovar ou reprovar os peixes enviados.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push(`/seller/tournaments/${tournamentId}`)}
            style={styles.secondaryButton}
          >
            Voltar ao torneio
          </button>
        </div>

        <div style={styles.heroCard}>
          <div style={styles.heroTop}>
            <div>
              <h2 style={styles.heroTitle}>{tournamentTitle}</h2>
              <p style={styles.heroLocation}>{tournamentLocation}</p>
            </div>

            <div style={styles.badgesWrap}>
              <span style={styles.badgeBlue}>🏆 {tournamentId}</span>
              <span style={styles.badgeYellow}>Fila operacional</span>
            </div>
          </div>

          <div style={styles.statsGrid}>
            <StatCard label="Total" value={String(stats.total)} />
            <StatCard label="Pendentes" value={String(stats.pending)} />
            <StatCard label="Aprovadas" value={String(stats.approved)} />
            <StatCard label="Reprovadas" value={String(stats.rejected)} />
            <StatCard label="Com alerta" value={String(stats.flagged)} />
          </div>
        </div>

        <div style={styles.filtersRow}>
          <FilterButton active={filterStatus === "pending"} label="Pendentes" onClick={() => setFilterStatus("pending")} />
          <FilterButton active={filterStatus === "approved"} label="Aprovadas" onClick={() => setFilterStatus("approved")} />
          <FilterButton active={filterStatus === "rejected"} label="Reprovadas" onClick={() => setFilterStatus("rejected")} />
          <FilterButton active={filterStatus === "all"} label="Todas" onClick={() => setFilterStatus("all")} />
        </div>

        <div style={styles.grid}>
          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Fila de capturas</h3>
            </div>

            {filteredCaptures.length === 0 ? (
              <p style={styles.muted}>Nenhuma captura encontrada neste filtro.</p>
            ) : (
              <div style={styles.captureList}>
                {filteredCaptures.map((capture) => {
                  const isActive = capture.id === selectedCaptureId;
                  const alerts = deriveCaptureAlerts({
                    capture,
                    minSizeCm: tournamentMinSizeCm,
                    scheduledStartAt,
                    scheduledEndAt,
                  });

                  return (
                    <button
                      key={capture.id}
                      type="button"
                      onClick={() => setSelectedCaptureId(capture.id)}
                      style={{
                        ...styles.captureRowButton,
                        ...(isActive ? styles.captureRowButtonActive : {}),
                      }}
                    >
                      <div style={styles.captureRowTop}>
                        <strong style={styles.captureTeam}>{capture.teamName}</strong>
                        <span style={getStatusBadgeStyle(capture.status)}>
                          {getStatusLabel(capture.status)}
                        </span>
                      </div>

                      <div style={styles.captureMetaGrid}>
                        <MiniInfo label="Espécie" value={capture.species} />
                        <MiniInfo label="Medida" value={`${capture.declaredLengthCm} cm`} />
                        <MiniInfo label="Enviado" value={formatDateTime(capture.submittedAt)} />
                      </div>

                      {alerts.length ? (
                        <div style={styles.inlineAlertsWrap}>
                          {alerts.map((alert) => (
                            <span
                              key={`${capture.id}-${alert.key}`}
                              style={
                                alert.tone === "red"
                                  ? styles.alertBadgeDanger
                                  : styles.alertBadgeWarning
                              }
                            >
                              {alert.label}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Detalhe da captura</h3>
            </div>

            {!selectedCapture ? (
              <p style={styles.muted}>Selecione uma captura para validar.</p>
            ) : (
              <div style={styles.detailWrap}>
                <div style={styles.imageCard}>
                  {selectedCaptureImageSrc ? (
                    <img
                      src={selectedCaptureImageSrc}
                      alt="Captura enviada"
                      style={styles.captureImage}
                    />
                  ) : (
                    <div style={styles.imageFallback}>Sem imagem</div>
                  )}
                </div>

                {selectedCaptureAlerts.length ? (
                  <div style={styles.alertPanel}>
                    <p style={styles.alertPanelTitle}>Alertas automáticos</p>
                    <div style={styles.alertsWrap}>
                      {selectedCaptureAlerts.map((alert) => (
                        <span
                          key={alert.key}
                          style={
                            alert.tone === "red"
                              ? styles.alertBadgeDanger
                              : styles.alertBadgeWarning
                          }
                        >
                          {alert.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={styles.okPanel}>
                    <p style={styles.okPanelTitle}>Nenhum alerta automático detectado</p>
                    <p style={styles.okPanelText}>
                      A captura não apresenta inconsistências básicas de medida, janela do torneio ou perímetro.
                    </p>
                  </div>
                )}

                <div style={styles.infoGrid}>
                  <InfoCard label="Equipe" value={selectedCapture.teamName} />
                  <InfoCard label="Espécie" value={selectedCapture.species} />
                  <InfoCard label="Medida enviada" value={`${selectedCapture.declaredLengthCm} cm`} />
                  <InfoCard label="Mínimo do torneio" value={`${tournamentMinSizeCm} cm`} />
                  <InfoCard label="Capturado em" value={formatDateTime(selectedCapture.capturedAt)} />
                  <InfoCard label="Enviado em" value={formatDateTime(selectedCapture.submittedAt)} />
                  <InfoCard label="Geofence" value={formatBoundaryValue(selectedCapture.insideBoundary)} />
                </div>

                <div style={styles.formGrid}>
                  <Field label="Nome do juiz / organização">
                    <input
                      type="text"
                      value={judgeName}
                      onChange={(e) => setJudgeName(e.target.value)}
                      style={styles.input}
                      placeholder="Nome do responsável"
                    />
                  </Field>

                  <Field label="Medida aprovada (cm)">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={approvedLengthCm}
                      onChange={(e) => setApprovedLengthCm(Number(e.target.value))}
                      style={styles.input}
                    />
                  </Field>
                </div>

                <Field label="Observação da validação">
                  <textarea
                    value={judgeNotes}
                    onChange={(e) => setJudgeNotes(e.target.value)}
                    style={styles.textarea}
                    placeholder="Observações do juiz, ajustes de medida, motivos da reprovação..."
                  />
                </Field>

                <div style={styles.locationBox}>
                  <p style={styles.locationTitle}>Localização da captura</p>
                  <p style={styles.locationText}>Latitude: {formatCoordinate(selectedCapture.latitude)}</p>
                  <p style={styles.locationText}>Longitude: {formatCoordinate(selectedCapture.longitude)}</p>

                  {selectedCapture.latitude !== null && selectedCapture.longitude !== null ? (
                    <a
                      href={`https://www.google.com/maps?q=${selectedCapture.latitude},${selectedCapture.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      style={styles.linkButton}
                    >
                      Abrir no Google Maps
                    </a>
                  ) : null}
                </div>

                <div style={styles.actionsRow}>
                  <button type="button" onClick={handleApprove} disabled={saving} style={styles.approveButton}>
                    {saving ? "Salvando..." : "Aprovar captura"}
                  </button>

                  <button type="button" onClick={handleReject} disabled={saving} style={styles.rejectButton}>
                    {saving ? "Salvando..." : "Reprovar captura"}
                  </button>
                </div>

                {message ? <p style={styles.successText}>{message}</p> : null}
                {error ? <p style={styles.errorText}>{error}</p> : null}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.statCard}>
      <p style={styles.statLabel}>{label}</p>
      <p style={styles.statValue}>{value}</p>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoCard}>
      <p style={styles.infoLabel}>{label}</p>
      <p style={styles.infoValue}>{value}</p>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.miniInfoCard}>
      <p style={styles.miniInfoLabel}>{label}</p>
      <p style={styles.miniInfoValue}>{value}</p>
    </div>
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

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.filterButton,
        ...(active ? styles.filterButtonActive : {}),
      }}
    >
      {label}
    </button>
  );
}

function getStatusLabel(status: CaptureStatus) {
  switch (status) {
    case "approved":
      return "Aprovada";
    case "rejected":
      return "Reprovada";
    case "pending":
    default:
      return "Pendente";
  }
}

function getStatusBadgeStyle(status: CaptureStatus): CSSProperties {
  if (status === "approved") {
    return {
      ...styles.statusBadge,
      background: "#DCFCE7",
      color: "#166534",
    };
  }

  if (status === "rejected") {
    return {
      ...styles.statusBadge,
      background: "#FEE2E2",
      color: "#B91C1C",
    };
  }

  return {
    ...styles.statusBadge,
    background: "#FEF3C7",
    color: "#92400E",
  };
}

function formatBoundaryValue(value: boolean | null) {
  if (value === true) return "Dentro da área";
  if (value === false) return "Fora da área";
  return "Não informado";
}

function formatCoordinate(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toFixed(6);
}

const styles: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: "#F8FAFC", padding: 24 },
  container: { maxWidth: 1400, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" },
  title: { margin: 0, fontSize: 30, fontWeight: 900, color: "#0B3C5D" },
  subtitle: { margin: "8px 0 0 0", color: "#64748B", fontSize: 15, fontWeight: 600, lineHeight: 1.6, maxWidth: 780 },
  muted: { margin: 0, color: "#64748B", fontSize: 14, fontWeight: 600, lineHeight: 1.6 },
  heroCard: { background: "#FFFFFF", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 20, padding: 20 },
  heroTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" },
  heroTitle: { margin: 0, fontSize: 22, fontWeight: 900, color: "#0F172A" },
  heroLocation: { margin: "8px 0 0 0", color: "#64748B", fontSize: 15, fontWeight: 700 },
  badgesWrap: { display: "flex", gap: 10, flexWrap: "wrap" },
  badgeBlue: { display: "inline-flex", alignItems: "center", padding: "8px 12px", borderRadius: 999, background: "#EAF2F7", color: "#0B3C5D", fontSize: 13, fontWeight: 800 },
  badgeYellow: { display: "inline-flex", alignItems: "center", padding: "8px 12px", borderRadius: 999, background: "#FEF3C7", color: "#92400E", fontSize: 13, fontWeight: 800 },
  statsGrid: { marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 },
  statCard: { background: "#F8FAFC", borderRadius: 14, padding: 14 },
  statLabel: { margin: 0, color: "#64748B", fontSize: 12, fontWeight: 800 },
  statValue: { margin: "6px 0 0 0", color: "#0F172A", fontSize: 22, fontWeight: 900 },
  filtersRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  filterButton: { border: "1px solid rgba(15,23,42,0.08)", borderRadius: 999, padding: "10px 14px", background: "#FFFFFF", color: "#0F172A", fontSize: 14, fontWeight: 800, cursor: "pointer" },
  filterButtonActive: { background: "#0B3C5D", color: "#FFFFFF", border: "1px solid #0B3C5D" },
  grid: { display: "grid", gridTemplateColumns: "420px minmax(0, 1fr)", gap: 16 },
  card: { background: "#FFFFFF", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 20, padding: 20, minWidth: 0 },
  sectionHeader: { marginBottom: 16 },
  sectionTitle: { margin: 0, fontSize: 18, fontWeight: 900, color: "#0F172A" },
  captureList: { display: "flex", flexDirection: "column", gap: 10 },
  captureRowButton: { border: "1px solid rgba(15,23,42,0.08)", borderRadius: 16, background: "#FFFFFF", padding: 14, textAlign: "left", cursor: "pointer" },
  captureRowButtonActive: { border: "1px solid #0B3C5D", background: "#FDFEFF", boxShadow: "0 0 0 3px rgba(11,60,93,0.06)" },
  captureRowTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 },
  captureTeam: { color: "#0F172A", fontSize: 15, fontWeight: 900 },
  statusBadge: { display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" },
  captureMetaGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 },
  miniInfoCard: { background: "#F8FAFC", borderRadius: 12, padding: 10 },
  miniInfoLabel: { margin: 0, color: "#64748B", fontSize: 11, fontWeight: 800 },
  miniInfoValue: { margin: "4px 0 0 0", color: "#0F172A", fontSize: 13, fontWeight: 800, lineHeight: 1.4 },
  inlineAlertsWrap: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 },
  detailWrap: { display: "flex", flexDirection: "column", gap: 16 },
  imageCard: { borderRadius: 18, overflow: "hidden", border: "1px solid rgba(15,23,42,0.08)", background: "#F8FAFC" },
  captureImage: { width: "100%", maxHeight: 460, objectFit: "cover", display: "block" },
  imageFallback: { minHeight: 260, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B", fontWeight: 700 },
  alertPanel: { background: "#FFF7ED", border: "1px solid #FDBA74", borderRadius: 16, padding: 16 },
  alertPanelTitle: { margin: 0, color: "#9A3412", fontSize: 14, fontWeight: 900 },
  okPanel: { background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 16, padding: 16 },
  okPanelTitle: { margin: 0, color: "#065F46", fontSize: 14, fontWeight: 900 },
  okPanelText: { margin: "8px 0 0 0", color: "#047857", fontSize: 14, fontWeight: 700, lineHeight: 1.6 },
  alertsWrap: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 },
  alertBadgeDanger: { display: "inline-flex", alignItems: "center", padding: "6px 10px", borderRadius: 999, background: "#FEE2E2", color: "#991B1B", fontSize: 12, fontWeight: 900 },
  alertBadgeWarning: { display: "inline-flex", alignItems: "center", padding: "6px 10px", borderRadius: 999, background: "#FEF3C7", color: "#92400E", fontSize: 12, fontWeight: 900 },
  infoGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 },
  infoCard: { background: "#F8FAFC", borderRadius: 14, padding: 14 },
  infoLabel: { margin: 0, color: "#64748B", fontSize: 12, fontWeight: 800 },
  infoValue: { margin: "6px 0 0 0", color: "#0F172A", fontSize: 14, fontWeight: 900, lineHeight: 1.5 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 },
  field: { display: "flex", flexDirection: "column", gap: 8 },
  label: { fontSize: 13, color: "#475569", fontWeight: 800 },
  input: { width: "100%", border: "1px solid rgba(15,23,42,0.12)", borderRadius: 12, padding: "12px 14px", fontSize: 14, color: "#0F172A", background: "#FFFFFF", outline: "none" },
  textarea: { minHeight: 120, resize: "vertical", border: "1px solid rgba(15,23,42,0.12)", borderRadius: 12, padding: "12px 14px", fontSize: 14, color: "#0F172A", background: "#FFFFFF", outline: "none", fontFamily: "inherit" },
  locationBox: { background: "#F8FAFC", borderRadius: 16, padding: 16 },
  locationTitle: { margin: 0, color: "#0F172A", fontSize: 14, fontWeight: 900 },
  locationText: { margin: "8px 0 0 0", color: "#475569", fontSize: 14, fontWeight: 700 },
  actionsRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  approveButton: { border: "none", borderRadius: 12, padding: "12px 16px", background: "#166534", color: "#FFFFFF", fontSize: 14, fontWeight: 800, cursor: "pointer" },
  rejectButton: { border: "none", borderRadius: 12, padding: "12px 16px", background: "#B91C1C", color: "#FFFFFF", fontSize: 14, fontWeight: 800, cursor: "pointer" },
  secondaryButton: { border: "1px solid rgba(15,23,42,0.08)", borderRadius: 12, padding: "12px 16px", background: "#FFFFFF", color: "#0F172A", fontSize: 14, fontWeight: 800, cursor: "pointer", textDecoration: "none" },
  linkButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: "fit-content", marginTop: 12, borderRadius: 12, padding: "12px 16px", background: "#EAF2F7", color: "#0B3C5D", textDecoration: "none", fontSize: 14, fontWeight: 800 },
  successText: { margin: 0, color: "#166534", fontWeight: 700 },
  errorText: { margin: 0, color: "#B91C1C", fontWeight: 700 },
};