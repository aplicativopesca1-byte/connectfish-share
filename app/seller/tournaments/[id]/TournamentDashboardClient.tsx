"use client"

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { db } from "../../../../src/lib/firebase";

type Props = {
  tournamentId: string;
};

type FirestoreTimestampLike = {
  toDate?: () => Date;
};

type TournamentStatus = "draft" | "scheduled" | "live" | "finished" | string;

type TournamentBoundary = {
  type?: "circle";
  center?: {
    latitude?: number;
    longitude?: number;
  };
  radiusM?: number;
} | null;

type TournamentDoc = {
  title?: string;
  subtitle?: string | null;
  location?: string;
  description?: string | null;
  species?: string;
  minSizeCm?: number;
  validFishCount?: number;
  status?: TournamentStatus;
  rules?: string[];
  boundaryEnabled?: boolean;
  boundary?: TournamentBoundary;
  scheduledStartAt?: unknown;
  scheduledEndAt?: unknown;
  registrationUrl?: string | null;
  adminUrl?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
  publishedAt?: unknown;
  startedAt?: unknown;
  finishedAt?: unknown;
};

type CaptureStatus = "pending" | "approved" | "rejected";

type TournamentCapture = {
  id: string;
  teamName: string;
  species: string;
  declaredLengthCm: number;
  submittedAt: string | null;
  insideBoundary: boolean | null;
  status: CaptureStatus;
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
    if (!Number.isNaN(date.getTime())) return date.toISOString();
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

function normalizeStatus(status: unknown): TournamentStatus {
  const value = String(status ?? "").toLowerCase();

  if (["draft", "rascunho"].includes(value)) return "draft";
  if (["scheduled", "agendado", "published"].includes(value)) return "scheduled";
  if (["live", "ativo", "active", "in_progress"].includes(value)) return "live";
  if (["finished", "encerrado", "ended", "closed"].includes(value)) return "finished";

  return value || "draft";
}

function getTournamentStatusMeta(status: TournamentStatus) {
  switch (status) {
    case "live":
      return { label: "Ao vivo", bg: "#DCFCE7", color: "#166534" };
    case "finished":
      return { label: "Finalizado", bg: "#E5E7EB", color: "#374151" };
    case "scheduled":
      return { label: "Agendado", bg: "#FEF3C7", color: "#92400E" };
    case "draft":
    default:
      return { label: "Rascunho", bg: "#DBEAFE", color: "#1D4ED8" };
  }
}

function mapCaptureDoc(rawId: string, raw: Record<string, unknown>): TournamentCapture {
  const statusRaw = String(raw.status ?? "pending").toLowerCase();
  const status: CaptureStatus =
    statusRaw === "approved" || statusRaw === "rejected" ? statusRaw : "pending";

  return {
    id: rawId,
    teamName: raw.teamName ? String(raw.teamName) : "Equipe não identificada",
    species: raw.species ? String(raw.species) : "Espécie não informada",
    declaredLengthCm: Number(raw.declaredLengthCm ?? raw.lengthCm ?? 0) || 0,
    submittedAt: toIsoStringSafe(raw.submittedAt),
    insideBoundary:
      typeof raw.insideBoundary === "boolean" ? raw.insideBoundary : null,
    status,
  };
}

function formatBoundaryValue(value: boolean | null) {
  if (value === true) return "Dentro da área";
  if (value === false) return "Fora da área";
  return "Não informado";
}

export default function TournamentDashboardClient({ tournamentId }: Props) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [tournament, setTournament] = useState<TournamentDoc | null>(null);
  const [captures, setCaptures] = useState<TournamentCapture[]>([]);
  const [teamsCount, setTeamsCount] = useState(0);

  useEffect(() => {
    void loadPage();
  }, [tournamentId]);

  async function loadPage() {
    setLoading(true);
    setError(null);

    try {
      if (!tournamentId?.trim()) {
        setError("ID do torneio inválido.");
        return;
      }

      await Promise.all([loadTournament(), loadCaptures(), loadTeamsCount()]);
    } catch (err) {
      console.error("Erro ao carregar central do torneio:", err);
      setError("Não foi possível carregar os dados do torneio.");
    } finally {
      setLoading(false);
    }
  }

  async function loadTournament() {
    const ref = doc(db, "tournaments", tournamentId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      setError("Torneio não encontrado.");
      return;
    }

    setTournament(snap.data() as TournamentDoc);
  }

  async function loadCaptures() {
    const capturesRef = collection(db, "tournamentCaptures");
    const capturesQuery = query(
      capturesRef,
      where("tournamentId", "==", tournamentId),
      orderBy("submittedAt", "desc")
    );

    const snapshot = await getDocs(capturesQuery);
    const items = snapshot.docs.map((item) =>
      mapCaptureDoc(item.id, item.data() as Record<string, unknown>)
    );

    setCaptures(items);
  }

  async function loadTeamsCount() {
    try {
      const teamsRef = collection(db, "tournamentTeams");
      const teamsQuery = query(teamsRef, where("tournamentId", "==", tournamentId));
      const snapshot = await getDocs(teamsQuery);
      setTeamsCount(snapshot.size);
    } catch {
      setTeamsCount(0);
    }
  }

  async function updateTournamentStatus(nextStatus: TournamentStatus) {
    if (!tournament) return;

    const currentStatus = normalizeStatus(tournament.status);
    const nextMeta = getTournamentStatusMeta(nextStatus);

    let confirmMessage = `Deseja alterar o status para "${nextMeta.label}"?`;

    if (nextStatus === "scheduled") {
      confirmMessage =
        'Publicar este torneio? Ele sairá de "Rascunho" e ficará como "Agendado".';
    }

    if (nextStatus === "live") {
      confirmMessage =
        'Iniciar este torneio agora? O status passará para "Ao vivo".';
    }

    if (nextStatus === "finished") {
      confirmMessage =
        'Encerrar este torneio? Essa é uma ação operacional importante.';
    }

    if (nextStatus === "draft") {
      confirmMessage =
        'Voltar este torneio para "Rascunho"? Isso pode impactar a operação atual.';
    }

    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) return;

    setSavingStatus(true);
    setMessage(null);
    setError(null);

    try {
      const ref = doc(db, "tournaments", tournamentId);

      const payload: Record<string, unknown> = {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      };

      if (currentStatus === "draft" && nextStatus === "scheduled") {
        payload.publishedAt = serverTimestamp();
      }

      if (nextStatus === "live") {
        payload.startedAt = serverTimestamp();
      }

      if (nextStatus === "finished") {
        payload.finishedAt = serverTimestamp();
      }

      await updateDoc(ref, payload);

      await loadTournament();

      setMessage(`Status do torneio atualizado para ${nextMeta.label}.`);
    } catch (err) {
      console.error("Erro ao atualizar status do torneio:", err);
      setError("Não foi possível atualizar o status do torneio.");
    } finally {
      setSavingStatus(false);
    }
  }

  const title = tournament?.title || "Torneio";
  const subtitle = tournament?.subtitle || "";
  const location = tournament?.location || "Local não definido";
  const description = tournament?.description || "";
  const species = tournament?.species || "Espécie não definida";
  const minSizeCm = Number(tournament?.minSizeCm ?? 0) || 0;
  const validFishCount = Number(tournament?.validFishCount ?? 0) || 0;
  const status = normalizeStatus(tournament?.status);
  const statusMeta = getTournamentStatusMeta(status);

  const scheduledStartAt = toIsoStringSafe(tournament?.scheduledStartAt);
  const scheduledEndAt = toIsoStringSafe(tournament?.scheduledEndAt);
  const createdAt = toIsoStringSafe(tournament?.createdAt);
  const updatedAt = toIsoStringSafe(tournament?.updatedAt);
  const publishedAt = toIsoStringSafe(tournament?.publishedAt);
  const startedAt = toIsoStringSafe(tournament?.startedAt);
  const finishedAt = toIsoStringSafe(tournament?.finishedAt);

  const pendingCaptures = captures.filter((item) => item.status === "pending");
  const approvedCaptures = captures.filter((item) => item.status === "approved");
  const rejectedCaptures = captures.filter((item) => item.status === "rejected");

  const boundaryConfigured = useMemo(() => {
    const boundary = tournament?.boundary;
    return !!(
      tournament?.boundaryEnabled &&
      boundary &&
      boundary.type === "circle" &&
      Number.isFinite(boundary.center?.latitude) &&
      Number.isFinite(boundary.center?.longitude) &&
      Number.isFinite(boundary.radiusM)
    );
  }, [tournament]);

  const rulesConfigured = Array.isArray(tournament?.rules) && tournament.rules.length > 0;
  const scheduleConfigured = !!(scheduledStartAt && scheduledEndAt);
  const basicInfoConfigured = !!(
    tournament?.title?.trim() &&
    tournament?.location?.trim() &&
    tournament?.species?.trim()
  );

  const readinessItems = [
    {
      label: "Dados básicos",
      done: basicInfoConfigured,
      help: "Nome, local e espécie preenchidos.",
    },
    {
      label: "Regras",
      done: rulesConfigured,
      help: "Regras principais cadastradas.",
    },
    {
      label: "Perímetro",
      done: !tournament?.boundaryEnabled || boundaryConfigured,
      help: "Área oficial pronta para validar capturas.",
    },
    {
      label: "Agenda",
      done: scheduleConfigured,
      help: "Janela do torneio definida.",
    },
  ];

  const readyCount = readinessItems.filter((item) => item.done).length;
  const isReadyToPublish = readyCount === readinessItems.length;

  const canPublish = status === "draft" && isReadyToPublish;
  const canStart = status === "scheduled";
  const canFinish = status === "live";
  const canReturnToDraft = status !== "draft";

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <section style={styles.card}>
            <h1 style={styles.title}>Central do torneio</h1>
            <p style={styles.muted}>Carregando dados operacionais...</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>Central do torneio</h1>
            <p style={styles.subtitle}>
              Painel principal para operação, acompanhamento e configuração do torneio.
            </p>
          </div>

          <div style={styles.headerActions}>
            <button
              type="button"
              onClick={() => router.push("/seller/tournaments")}
              style={styles.secondaryButton}
            >
              Voltar para lista
            </button>

            <Link href={`/seller/tournaments/${tournamentId}/edit`} style={styles.primaryLink}>
              Editar torneio
            </Link>
          </div>
        </div>

        <section style={styles.heroCard}>
          <div style={styles.heroTop}>
            <div>
              <h2 style={styles.heroTitle}>{title}</h2>
              {subtitle ? <p style={styles.heroSubtitle}>{subtitle}</p> : null}
              <p style={styles.heroLocation}>📍 {location}</p>
            </div>

            <div style={styles.heroBadges}>
              <span
                style={{
                  ...styles.heroBadge,
                  background: statusMeta.bg,
                  color: statusMeta.color,
                }}
              >
                {statusMeta.label}
              </span>

              <span style={styles.heroBadgeBlue}>🏆 {tournamentId}</span>

              <span style={isReadyToPublish ? styles.heroBadgeGreen : styles.heroBadgeGray}>
                {isReadyToPublish ? "Pronto para publicar" : "Configuração pendente"}
              </span>
            </div>
          </div>

          <div style={styles.heroMetaGrid}>
            <MiniKpi label="Espécie" value={species} />
            <MiniKpi label="Mínimo" value={`${minSizeCm} cm`} />
            <MiniKpi label="Peixes válidos" value={String(validFishCount)} />
            <MiniKpi label="Início" value={formatDateTime(scheduledStartAt)} />
            <MiniKpi label="Fim" value={formatDateTime(scheduledEndAt)} />
          </div>

          {description ? <p style={styles.description}>{description}</p> : null}
        </section>

        {error ? (
          <section style={styles.errorCard}>
            <h3 style={styles.errorTitle}>Erro na central do torneio</h3>
            <p style={styles.errorText}>{error}</p>
          </section>
        ) : null}

        {message ? (
          <section style={styles.successCard}>
            <p style={styles.successText}>{message}</p>
          </section>
        ) : null}

        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>Ações de status</h3>
            <p style={styles.sectionSub}>
              Controle operacional do ciclo de vida do torneio.
            </p>
          </div>

          <div style={styles.statusActionsGrid}>
            <button
              type="button"
              disabled={!canPublish || savingStatus}
              onClick={() => void updateTournamentStatus("scheduled")}
              style={{
                ...styles.statusActionButton,
                ...styles.publishButton,
                ...((!canPublish || savingStatus) ? styles.buttonDisabled : {}),
              }}
            >
              {savingStatus && canPublish ? "Salvando..." : "Publicar torneio"}
            </button>

            <button
              type="button"
              disabled={!canStart || savingStatus}
              onClick={() => void updateTournamentStatus("live")}
              style={{
                ...styles.statusActionButton,
                ...styles.startButton,
                ...((!canStart || savingStatus) ? styles.buttonDisabled : {}),
              }}
            >
              {savingStatus && canStart ? "Salvando..." : "Iniciar torneio"}
            </button>

            <button
              type="button"
              disabled={!canFinish || savingStatus}
              onClick={() => void updateTournamentStatus("finished")}
              style={{
                ...styles.statusActionButton,
                ...styles.finishButton,
                ...((!canFinish || savingStatus) ? styles.buttonDisabled : {}),
              }}
            >
              {savingStatus && canFinish ? "Salvando..." : "Encerrar torneio"}
            </button>

            <button
              type="button"
              disabled={!canReturnToDraft || savingStatus}
              onClick={() => void updateTournamentStatus("draft")}
              style={{
                ...styles.statusActionButton,
                ...styles.draftButton,
                ...((!canReturnToDraft || savingStatus) ? styles.buttonDisabled : {}),
              }}
            >
              {savingStatus && canReturnToDraft ? "Salvando..." : "Voltar para rascunho"}
            </button>
          </div>

          {!isReadyToPublish && status === "draft" ? (
            <p style={styles.helperWarning}>
              Para publicar, finalize dados básicos, regras, perímetro e agenda.
            </p>
          ) : null}
        </section>

        <div style={styles.kpiGrid}>
          <KpiCard label="Equipes" value={String(teamsCount)} emoji="👥" />
          <KpiCard label="Capturas pendentes" value={String(pendingCaptures.length)} emoji="📸" />
          <KpiCard label="Capturas aprovadas" value={String(approvedCaptures.length)} emoji="✅" />
          <KpiCard label="Capturas reprovadas" value={String(rejectedCaptures.length)} emoji="❌" />
        </div>

        <div style={styles.mainGrid}>
          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Checklist operacional</h3>
              <p style={styles.sectionSub}>
                Acompanhe o que já está pronto antes de publicar ou iniciar.
              </p>
            </div>

            <div style={styles.checkList}>
              {readinessItems.map((item) => (
                <div key={item.label} style={styles.checkItem}>
                  <div style={item.done ? styles.checkDotDone : styles.checkDotPending} />
                  <div>
                    <p style={styles.checkTitle}>{item.label}</p>
                    <p style={styles.checkHelp}>{item.help}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={styles.readinessBox}>
              <p style={styles.readinessTitle}>Progresso de configuração</p>
              <p style={styles.readinessValue}>
                {readyCount}/{readinessItems.length} etapas concluídas
              </p>
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Ações rápidas</h3>
              <p style={styles.sectionSub}>
                Operação principal do torneio em um único lugar.
              </p>
            </div>

            <div style={styles.actionsGrid}>
              <Link href={`/seller/tournaments/${tournamentId}/map`} style={styles.quickLink}>
                🗺️ Configurar perímetro
              </Link>

              <Link href={`/seller/tournaments/${tournamentId}/captures`} style={styles.quickLink}>
                📸 Validar capturas
              </Link>

              <Link href={`/seller/tournaments/${tournamentId}/ranking`} style={styles.quickLink}>
                🥇 Abrir ranking
              </Link>

              <Link href={`/seller/tournaments/${tournamentId}/teams`} style={styles.quickLink}>
                👥 Ver equipes
              </Link>

              <Link href={`/seller/tournaments/${tournamentId}/edit`} style={styles.quickLinkSoft}>
                ✏️ Editar dados
              </Link>

              <Link href="/seller/tournaments" style={styles.quickLinkSoft}>
                🏆 Lista de torneios
              </Link>
            </div>
          </section>
        </div>

        <div style={styles.mainGrid}>
          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Resumo técnico</h3>
            </div>

            <div style={styles.infoGrid}>
              <InfoCard label="Status" value={statusMeta.label} />
              <InfoCard
                label="Perímetro"
                value={
                  tournament?.boundaryEnabled
                    ? boundaryConfigured
                      ? "Ativo e configurado"
                      : "Ativo, mas pendente"
                    : "Desativado"
                }
              />
              <InfoCard label="Criado em" value={formatDateTime(createdAt)} />
              <InfoCard label="Publicado em" value={formatDateTime(publishedAt)} />
              <InfoCard label="Iniciado em" value={formatDateTime(startedAt)} />
              <InfoCard label="Encerrado em" value={formatDateTime(finishedAt)} />
              <InfoCard label="Última atualização" value={formatDateTime(updatedAt)} />
              <InfoCard
                label="Inscrição"
                value={tournament?.registrationUrl ? "Link configurado" : "Não informado"}
              />
              <InfoCard
                label="Admin URL"
                value={tournament?.adminUrl ? "Link configurado" : "Não informado"}
              />
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Últimas capturas pendentes</h3>
              <p style={styles.sectionSub}>
                Fila rápida para acompanhar o que precisa de validação.
              </p>
            </div>

            {pendingCaptures.length === 0 ? (
              <p style={styles.muted}>Nenhuma captura pendente no momento.</p>
            ) : (
              <div style={styles.pendingList}>
                {pendingCaptures.slice(0, 5).map((capture) => (
                  <div key={capture.id} style={styles.pendingRow}>
                    <div>
                      <p style={styles.pendingTitle}>{capture.teamName}</p>
                      <p style={styles.pendingMeta}>
                        {capture.species} • {capture.declaredLengthCm} cm •{" "}
                        {formatDateTime(capture.submittedAt)}
                      </p>
                      <p style={styles.pendingMeta}>
                        Geofence: {formatBoundaryValue(capture.insideBoundary)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function KpiCard({
  label,
  value,
  emoji,
}: {
  label: string;
  value: string;
  emoji: string;
}) {
  return (
    <div style={styles.kpiCard}>
      <div style={styles.kpiTop}>
        <span style={styles.kpiEmoji}>{emoji}</span>
        <span style={styles.kpiLabel}>{label}</span>
      </div>
      <p style={styles.kpiValue}>{value}</p>
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.miniKpiCard}>
      <p style={styles.miniKpiLabel}>{label}</p>
      <p style={styles.miniKpiValue}>{value}</p>
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

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#F8FAFC",
    padding: 24,
  },
  container: {
    maxWidth: 1400,
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
  headerActions: {
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
    margin: "8px 0 0 0",
    color: "#64748B",
    fontSize: 15,
    fontWeight: 600,
    lineHeight: 1.6,
    maxWidth: 780,
  },
  muted: {
    margin: 0,
    color: "#64748B",
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.6,
  },
  heroCard: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 22,
    padding: 22,
    boxShadow: "0 10px 24px rgba(15,23,42,0.04)",
  },
  heroTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },
  heroTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 1000,
    color: "#0F172A",
  },
  heroSubtitle: {
    margin: "6px 0 0 0",
    color: "#64748B",
    fontSize: 14,
    fontWeight: 700,
  },
  heroLocation: {
    margin: "8px 0 0 0",
    color: "#475569",
    fontSize: 14,
    fontWeight: 800,
  },
  heroBadges: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  heroBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 900,
  },
  heroBadgeBlue: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#EAF2F7",
    color: "#0B3C5D",
    fontSize: 13,
    fontWeight: 900,
  },
  heroBadgeGreen: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#DCFCE7",
    color: "#166534",
    fontSize: 13,
    fontWeight: 900,
  },
  heroBadgeGray: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#E5E7EB",
    color: "#374151",
    fontSize: 13,
    fontWeight: 900,
  },
  heroMetaGrid: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
  },
  miniKpiCard: {
    background: "#F8FAFC",
    border: "1px solid rgba(15,23,42,0.06)",
    borderRadius: 14,
    padding: 14,
  },
  miniKpiLabel: {
    margin: 0,
    fontSize: 12,
    fontWeight: 800,
    color: "#64748B",
  },
  miniKpiValue: {
    margin: "6px 0 0 0",
    fontSize: 14,
    fontWeight: 900,
    color: "#0F172A",
    lineHeight: 1.5,
  },
  description: {
    margin: "16px 0 0 0",
    color: "#475569",
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.7,
  },
  errorCard: {
    background: "#FFFFFF",
    border: "1px solid rgba(239,68,68,0.18)",
    borderRadius: 20,
    padding: 18,
  },
  errorTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: "#991B1B",
  },
  errorText: {
    margin: "8px 0 0 0",
    color: "#B91C1C",
    fontWeight: 700,
  },
  successCard: {
    background: "#FFFFFF",
    border: "1px solid rgba(34,197,94,0.18)",
    borderRadius: 20,
    padding: 16,
  },
  successText: {
    margin: 0,
    color: "#166534",
    fontWeight: 800,
  },
  helperWarning: {
    margin: "12px 0 0 0",
    color: "#92400E",
    fontSize: 13,
    fontWeight: 700,
  },
  statusActionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 10,
  },
  statusActionButton: {
    border: "none",
    borderRadius: 14,
    padding: "14px 16px",
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
  },
  publishButton: {
    background: "#0B3C5D",
  },
  startButton: {
    background: "#166534",
  },
  finishButton: {
    background: "#B91C1C",
  },
  draftButton: {
    background: "#475569",
  },
  buttonDisabled: {
    opacity: 0.55,
    cursor: "not-allowed",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  kpiCard: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 10px 24px rgba(15,23,42,0.04)",
  },
  kpiTop: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  kpiEmoji: {
    fontSize: 18,
  },
  kpiLabel: {
    fontSize: 13,
    fontWeight: 900,
    color: "#64748B",
  },
  kpiValue: {
    margin: "10px 0 0 0",
    fontSize: 28,
    fontWeight: 1000,
    color: "#0F172A",
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
    gap: 16,
  },
  card: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 20,
    padding: 20,
    boxShadow: "0 10px 24px rgba(15,23,42,0.04)",
    minWidth: 0,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: "#0F172A",
  },
  sectionSub: {
    margin: "6px 0 0 0",
    color: "#64748B",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.6,
  },
  checkList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  checkItem: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
  },
  checkDotDone: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "#16A34A",
    marginTop: 4,
    flexShrink: 0,
  },
  checkDotPending: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "#CBD5E1",
    marginTop: 4,
    flexShrink: 0,
  },
  checkTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 900,
    color: "#0F172A",
  },
  checkHelp: {
    margin: "4px 0 0 0",
    fontSize: 13,
    fontWeight: 700,
    color: "#64748B",
    lineHeight: 1.5,
  },
  readinessBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    background: "#F8FAFC",
  },
  readinessTitle: {
    margin: 0,
    fontSize: 12,
    fontWeight: 800,
    color: "#64748B",
  },
  readinessValue: {
    margin: "6px 0 0 0",
    fontSize: 18,
    fontWeight: 1000,
    color: "#0F172A",
  },
  actionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 10,
  },
  quickLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    padding: "13px 14px",
    borderRadius: 14,
    background: "#0B3C5D",
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: 900,
  },
  quickLinkSoft: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    padding: "13px 14px",
    borderRadius: 14,
    background: "#F8FAFC",
    color: "#0F172A",
    border: "1px solid rgba(15,23,42,0.08)",
    fontSize: 14,
    fontWeight: 900,
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },
  infoCard: {
    background: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
  },
  infoLabel: {
    margin: 0,
    color: "#64748B",
    fontSize: 12,
    fontWeight: 800,
  },
  infoValue: {
    margin: "6px 0 0 0",
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 900,
    lineHeight: 1.5,
  },
  pendingList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  pendingRow: {
    padding: 14,
    borderRadius: 14,
    background: "#F8FAFC",
    border: "1px solid rgba(15,23,42,0.06)",
  },
  pendingTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 900,
    color: "#0F172A",
  },
  pendingMeta: {
    margin: "6px 0 0 0",
    fontSize: 13,
    fontWeight: 700,
    color: "#64748B",
    lineHeight: 1.5,
  },
  primaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    border: "none",
    borderRadius: 12,
    padding: "12px 16px",
    background: "#0B3C5D",
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: 800,
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
};