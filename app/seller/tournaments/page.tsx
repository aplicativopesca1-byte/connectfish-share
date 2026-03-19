"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../../../src/lib/firebase";

type TournamentStatus = "draft" | "scheduled" | "live" | "finished" | string;
type TournamentVisibility = "draft" | "published" | string;

type Tournament = {
  id: string;
  title: string;
  subtitle?: string | null;
  location: string;
  species: string;
  status: TournamentStatus;
  visibility: TournamentVisibility;
  minSizeCm?: number;
  validFishCount?: number;
  setupStep: number;
  basicsCompleted: boolean;
  boundaryCompleted: boolean;
  publishReady: boolean;
  missingFields: string[];
};

function normalizeStatus(status: unknown): TournamentStatus {
  const value = String(status ?? "").toLowerCase();

  if (["draft", "rascunho"].includes(value)) return "draft";
  if (["scheduled", "agendado", "published"].includes(value)) return "scheduled";
  if (["live", "ativo", "active", "in_progress"].includes(value)) return "live";
  if (["finished", "encerrado", "ended", "closed"].includes(value)) return "finished";

  return value || "draft";
}

function normalizeVisibility(value: unknown): TournamentVisibility {
  const normalized = String(value ?? "").toLowerCase();

  if (["published", "publicado", "public"].includes(normalized)) {
    return "published";
  }

  return "draft";
}

function getStatusMeta(status: TournamentStatus) {
  switch (status) {
    case "live":
      return {
        label: "Ao vivo",
        bg: "#DCFCE7",
        color: "#166534",
      };
    case "finished":
      return {
        label: "Finalizado",
        bg: "#E5E7EB",
        color: "#374151",
      };
    case "scheduled":
      return {
        label: "Publicado",
        bg: "#FEF3C7",
        color: "#92400E",
      };
    case "draft":
    default:
      return {
        label: "Rascunho",
        bg: "#DBEAFE",
        color: "#1D4ED8",
      };
  }
}

function getVisibilityMeta(visibility: TournamentVisibility) {
  if (visibility === "published") {
    return {
      label: "Visível ao público",
      bg: "#ECFDF5",
      color: "#166534",
    };
  }

  return {
    label: "Apenas criador vê",
    bg: "#EFF6FF",
    color: "#1D4ED8",
  };
}

function normalizeMissingFields(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function getSetupProgress(tournament: Tournament) {
  const steps = [
    tournament.basicsCompleted,
    tournament.boundaryCompleted,
    tournament.publishReady,
  ];

  return steps.filter(Boolean).length;
}

function getPrimaryAction(tournament: Tournament) {
  if (tournament.status === "live" || tournament.status === "finished") {
    return {
      label: "Abrir painel",
      href: `/seller/tournaments/${tournament.id}`,
    };
  }

  if (!tournament.basicsCompleted) {
    return {
      label: "Continuar configuração",
      href: `/seller/tournaments/${tournament.id}/edit?step=1`,
    };
  }

  if (!tournament.boundaryCompleted) {
    return {
      label: "Configurar perímetro",
      href: `/seller/tournaments/${tournament.id}/edit?step=2`,
    };
  }

  if (tournament.visibility !== "published" || !tournament.publishReady) {
    return {
      label: "Revisar e publicar",
      href: `/seller/tournaments/${tournament.id}/edit?step=3`,
    };
  }

  return {
    label: "Abrir painel",
    href: `/seller/tournaments/${tournament.id}`,
  };
}

function getProgressLabel(tournament: Tournament) {
  const completed = getSetupProgress(tournament);
  return `${completed}/3 etapas concluídas`;
}

export default function SellerTournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void loadTournaments();
  }, []);

  async function loadTournaments() {
    try {
      setLoading(true);
      setError(null);

      const tournamentsRef = collection(db, "tournaments");
      const tournamentsQuery = query(tournamentsRef, orderBy("createdAt", "desc"));
      const snap = await getDocs(tournamentsQuery);

      const data: Tournament[] = snap.docs.map((docSnap) => {
        const raw = docSnap.data() as Record<string, unknown>;

        const basicsCompleted =
          typeof raw.basicsCompleted === "boolean"
            ? raw.basicsCompleted
            : Boolean(
                String(raw.title ?? "").trim() &&
                  String(raw.location ?? "").trim() &&
                  String(raw.species ?? "").trim()
              );

        const boundaryCompleted =
          typeof raw.boundaryCompleted === "boolean"
            ? raw.boundaryCompleted
            : raw.boundaryEnabled === false;

        const publishReady =
          typeof raw.publishReady === "boolean" ? raw.publishReady : false;

        const status = normalizeStatus(raw.status);
        const visibility =
          raw.visibility !== undefined
            ? normalizeVisibility(raw.visibility)
            : status === "draft"
            ? "draft"
            : "published";

        const setupStep =
          typeof raw.setupStep === "number" && raw.setupStep >= 1 && raw.setupStep <= 3
            ? raw.setupStep
            : publishReady
            ? 3
            : boundaryCompleted
            ? 3
            : basicsCompleted
            ? 2
            : 1;

        const missingFields = normalizeMissingFields(raw.missingFields);

        return {
          id: docSnap.id,
          title: String(raw.title ?? raw.name ?? "Torneio"),
          subtitle: raw.subtitle ? String(raw.subtitle) : null,
          location: String(raw.location ?? raw.place ?? "Local não definido"),
          species: String(raw.species ?? raw.targetSpecies ?? "Espécie não definida"),
          status,
          visibility,
          minSizeCm: Number(raw.minSizeCm ?? raw.minimumSizeCm ?? 0) || 0,
          validFishCount: Number(raw.validFishCount ?? raw.scoreFishCount ?? 3) || 3,
          setupStep,
          basicsCompleted,
          boundaryCompleted,
          publishReady,
          missingFields,
        };
      });

      setTournaments(data);
    } catch (err) {
      console.error("Erro carregando torneios", err);
      setError("Não foi possível carregar os torneios.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteDraft(tournament: Tournament) {
    if (tournament.status !== "draft") return;

    const confirmed = window.confirm(
      `Tem certeza que deseja excluir o rascunho "${tournament.title}"?\n\nEssa ação é permanente.`
    );

    if (!confirmed) return;

    try {
      setDeletingId(tournament.id);
      setError(null);

      await deleteDoc(doc(db, "tournaments", tournament.id));

      setTournaments((current) =>
        current.filter((item) => item.id !== tournament.id)
      );
    } catch (err) {
      console.error("Erro ao excluir rascunho:", err);
      setError("Não foi possível excluir o rascunho.");
    } finally {
      setDeletingId(null);
    }
  }

  const stats = useMemo(() => {
    return {
      total: tournaments.length,
      draft: tournaments.filter((item) => item.status === "draft").length,
      scheduled: tournaments.filter((item) => item.status === "scheduled").length,
      live: tournaments.filter((item) => item.status === "live").length,
      finished: tournaments.filter((item) => item.status === "finished").length,
      public: tournaments.filter((item) => item.visibility === "published").length,
    };
  }, [tournaments]);

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <section style={styles.heroCard}>
            <h1 style={styles.title}>🏆 Torneios</h1>
            <p style={styles.subtitle}>
              Carregando central de torneios do ConnectFish...
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <section style={styles.heroCard}>
          <div style={styles.heroTop}>
            <div>
              <h1 style={styles.title}>🏆 Torneios</h1>
              <p style={styles.subtitle}>
                Crie, acompanhe e opere torneios com perímetro oficial, validação
                de capturas, ranking, inscrições, pagamentos e gestão de equipes.
              </p>
            </div>

            <Link href="/seller/tournaments/new" style={styles.primaryAction}>
              + Criar torneio
            </Link>
          </div>

          <div style={styles.statsGrid}>
            <StatCard label="Total" value={String(stats.total)} />
            <StatCard label="Rascunho" value={String(stats.draft)} />
            <StatCard label="Publicados" value={String(stats.scheduled)} />
            <StatCard label="Ao vivo" value={String(stats.live)} />
            <StatCard label="Finalizados" value={String(stats.finished)} />
            <StatCard label="Visíveis ao público" value={String(stats.public)} />
          </div>
        </section>

        {error ? (
          <section style={styles.errorCard}>
            <div style={styles.errorTitle}>Erro na central de torneios</div>
            <p style={styles.errorText}>{error}</p>

            <button
              type="button"
              onClick={() => void loadTournaments()}
              style={styles.retryBtn}
            >
              Tentar novamente
            </button>
          </section>
        ) : null}

        {!error && tournaments.length === 0 ? (
          <section style={styles.emptyCard}>
            <div style={styles.emptyEmoji}>🏆</div>
            <h2 style={styles.emptyTitle}>Nenhum torneio criado ainda</h2>
            <p style={styles.emptyText}>
              Crie o primeiro torneio para começar a configurar regras, perímetro,
              capturas, ranking, inscrições e operação completa.
            </p>

            <Link href="/seller/tournaments/new" style={styles.primaryAction}>
              Criar primeiro torneio
            </Link>
          </section>
        ) : null}

        {!error && tournaments.length > 0 ? (
          <section style={styles.grid}>
            {tournaments.map((tournament) => {
              const statusMeta = getStatusMeta(tournament.status);
              const visibilityMeta = getVisibilityMeta(tournament.visibility);
              const primaryAction = getPrimaryAction(tournament);
              const completedSteps = getSetupProgress(tournament);
              const isDraft = tournament.status === "draft";
              const isDeleting = deletingId === tournament.id;

              return (
                <article key={tournament.id} style={styles.card}>
                  <div style={styles.cardTop}>
                    <div style={styles.iconWrap}>🏆</div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={styles.cardTitle}>{tournament.title}</h3>

                      {tournament.subtitle ? (
                        <p style={styles.cardSubtitle}>{tournament.subtitle}</p>
                      ) : null}
                    </div>

                    <div style={styles.badgesColumn}>
                      <span
                        style={{
                          ...styles.statusBadge,
                          background: statusMeta.bg,
                          color: statusMeta.color,
                        }}
                      >
                        {statusMeta.label}
                      </span>

                      <span
                        style={{
                          ...styles.visibilityBadge,
                          background: visibilityMeta.bg,
                          color: visibilityMeta.color,
                        }}
                      >
                        {visibilityMeta.label}
                      </span>
                    </div>
                  </div>

                  <div style={styles.metaList}>
                    <div style={styles.metaRow}>
                      <span style={styles.metaIcon}>📍</span>
                      <span style={styles.metaText}>{tournament.location}</span>
                    </div>

                    <div style={styles.metaRow}>
                      <span style={styles.metaIcon}>🐟</span>
                      <span style={styles.metaText}>{tournament.species}</span>
                    </div>

                    <div style={styles.metaRow}>
                      <span style={styles.metaIcon}>📏</span>
                      <span style={styles.metaText}>
                        Mín. {tournament.minSizeCm || 0} cm •{" "}
                        {tournament.validFishCount || 0} peixes válidos
                      </span>
                    </div>
                  </div>

                  <div style={styles.progressCard}>
                    <div style={styles.progressHeader}>
                      <strong style={styles.progressTitle}>Configuração</strong>
                      <span style={styles.progressText}>
                        {getProgressLabel(tournament)}
                      </span>
                    </div>

                    <div style={styles.progressBarTrack}>
                      <div
                        style={{
                          ...styles.progressBarFill,
                          width: `${(completedSteps / 3) * 100}%`,
                        }}
                      />
                    </div>

                    <div style={styles.progressSteps}>
                      <StepBadge
                        label="1. Informações"
                        done={tournament.basicsCompleted}
                      />
                      <StepBadge
                        label="2. Perímetro"
                        done={tournament.boundaryCompleted}
                      />
                      <StepBadge
                        label="3. Publicação"
                        done={tournament.publishReady && tournament.visibility === "published"}
                      />
                    </div>
                  </div>

                  {tournament.missingFields.length > 0 ? (
                    <div style={styles.pendingCard}>
                      <p style={styles.pendingTitle}>Pendências</p>
                      <div style={styles.pendingList}>
                        {tournament.missingFields.slice(0, 4).map((item, index) => (
                          <span key={`${item}-${index}`} style={styles.pendingItem}>
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : tournament.visibility === "published" ? (
                    <div style={styles.readyCard}>
                      <p style={styles.readyTitle}>Torneio pronto e publicado</p>
                      <p style={styles.readyText}>
                        Já está visível para os usuários realizarem inscrições.
                      </p>
                    </div>
                  ) : (
                    <div style={styles.pendingCard}>
                      <p style={styles.pendingTitle}>Próximo passo</p>
                      <p style={styles.pendingText}>
                        Continue a configuração para deixar o torneio pronto para publicação.
                      </p>
                    </div>
                  )}

                  <div style={styles.cardActions}>
                    <Link href={primaryAction.href} style={styles.primarySmallBtn}>
                      {primaryAction.label}
                    </Link>

                    <Link
                      href={`/seller/tournaments/${tournament.id}/edit?step=1`}
                      style={styles.secondarySmallBtn}
                    >
                      Informações
                    </Link>

                    <Link
                      href={`/seller/tournaments/${tournament.id}/edit?step=2`}
                      style={styles.secondarySmallBtn}
                    >
                      Revisar perímetro
                    </Link>

                    <Link
                      href={`/seller/tournaments/${tournament.id}/map`}
                      style={styles.secondarySmallBtn}
                    >
                      Mapa
                    </Link>

                    <Link
                      href={`/seller/tournaments/${tournament.id}/ranking`}
                      style={styles.secondarySmallBtn}
                    >
                      Ranking oficial
                    </Link>

                    <Link
                      href={`/seller/tournaments/${tournament.id}/registrations`}
                      style={styles.secondarySmallBtn}
                    >
                      Inscrições e pagamentos
                    </Link>

                    <Link
                      href={`/seller/tournaments/${tournament.id}/teams`}
                      style={styles.secondarySmallBtn}
                    >
                      Equipes confirmadas
                    </Link>

                    {isDraft ? (
                      <button
                        type="button"
                        onClick={() => void handleDeleteDraft(tournament)}
                        disabled={isDeleting}
                        style={{
                          ...styles.dangerSmallBtn,
                          ...(isDeleting ? styles.disabledBtn : {}),
                        }}
                      >
                        {isDeleting ? "Excluindo..." : "Excluir rascunho"}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}
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

function StepBadge({
  label,
  done,
}: {
  label: string;
  done: boolean;
}) {
  return (
    <div
      style={{
        ...styles.stepBadge,
        ...(done ? styles.stepBadgeDone : styles.stepBadgePending),
      }}
    >
      <span style={styles.stepBadgeDot}>{done ? "✓" : "•"}</span>
      <span style={styles.stepBadgeText}>{label}</span>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100%",
  },

  container: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },

  heroCard: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 24,
    padding: 22,
    boxShadow: "0 12px 26px rgba(15,23,42,0.04)",
  },

  heroTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },

  title: {
    margin: 0,
    fontSize: 30,
    fontWeight: 1000,
    color: "#0B3C5D",
  },

  subtitle: {
    margin: "8px 0 0 0",
    maxWidth: 760,
    fontSize: 14,
    lineHeight: 1.7,
    fontWeight: 700,
    color: "#64748B",
  },

  primaryAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    padding: "12px 16px",
    borderRadius: 14,
    background: "#0B3C5D",
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  statsGrid: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 12,
  },

  statCard: {
    background: "#F8FAFC",
    border: "1px solid rgba(15,23,42,0.06)",
    borderRadius: 16,
    padding: 14,
  },

  statLabel: {
    margin: 0,
    fontSize: 12,
    fontWeight: 800,
    color: "#64748B",
  },

  statValue: {
    margin: "6px 0 0 0",
    fontSize: 22,
    fontWeight: 1000,
    color: "#0F172A",
  },

  errorCard: {
    background: "#FFFFFF",
    border: "1px solid rgba(239,68,68,0.18)",
    borderRadius: 24,
    padding: 22,
    boxShadow: "0 12px 26px rgba(15,23,42,0.04)",
  },

  errorTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 1000,
    color: "#991B1B",
  },

  errorText: {
    margin: "8px 0 0 0",
    fontSize: 14,
    lineHeight: 1.6,
    fontWeight: 700,
    color: "#7F1D1D",
  },

  retryBtn: {
    marginTop: 14,
    border: "none",
    borderRadius: 12,
    padding: "11px 14px",
    background: "#0B3C5D",
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },

  emptyCard: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 24,
    padding: 28,
    textAlign: "center",
    boxShadow: "0 12px 26px rgba(15,23,42,0.04)",
  },

  emptyEmoji: {
    fontSize: 42,
  },

  emptyTitle: {
    margin: "14px 0 0 0",
    fontSize: 22,
    fontWeight: 1000,
    color: "#0F172A",
  },

  emptyText: {
    margin: "10px auto 18px auto",
    maxWidth: 620,
    fontSize: 14,
    lineHeight: 1.7,
    fontWeight: 700,
    color: "#64748B",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
    gap: 16,
  },

  card: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 10px 24px rgba(15,23,42,0.04)",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  cardTop: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
  },

  badgesColumn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 8,
    flexShrink: 0,
  },

  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    background: "#EAF2F7",
    flexShrink: 0,
    fontSize: 20,
  },

  cardTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 1000,
    color: "#0F172A",
    lineHeight: 1.3,
  },

  cardSubtitle: {
    margin: "4px 0 0 0",
    fontSize: 12,
    fontWeight: 700,
    color: "#64748B",
    lineHeight: 1.5,
  },

  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 1000,
    whiteSpace: "nowrap",
  },

  visibilityBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 1000,
    whiteSpace: "nowrap",
  },

  metaList: {
    display: "grid",
    gap: 10,
  },

  metaRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  metaIcon: {
    width: 20,
    textAlign: "center",
    flexShrink: 0,
  },

  metaText: {
    fontSize: 13,
    fontWeight: 800,
    color: "#475569",
    lineHeight: 1.5,
  },

  progressCard: {
    background: "#F8FAFC",
    border: "1px solid rgba(15,23,42,0.06)",
    borderRadius: 16,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  progressTitle: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: 900,
  },

  progressText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: 800,
  },

  progressBarTrack: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    background: "#E2E8F0",
    overflow: "hidden",
  },

  progressBarFill: {
    height: "100%",
    borderRadius: 999,
    background: "#0B3C5D",
  },

  progressSteps: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  stepBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    padding: "7px 10px",
    width: "fit-content",
  },

  stepBadgeDone: {
    background: "#ECFDF5",
    color: "#166534",
  },

  stepBadgePending: {
    background: "#F1F5F9",
    color: "#475569",
  },

  stepBadgeDot: {
    fontSize: 12,
    fontWeight: 900,
  },

  stepBadgeText: {
    fontSize: 12,
    fontWeight: 900,
  },

  pendingCard: {
    background: "#FEFCE8",
    border: "1px solid #FDE68A",
    borderRadius: 16,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  pendingTitle: {
    margin: 0,
    fontSize: 13,
    fontWeight: 1000,
    color: "#92400E",
  },

  pendingText: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.6,
    fontWeight: 700,
    color: "#92400E",
  },

  pendingList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },

  pendingItem: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "6px 10px",
    background: "#FFFFFF",
    border: "1px solid #FDE68A",
    color: "#92400E",
    fontSize: 12,
    fontWeight: 900,
  },

  readyCard: {
    background: "#ECFDF5",
    border: "1px solid #A7F3D0",
    borderRadius: 16,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  readyTitle: {
    margin: 0,
    fontSize: 13,
    fontWeight: 1000,
    color: "#166534",
  },

  readyText: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.6,
    fontWeight: 700,
    color: "#166534",
  },

  cardActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: "auto",
  },

  primarySmallBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    padding: "11px 14px",
    borderRadius: 12,
    background: "#0B3C5D",
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: 900,
  },

  secondarySmallBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    padding: "11px 14px",
    borderRadius: 12,
    background: "#F8FAFC",
    color: "#0F172A",
    border: "1px solid rgba(15,23,42,0.08)",
    fontSize: 13,
    fontWeight: 900,
  },

  dangerSmallBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "11px 14px",
    borderRadius: 12,
    background: "#FEE2E2",
    color: "#B91C1C",
    border: "1px solid #FECACA",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },

  disabledBtn: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
};