"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../../../src/lib/firebase";

type TournamentStatus = "draft" | "scheduled" | "live" | "finished" | string;

type Tournament = {
  id: string;
  title: string;
  subtitle?: string | null;
  location: string;
  species: string;
  status: TournamentStatus;
  minSizeCm?: number;
  validFishCount?: number;
};

function normalizeStatus(status: unknown): TournamentStatus {
  const value = String(status ?? "").toLowerCase();

  if (["draft", "rascunho"].includes(value)) return "draft";
  if (["scheduled", "agendado", "published"].includes(value)) return "scheduled";
  if (["live", "ativo", "active", "in_progress"].includes(value)) return "live";
  if (["finished", "encerrado", "ended", "closed"].includes(value)) return "finished";

  return value || "draft";
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
        label: "Agendado",
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

export default function SellerTournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        return {
          id: docSnap.id,
          title: String(raw.title ?? raw.name ?? "Torneio"),
          subtitle: raw.subtitle ? String(raw.subtitle) : null,
          location: String(raw.location ?? raw.place ?? "Local não definido"),
          species: String(raw.species ?? raw.targetSpecies ?? "Espécie não definida"),
          status: normalizeStatus(raw.status),
          minSizeCm: Number(raw.minSizeCm ?? raw.minimumSizeCm ?? 0) || 0,
          validFishCount: Number(raw.validFishCount ?? raw.scoreFishCount ?? 3) || 3,
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

  const stats = useMemo(() => {
    return {
      total: tournaments.length,
      draft: tournaments.filter((item) => item.status === "draft").length,
      scheduled: tournaments.filter((item) => item.status === "scheduled").length,
      live: tournaments.filter((item) => item.status === "live").length,
      finished: tournaments.filter((item) => item.status === "finished").length,
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
            <StatCard label="Agendados" value={String(stats.scheduled)} />
            <StatCard label="Ao vivo" value={String(stats.live)} />
            <StatCard label="Finalizados" value={String(stats.finished)} />
          </div>
        </section>

        {error ? (
          <section style={styles.errorCard}>
            <div style={styles.errorTitle}>Erro ao carregar torneios</div>
            <p style={styles.errorText}>{error}</p>

            <button type="button" onClick={() => void loadTournaments()} style={styles.retryBtn}>
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

                    <span
                      style={{
                        ...styles.statusBadge,
                        background: statusMeta.bg,
                        color: statusMeta.color,
                      }}
                    >
                      {statusMeta.label}
                    </span>
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

                  <div style={styles.cardActions}>
                    <Link
                      href={`/seller/tournaments/${tournament.id}`}
                      style={styles.primarySmallBtn}
                    >
                      Abrir painel
                    </Link>

                    <Link
                      href={`/seller/tournaments/${tournament.id}/edit`}
                      style={styles.secondarySmallBtn}
                    >
                      Editar
                    </Link>

                    <Link
                      href={`/seller/tournaments/${tournament.id}/map`}
                      style={styles.secondarySmallBtn}
                    >
                      Mapa e perímetro
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
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
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
};