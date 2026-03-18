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
  getDocs,
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
  status?: string;
  species?: string;
};

type RegistrationStatus = "pending" | "confirmed" | "cancelled";
type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

type TeamMember = {
  userId: string | null;
  name: string;
};

type TournamentTeam = {
  id: string;
  tournamentId: string;
  teamName: string;
  captainId: string | null;
  captainName: string;
  members: TeamMember[];
  registrationStatus: RegistrationStatus;
  paymentStatus: PaymentStatus;
  createdAt: string | null;
};

type TeamFilter = "all" | RegistrationStatus;

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

function normalizeRegistrationStatus(value: unknown): RegistrationStatus {
  const raw = String(value ?? "pending").toLowerCase();

  if (raw === "confirmed" || raw === "cancelled") return raw;
  return "pending";
}

function normalizePaymentStatus(value: unknown): PaymentStatus {
  const raw = String(value ?? "pending").toLowerCase();

  if (raw === "paid" || raw === "failed" || raw === "refunded") return raw;
  return "pending";
}

function normalizeMembers(value: unknown): TeamMember[] {
  if (!Array.isArray(value)) return [];

  return value.map((item) => {
    if (!item || typeof item !== "object") {
      return {
        userId: null,
        name: "Membro",
      };
    }

    const raw = item as Record<string, unknown>;

    return {
      userId: raw.userId ? String(raw.userId) : null,
      name: raw.name ? String(raw.name) : "Membro",
    };
  });
}

function mapTeamDoc(
  id: string,
  raw: Record<string, unknown>,
  tournamentId: string
): TournamentTeam {
  return {
    id,
    tournamentId,
    teamName: raw.teamName ? String(raw.teamName) : "Equipe sem nome",
    captainId: raw.captainId ? String(raw.captainId) : null,
    captainName: raw.captainName ? String(raw.captainName) : "Capitão não informado",
    members: normalizeMembers(raw.members),
    registrationStatus: normalizeRegistrationStatus(raw.registrationStatus),
    paymentStatus: normalizePaymentStatus(raw.paymentStatus),
    createdAt: toIsoStringSafe(raw.createdAt),
  };
}

function getTournamentStatusLabel(status: string) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "live") return "Ao vivo";
  if (normalized === "finished") return "Finalizado";
  if (normalized === "draft") return "Rascunho";
  return "Agendado";
}

function getTournamentStatusBadge(status: string): CSSProperties {
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

export default function TournamentTeamsClient({ tournamentId }: Props) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [tournamentTitle, setTournamentTitle] = useState("Torneio");
  const [tournamentLocation, setTournamentLocation] = useState("Local não definido");
  const [tournamentStatus, setTournamentStatus] = useState("scheduled");
  const [tournamentSpecies, setTournamentSpecies] = useState("Espécie não definida");

  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [filter, setFilter] = useState<TeamFilter>("all");

  const [registrationStatus, setRegistrationStatus] =
    useState<RegistrationStatus>("pending");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("pending");

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) || null,
    [teams, selectedTeamId]
  );

  const filteredTeams = useMemo(() => {
    if (filter === "all") return teams;
    return teams.filter((team) => team.registrationStatus === filter);
  }, [teams, filter]);

  const stats = useMemo(() => {
    return {
      total: teams.length,
      pending: teams.filter((team) => team.registrationStatus === "pending").length,
      confirmed: teams.filter((team) => team.registrationStatus === "confirmed").length,
      cancelled: teams.filter((team) => team.registrationStatus === "cancelled").length,
      paid: teams.filter((team) => team.paymentStatus === "paid").length,
    };
  }, [teams]);

  useEffect(() => {
    void loadPage();
  }, [tournamentId]);

  useEffect(() => {
    if (!selectedTeam) return;

    setRegistrationStatus(selectedTeam.registrationStatus);
    setPaymentStatus(selectedTeam.paymentStatus);
  }, [selectedTeam]);

  async function loadPage() {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      if (!tournamentId?.trim()) {
        setError("ID do torneio inválido.");
        return;
      }

      await Promise.all([loadTournament(), loadTeams()]);
    } catch (err) {
      console.error("Erro ao carregar equipes:", err);
      setError("Não foi possível carregar as equipes do torneio.");
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
    setTournamentStatus(data.status || "scheduled");
    setTournamentSpecies(data.species || "Espécie não definida");
  }

  async function loadTeams() {
    const teamsRef = collection(db, "tournamentTeams");
    const teamsQuery = query(
      teamsRef,
      where("tournamentId", "==", tournamentId),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(teamsQuery);

    const items = snapshot.docs.map((item) =>
      mapTeamDoc(item.id, item.data() as Record<string, unknown>, tournamentId)
    );

    setTeams(items);

    setSelectedTeamId((prev) => {
      if (prev && items.some((item) => item.id === prev)) return prev;
      return items[0]?.id || null;
    });
  }

  async function handleSaveStatuses() {
    if (!selectedTeam) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const ref = doc(db, "tournamentTeams", selectedTeam.id);

      await updateDoc(ref, {
        registrationStatus,
        paymentStatus,
        updatedAt: serverTimestamp(),
      });

      setMessage("Status da equipe atualizados com sucesso.");
      await loadTeams();
    } catch (err) {
      console.error("Erro ao atualizar equipe:", err);
      setError("Não foi possível atualizar os status da equipe.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <div style={styles.card}>
            <h1 style={styles.title}>Equipes e inscrições</h1>
            <p style={styles.muted}>Carregando equipes do torneio...</p>
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
            <h1 style={styles.title}>Equipes e inscrições</h1>
            <p style={styles.subtitle}>
              Painel para acompanhar equipes, capitães, membros e situação da inscrição.
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
              <span style={styles.badgeGreen}>Equipes</span>
              <span style={getTournamentStatusBadge(tournamentStatus)}>
                {getTournamentStatusLabel(tournamentStatus)}
              </span>
            </div>
          </div>

          <div style={styles.statsGrid}>
            <StatCard label="Espécie" value={tournamentSpecies} />
            <StatCard label="Total equipes" value={String(stats.total)} />
            <StatCard label="Pendentes" value={String(stats.pending)} />
            <StatCard label="Confirmadas" value={String(stats.confirmed)} />
            <StatCard label="Canceladas" value={String(stats.cancelled)} />
            <StatCard label="Pagas" value={String(stats.paid)} />
          </div>
        </div>

        <div style={styles.filtersRow}>
          <FilterButton
            active={filter === "all"}
            label="Todas"
            onClick={() => setFilter("all")}
          />
          <FilterButton
            active={filter === "pending"}
            label="Pendentes"
            onClick={() => setFilter("pending")}
          />
          <FilterButton
            active={filter === "confirmed"}
            label="Confirmadas"
            onClick={() => setFilter("confirmed")}
          />
          <FilterButton
            active={filter === "cancelled"}
            label="Canceladas"
            onClick={() => setFilter("cancelled")}
          />
        </div>

        <div style={styles.grid}>
          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Lista de equipes</h3>
              <p style={styles.sectionSubtitle}>
                Selecione uma equipe para visualizar e ajustar os status.
              </p>
            </div>

            {filteredTeams.length === 0 ? (
              <div style={styles.emptyWrap}>
                <div style={styles.emptyEmoji}>👥</div>
                <p style={styles.muted}>Nenhuma equipe encontrada neste filtro.</p>
              </div>
            ) : (
              <div style={styles.teamList}>
                {filteredTeams.map((team) => {
                  const isActive = team.id === selectedTeamId;

                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => setSelectedTeamId(team.id)}
                      style={{
                        ...styles.teamRowButton,
                        ...(isActive ? styles.teamRowButtonActive : {}),
                      }}
                    >
                      <div style={styles.teamRowTop}>
                        <strong style={styles.teamName}>{team.teamName}</strong>

                        <div style={styles.teamBadges}>
                          <span style={getRegistrationBadgeStyle(team.registrationStatus)}>
                            {getRegistrationLabel(team.registrationStatus)}
                          </span>
                          <span style={getPaymentBadgeStyle(team.paymentStatus)}>
                            {getPaymentLabel(team.paymentStatus)}
                          </span>
                        </div>
                      </div>

                      <div style={styles.teamMetaGrid}>
                        <MiniInfo label="Capitão" value={team.captainName} />
                        <MiniInfo label="Membros" value={String(team.members.length)} />
                        <MiniInfo label="Criada em" value={formatDateTime(team.createdAt)} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Detalhe da equipe</h3>
              <p style={styles.sectionSubtitle}>
                Visualize integrantes e ajuste a situação operacional.
              </p>
            </div>

            {!selectedTeam ? (
              <p style={styles.muted}>Selecione uma equipe para visualizar.</p>
            ) : (
              <div style={styles.detailWrap}>
                <div style={styles.infoGrid}>
                  <InfoCard label="Equipe" value={selectedTeam.teamName} />
                  <InfoCard label="Capitão" value={selectedTeam.captainName} />
                  <InfoCard
                    label="Inscrição"
                    value={getRegistrationLabel(selectedTeam.registrationStatus)}
                  />
                  <InfoCard
                    label="Pagamento"
                    value={getPaymentLabel(selectedTeam.paymentStatus)}
                  />
                </div>

                <div style={styles.membersBox}>
                  <p style={styles.membersTitle}>Membros da equipe</p>

                  {selectedTeam.members.length === 0 ? (
                    <p style={styles.muted}>Nenhum membro informado.</p>
                  ) : (
                    <div style={styles.membersList}>
                      {selectedTeam.members.map((member, index) => (
                        <div key={`${member.userId}-${index}`} style={styles.memberRow}>
                          <span style={styles.memberDot} />
                          <span style={styles.memberName}>{member.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={styles.formGrid}>
                  <Field label="Status da inscrição">
                    <select
                      value={registrationStatus}
                      onChange={(e) =>
                        setRegistrationStatus(e.target.value as RegistrationStatus)
                      }
                      style={styles.input}
                    >
                      <option value="pending">Pendente</option>
                      <option value="confirmed">Confirmada</option>
                      <option value="cancelled">Cancelada</option>
                    </select>
                  </Field>

                  <Field label="Status do pagamento">
                    <select
                      value={paymentStatus}
                      onChange={(e) =>
                        setPaymentStatus(e.target.value as PaymentStatus)
                      }
                      style={styles.input}
                    >
                      <option value="pending">Pendente</option>
                      <option value="paid">Pago</option>
                      <option value="failed">Falhou</option>
                      <option value="refunded">Reembolsado</option>
                    </select>
                  </Field>
                </div>

                <div style={styles.actionsRow}>
                  <button
                    type="button"
                    onClick={handleSaveStatuses}
                    disabled={saving}
                    style={styles.primaryButton}
                  >
                    {saving ? "Salvando..." : "Salvar status"}
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

function getRegistrationLabel(status: RegistrationStatus) {
  switch (status) {
    case "confirmed":
      return "Confirmada";
    case "cancelled":
      return "Cancelada";
    case "pending":
    default:
      return "Pendente";
  }
}

function getPaymentLabel(status: PaymentStatus) {
  switch (status) {
    case "paid":
      return "Pago";
    case "failed":
      return "Falhou";
    case "refunded":
      return "Reembolsado";
    case "pending":
    default:
      return "Pendente";
  }
}

function getRegistrationBadgeStyle(status: RegistrationStatus): CSSProperties {
  if (status === "confirmed") {
    return {
      ...styles.statusBadge,
      background: "#DCFCE7",
      color: "#166534",
    };
  }

  if (status === "cancelled") {
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

function getPaymentBadgeStyle(status: PaymentStatus): CSSProperties {
  if (status === "paid") {
    return {
      ...styles.statusBadge,
      background: "#DCFCE7",
      color: "#166534",
    };
  }

  if (status === "failed") {
    return {
      ...styles.statusBadge,
      background: "#FEE2E2",
      color: "#B91C1C",
    };
  }

  if (status === "refunded") {
    return {
      ...styles.statusBadge,
      background: "#E5E7EB",
      color: "#374151",
    };
  }

  return {
    ...styles.statusBadge,
    background: "#DBEAFE",
    color: "#1D4ED8",
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
    justifyContent: "center",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
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
  filtersRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  filterButton: {
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 999,
    padding: "10px 14px",
    background: "#FFFFFF",
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  },
  filterButtonActive: {
    background: "#0B3C5D",
    color: "#FFFFFF",
    border: "1px solid #0B3C5D",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "420px minmax(0, 1fr)",
    gap: 16,
  },
  card: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 20,
    padding: 20,
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
  sectionSubtitle: {
    margin: "8px 0 0 0",
    color: "#64748B",
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.6,
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
  teamList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  teamRowButton: {
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 16,
    background: "#FFFFFF",
    padding: 14,
    textAlign: "left",
    cursor: "pointer",
  },
  teamRowButtonActive: {
    border: "1px solid #0B3C5D",
    background: "#FDFEFF",
    boxShadow: "0 0 0 3px rgba(11,60,93,0.06)",
  },
  teamRowTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  teamName: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: 900,
  },
  teamBadges: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  teamMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
  },
  miniInfoCard: {
    background: "#F8FAFC",
    borderRadius: 12,
    padding: 10,
  },
  miniInfoLabel: {
    margin: 0,
    color: "#64748B",
    fontSize: 11,
    fontWeight: 800,
  },
  miniInfoValue: {
    margin: "4px 0 0 0",
    color: "#0F172A",
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.4,
  },
  detailWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
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
  membersBox: {
    background: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
  },
  membersTitle: {
    margin: 0,
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 900,
    marginBottom: 12,
  },
  membersList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  memberRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  memberDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#0B3C5D",
  },
  memberName: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 700,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 12,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
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
  actionsRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
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
  successText: {
    margin: 0,
    color: "#166534",
    fontWeight: 700,
  },
  errorText: {
    margin: 0,
    color: "#B91C1C",
    fontWeight: 700,
  },
};