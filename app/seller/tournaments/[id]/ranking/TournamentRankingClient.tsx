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
  getDocs,
  doc,
  getDoc,
  orderBy,
  query,
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
  validFishCount?: number;
  species?: string;
  status?: string;
};

type TournamentCapture = {
  id: string;
  tournamentId: string;
  teamId: string | null;
  teamName: string;
  species: string;
  declaredLengthCm: number;
  approvedLengthCm: number | null;
  status: "pending" | "approved" | "rejected";
  submittedAt: string | null;
};

type RankingRow = {
  teamId: string;
  teamName: string;
  position: number;
  totalCm: number;
  bestFishCm: number;
  approvedFishCount: number;
  validFish: number[];
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
  const status =
    statusRaw === "approved" || statusRaw === "rejected"
      ? statusRaw
      : "pending";

  return {
    id,
    tournamentId,
    teamId: raw.teamId ? String(raw.teamId) : null,
    teamName: raw.teamName ? String(raw.teamName) : "Equipe não identificada",
    species: raw.species ? String(raw.species) : "Espécie não informada",
    declaredLengthCm: Number(raw.declaredLengthCm ?? raw.lengthCm ?? 0) || 0,
    approvedLengthCm:
      raw.approvedLengthCm !== undefined && raw.approvedLengthCm !== null
        ? Number(raw.approvedLengthCm)
        : null,
    status,
    submittedAt: toIsoStringSafe(raw.submittedAt),
  };
}

function buildRanking(
  captures: TournamentCapture[],
  validFishCount: number
): RankingRow[] {
  const approvedCaptures = captures.filter(
    (item) => item.status === "approved" && (item.approvedLengthCm ?? 0) > 0
  );

  const grouped = new Map<
    string,
    {
      teamId: string;
      teamName: string;
      fish: number[];
    }
  >();

  for (const capture of approvedCaptures) {
    const teamId = capture.teamId || `team:${capture.teamName}`;
    const existing = grouped.get(teamId) || {
      teamId,
      teamName: capture.teamName,
      fish: [],
    };

    existing.fish.push(Number(capture.approvedLengthCm || 0));
    grouped.set(teamId, existing);
  }

  const rows: RankingRow[] = Array.from(grouped.values()).map((group) => {
    const orderedFish = [...group.fish].sort((a, b) => b - a);
    const validFish = orderedFish.slice(0, validFishCount);
    const totalCm = validFish.reduce((sum, value) => sum + value, 0);
    const bestFishCm = validFish[0] || 0;

    return {
      teamId: group.teamId,
      teamName: group.teamName,
      position: 0,
      totalCm,
      bestFishCm,
      approvedFishCount: validFish.length,
      validFish,
    };
  });

  rows.sort((a, b) => {
    if (b.totalCm !== a.totalCm) return b.totalCm - a.totalCm;
    if (b.bestFishCm !== a.bestFishCm) return b.bestFishCm - a.bestFishCm;
    return a.teamName.localeCompare(b.teamName, "pt-BR");
  });

  return rows.map((row, index) => ({
    ...row,
    position: index + 1,
  }));
}

function getStatusLabel(status: string) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "live") return "Ao vivo";
  if (normalized === "finished") return "Finalizado";
  if (normalized === "draft") return "Rascunho";
  return "Agendado";
}

function getStatusBadge(status: string): CSSProperties {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "live") {
    return {
      ...styles.statusBadge,
      background: "#DCFCE7",
      color: "#166534",
    };
  }

  if (normalized === "finished") {
    return {
      ...styles.statusBadge,
      background: "#E5E7EB",
      color: "#374151",
    };
  }

  if (normalized === "draft") {
    return {
      ...styles.statusBadge,
      background: "#DBEAFE",
      color: "#1D4ED8",
    };
  }

  return {
    ...styles.statusBadge,
    background: "#FEF3C7",
    color: "#92400E",
  };
}

export default function TournamentRankingClient({ tournamentId }: Props) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [tournamentTitle, setTournamentTitle] = useState("Torneio");
  const [tournamentLocation, setTournamentLocation] = useState("Local não definido");
  const [validFishCount, setValidFishCount] = useState(3);
  const [species, setSpecies] = useState("Espécie não definida");
  const [status, setStatus] = useState("scheduled");

  const [captures, setCaptures] = useState<TournamentCapture[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const ranking = useMemo(
    () => buildRanking(captures, validFishCount),
    [captures, validFishCount]
  );

  const approvedCount = useMemo(
    () => captures.filter((item) => item.status === "approved").length,
    [captures]
  );

  const pendingCount = useMemo(
    () => captures.filter((item) => item.status === "pending").length,
    [captures]
  );

  const rejectedCount = useMemo(
    () => captures.filter((item) => item.status === "rejected").length,
    [captures]
  );

  const podium = ranking.slice(0, 3);

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

      await Promise.all([loadTournament(), loadCaptures()]);
      setLastUpdate(new Date().toISOString());
    } catch (err) {
      console.error("Erro ao carregar ranking:", err);
      setError("Não foi possível carregar o ranking do torneio.");
    } finally {
      setLoading(false);
    }
  }

  async function loadTournament() {
    const ref = doc(db, "tournaments", tournamentId);
    const snap = await getDoc(ref);

    if (!snap.exists()) return;

    const data = snap.data() as TournamentDoc;

    setTournamentTitle(data.title || "Torneio");
    setTournamentLocation(data.location || "Local não definido");
    setValidFishCount(Number(data.validFishCount ?? 3) || 3);
    setSpecies(data.species || "Espécie não definida");
    setStatus(data.status || "scheduled");
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
      mapCaptureDoc(item.id, item.data() as Record<string, unknown>, tournamentId)
    );

    setCaptures(items);
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <div style={styles.card}>
            <h1 style={styles.title}>Ranking oficial</h1>
            <p style={styles.muted}>Carregando classificação do torneio...</p>
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
            <h1 style={styles.title}>Ranking oficial</h1>
            <p style={styles.subtitle}>
              Classificação do torneio considerando apenas capturas aprovadas pela
              organização.
            </p>
          </div>

          <div style={styles.headerActions}>
            <button
              type="button"
              onClick={() => void loadPage()}
              style={styles.primaryButton}
            >
              Atualizar ranking
            </button>

            <button
              type="button"
              onClick={() => router.push(`/seller/tournaments/${tournamentId}`)}
              style={styles.secondaryButton}
            >
              Voltar ao torneio
            </button>
          </div>
        </div>

        <div style={styles.heroCard}>
          <div style={styles.heroTop}>
            <div>
              <h2 style={styles.heroTitle}>{tournamentTitle}</h2>
              <p style={styles.heroLocation}>{tournamentLocation}</p>
            </div>

            <div style={styles.badgesWrap}>
              <span style={styles.badgeBlue}>🏆 {tournamentId}</span>
              <span style={styles.badgeGreen}>Ranking oficial</span>
              <span style={getStatusBadge(status)}>{getStatusLabel(status)}</span>
            </div>
          </div>

          <div style={styles.statsGrid}>
            <StatCard label="Espécie" value={species} />
            <StatCard label="Peixes válidos" value={`${validFishCount} maiores`} />
            <StatCard label="Aprovadas" value={String(approvedCount)} />
            <StatCard label="Pendentes" value={String(pendingCount)} />
            <StatCard label="Reprovadas" value={String(rejectedCount)} />
            <StatCard label="Última atualização" value={formatDateTime(lastUpdate)} />
          </div>
        </div>

        {error ? (
          <div style={styles.card}>
            <p style={styles.errorText}>{error}</p>
          </div>
        ) : null}

        {podium.length > 0 ? (
          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Pódio atual</h3>
              <p style={styles.sectionSubtitle}>
                As três melhores equipes no momento com base no critério oficial.
              </p>
            </div>

            <div style={styles.podiumGrid}>
              {podium.map((row) => (
                <div key={row.teamId} style={getPodiumCardStyle(row.position)}>
                  <div style={styles.podiumTop}>
                    <span style={styles.podiumPlace}>{row.position}º</span>
                    <span style={styles.podiumTotal}>{row.totalCm} cm</span>
                  </div>

                  <h4 style={styles.podiumTeam}>{row.teamName}</h4>

                  <p style={styles.podiumMeta}>
                    Maior peixe: {row.bestFishCm} cm
                  </p>
                  <p style={styles.podiumMeta}>
                    Parciais: {row.validFish.join(" + ")} cm
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>Classificação completa</h3>
            <p style={styles.sectionSubtitle}>
              Critério atual: soma dos {validFishCount} maiores peixes aprovados
              por equipe.
            </p>
          </div>

          {ranking.length === 0 ? (
            <div style={styles.emptyWrap}>
              <div style={styles.emptyEmoji}>🥇</div>
              <p style={styles.muted}>
                Ainda não há capturas aprovadas para montar o ranking.
              </p>
            </div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <Th>Posição</Th>
                    <Th>Equipe</Th>
                    <Th>Total</Th>
                    <Th>Maior peixe</Th>
                    <Th>Qtd. válida</Th>
                    <Th>Parciais</Th>
                  </tr>
                </thead>

                <tbody>
                  {ranking.map((row) => (
                    <tr key={row.teamId}>
                      <Td>
                        <span style={getPositionStyle(row.position)}>
                          {row.position}º
                        </span>
                      </Td>
                      <Td>{row.teamName}</Td>
                      <Td>{row.totalCm} cm</Td>
                      <Td>{row.bestFishCm} cm</Td>
                      <Td>{row.approvedFishCount}</Td>
                      <Td>{row.validFish.join(" + ")} cm</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
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

function Th({ children }: { children: ReactNode }) {
  return <th style={styles.th}>{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td style={styles.td}>{children}</td>;
}

function getPositionStyle(position: number): CSSProperties {
  if (position === 1) {
    return {
      ...styles.positionBadge,
      background: "#FEF3C7",
      color: "#92400E",
    };
  }

  if (position === 2) {
    return {
      ...styles.positionBadge,
      background: "#E5E7EB",
      color: "#374151",
    };
  }

  if (position === 3) {
    return {
      ...styles.positionBadge,
      background: "#FDE68A",
      color: "#78350F",
    };
  }

  return {
    ...styles.positionBadge,
    background: "#EAF2F7",
    color: "#0B3C5D",
  };
}

function getPodiumCardStyle(position: number): CSSProperties {
  if (position === 1) {
    return {
      ...styles.podiumCard,
      border: "1px solid rgba(146,64,14,0.18)",
      background: "linear-gradient(180deg, #FFF7D6 0%, #FFFFFF 100%)",
    };
  }

  if (position === 2) {
    return {
      ...styles.podiumCard,
      border: "1px solid rgba(55,65,81,0.16)",
      background: "linear-gradient(180deg, #F3F4F6 0%, #FFFFFF 100%)",
    };
  }

  return {
    ...styles.podiumCard,
    border: "1px solid rgba(120,53,15,0.18)",
    background: "linear-gradient(180deg, #FEF3C7 0%, #FFFFFF 100%)",
  };
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
    borderRadius: 20,
    padding: 20,
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
    fontSize: 22,
    fontWeight: 900,
    color: "#0F172A",
  },
  heroLocation: {
    margin: "8px 0 0 0",
    color: "#64748B",
    fontSize: 15,
    fontWeight: 700,
  },
  badgesWrap: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  badgeBlue: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#EAF2F7",
    color: "#0B3C5D",
    fontSize: 13,
    fontWeight: 800,
  },
  badgeGreen: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#DCFCE7",
    color: "#166534",
    fontSize: 13,
    fontWeight: 800,
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 800,
  },
  statsGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
  },
  statCard: {
    background: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
  },
  statLabel: {
    margin: 0,
    color: "#64748B",
    fontSize: 12,
    fontWeight: 800,
  },
  statValue: {
    margin: "6px 0 0 0",
    color: "#0F172A",
    fontSize: 18,
    fontWeight: 900,
    lineHeight: 1.4,
  },
  card: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 20,
    padding: 20,
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
  sectionSubtitle: {
    margin: "8px 0 0 0",
    color: "#64748B",
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.6,
  },
  podiumGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 12,
  },
  podiumCard: {
    borderRadius: 18,
    padding: 18,
  },
  podiumTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  podiumPlace: {
    fontSize: 14,
    fontWeight: 1000,
    color: "#0F172A",
  },
  podiumTotal: {
    fontSize: 18,
    fontWeight: 1000,
    color: "#0B3C5D",
  },
  podiumTeam: {
    margin: "12px 0 0 0",
    fontSize: 18,
    fontWeight: 1000,
    color: "#0F172A",
  },
  podiumMeta: {
    margin: "8px 0 0 0",
    fontSize: 13,
    fontWeight: 700,
    color: "#64748B",
    lineHeight: 1.5,
  },
  emptyWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 12px",
    textAlign: "center",
  },
  emptyEmoji: {
    fontSize: 32,
  },
  tableWrap: {
    width: "100%",
    overflowX: "auto",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 16,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    background: "#FFFFFF",
  },
  th: {
    textAlign: "left",
    padding: 14,
    fontSize: 13,
    color: "#64748B",
    fontWeight: 800,
    borderBottom: "1px solid rgba(15,23,42,0.08)",
    background: "#F8FAFC",
    whiteSpace: "nowrap",
  },
  td: {
    padding: 14,
    fontSize: 14,
    color: "#0F172A",
    fontWeight: 700,
    borderBottom: "1px solid rgba(15,23,42,0.06)",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },
  positionBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 46,
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 900,
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
  errorText: {
    margin: 0,
    color: "#B91C1C",
    fontWeight: 700,
  },
};