"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { AdminFisheryItem } from "./page";

type Props = {
  initialItems: AdminFisheryItem[];
};

export default function AdminFisheriesClient({ initialItems }: Props) {
  const [items, setItems] = useState<AdminFisheryItem[]>(initialItems);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingItems = useMemo(
    () => items.filter((item) => item.status === "pending_review"),
    [items]
  );

  async function updateStatus(fisheryId: string, status: "active" | "draft") {
    try {
      setLoadingId(fisheryId);
      setError(null);
      setMessage(null);

      const r = await fetch(`/api/admin/pesqueiros/${fisheryId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        throw new Error(data?.error || "Não foi possível atualizar o status.");
      }

      setItems((prev) => prev.filter((item) => item.id !== fisheryId));

      setMessage(
        status === "active"
          ? "Pesqueiro aprovado com sucesso."
          : "Pesqueiro devolvido para rascunho."
      );
    } catch (e: any) {
      setError(e?.message || "Ocorreu um erro ao atualizar o status.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div>
          <div style={styles.eyebrow}>Admin</div>
          <div style={styles.title}>Aprovação de pesqueiros</div>
          <div style={styles.sub}>
            Revise os cadastros enviados e aprove ou devolva para edição.
          </div>
        </div>

        <div style={styles.statPill}>Pendentes: {pendingItems.length}</div>
      </section>

      {message && <div style={styles.success}>{message}</div>}
      {error && <div style={styles.error}>{error}</div>}

      <section style={styles.section}>
        <div style={styles.sectionTitle}>Pendentes de análise</div>

        {pendingItems.length === 0 ? (
          <div style={styles.emptyBox}>
            Nenhum pesqueiro aguardando análise no momento.
          </div>
        ) : (
          <div style={styles.list}>
            {pendingItems.map((item) => (
              <FisheryCard
                key={item.id}
                item={item}
                loading={loadingId === item.id}
                onApprove={() => updateStatus(item.id, "active")}
                onSendBack={() => updateStatus(item.id, "draft")}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FisheryCard({
  item,
  loading,
  onApprove,
  onSendBack,
}: {
  item: AdminFisheryItem;
  loading: boolean;
  onApprove: () => void;
  onSendBack: () => void;
}) {
  return (
    <article style={styles.card}>
      <div style={styles.cardMedia}>
        {item.coverImage ? (
          <img src={item.coverImage} alt={item.name} style={styles.cover} />
        ) : (
          <div style={styles.noImage}>Sem capa</div>
        )}
      </div>

      <div style={styles.cardBody}>
        <div style={styles.cardTop}>
          <div>
            <div style={styles.cardTitle}>{item.name}</div>
            <div style={styles.cardSub}>
              {item.city}
              {item.state ? ` • ${item.state}` : ""}
            </div>
          </div>

          <span style={statusChip(item.status)}>{item.status}</span>
        </div>

        {item.address ? <div style={styles.infoLine}>📍 {item.address}</div> : null}
        {item.phone ? <div style={styles.infoLine}>📞 {item.phone}</div> : null}
        {item.whatsapp ? <div style={styles.infoLine}>💬 {item.whatsapp}</div> : null}
        {item.instagram ? <div style={styles.infoLine}>📸 {item.instagram}</div> : null}

        {item.fishTypes?.length ? (
          <div style={styles.tagsWrap}>
            {item.fishTypes.map((fish) => (
              <span key={fish} style={styles.tag}>
                {fish}
              </span>
            ))}
          </div>
        ) : null}

        {item.description ? (
          <div style={styles.description}>{item.description}</div>
        ) : null}

        <div style={styles.actions}>
          <button
            type="button"
            onClick={onApprove}
            disabled={loading}
            style={{
              ...styles.primaryBtn,
              ...(loading ? styles.btnDisabled : {}),
            }}
          >
            {loading ? "Salvando..." : "Aprovar"}
          </button>

          <button
            type="button"
            onClick={onSendBack}
            disabled={loading}
            style={{
              ...styles.secondaryBtn,
              ...(loading ? styles.btnDisabled : {}),
            }}
          >
            {loading ? "Salvando..." : "Devolver para edição"}
          </button>
        </div>
      </div>
    </article>
  );
}

function statusChip(status: string): CSSProperties {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 1000,
    border: "1px solid rgba(15,23,42,0.10)",
    whiteSpace: "nowrap",
  };

  if (status === "pending_review") {
    return {
      ...base,
      background: "rgba(245,158,11,0.12)",
      color: "#92400E",
      border: "1px solid rgba(245,158,11,0.18)",
    };
  }

  return {
    ...base,
    background: "rgba(100,116,139,0.10)",
    color: "#334155",
  };
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#F8FAFC",
    display: "grid",
    gap: 16,
    fontFamily: "system-ui, sans-serif",
  },
  hero: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 20,
    padding: 20,
    boxShadow: "0 12px 28px rgba(15,23,42,0.06)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 1000,
    color: "#0B3C5D",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: 1000,
    color: "#0F172A",
  },
  sub: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 1.6,
    fontWeight: 700,
    color: "#475569",
    maxWidth: 760,
  },
  statPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    color: "#334155",
    fontSize: 12,
    fontWeight: 1000,
    whiteSpace: "nowrap",
  },
  success: {
    padding: 12,
    borderRadius: 12,
    background: "rgba(46,139,87,0.10)",
    border: "1px solid rgba(46,139,87,0.20)",
    color: "#14532D",
    fontSize: 12,
    fontWeight: 900,
  },
  error: {
    padding: 12,
    borderRadius: 12,
    background: "rgba(229,57,53,0.10)",
    border: "1px solid rgba(229,57,53,0.20)",
    color: "#B91C1C",
    fontSize: 12,
    fontWeight: 900,
  },
  section: {
    display: "grid",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 1000,
    color: "#0F172A",
  },
  emptyBox: {
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 16,
    padding: 18,
    color: "#475569",
    fontSize: 13,
    fontWeight: 700,
  },
  list: {
    display: "grid",
    gap: 12,
  },
  card: {
    display: "grid",
    gridTemplateColumns: "240px minmax(0, 1fr)",
    gap: 14,
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 20,
    padding: 14,
    boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
  },
  cardMedia: {
    minWidth: 0,
  },
  cover: {
    width: "100%",
    aspectRatio: "4 / 3",
    objectFit: "cover",
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#F8FAFC",
  },
  noImage: {
    width: "100%",
    aspectRatio: "4 / 3",
    borderRadius: 14,
    border: "1px dashed rgba(15,23,42,0.16)",
    background: "rgba(100,116,139,0.06)",
    display: "grid",
    placeItems: "center",
    fontSize: 13,
    fontWeight: 800,
    color: "#64748B",
  },
  cardBody: {
    display: "grid",
    gap: 10,
    minWidth: 0,
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 1000,
    color: "#0F172A",
  },
  cardSub: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: 700,
    color: "#64748B",
  },
  infoLine: {
    fontSize: 13,
    fontWeight: 700,
    color: "#334155",
    lineHeight: 1.5,
  },
  tagsWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  tag: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(11,60,93,0.06)",
    border: "1px solid rgba(11,60,93,0.10)",
    color: "#0B3C5D",
    fontSize: 12,
    fontWeight: 900,
  },
  description: {
    fontSize: 13,
    lineHeight: 1.6,
    fontWeight: 700,
    color: "#475569",
  },
  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 4,
  },
  primaryBtn: {
    height: 42,
    padding: "0 16px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#2E8B57",
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: 1000,
    cursor: "pointer",
  },
  secondaryBtn: {
    height: 42,
    padding: "0 16px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#FFFFFF",
    color: "#0F172A",
    fontSize: 12,
    fontWeight: 1000,
    cursor: "pointer",
  },
  btnDisabled: {
    opacity: 0.7,
    cursor: "not-allowed",
  },
};