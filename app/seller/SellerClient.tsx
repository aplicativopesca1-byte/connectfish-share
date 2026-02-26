// 📂 app/seller/SellerClient.tsx
"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SellerClientProps = {
  uid: string;
  email?: string | null;
};

type Order = {
  id: string;
  status: "Pendente" | "Pago" | "Enviado" | "Cancelado";
  total: string;
  date: string; // dd/mm
  customer: string;
};

function formatUid(uid: string) {
  if (!uid) return "";
  if (uid.length <= 10) return uid;
  return `${uid.slice(0, 6)}…${uid.slice(-4)}`;
}

function statusChipStyle(status: Order["status"]): CSSProperties {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid rgba(15,23,42,0.10)",
    whiteSpace: "nowrap",
  };

  if (status === "Pago")
    return { ...base, background: "rgba(46,139,87,0.14)", color: "#14532D" };
  if (status === "Enviado")
    return { ...base, background: "rgba(11,60,93,0.10)", color: "#0B3C5D" };
  if (status === "Cancelado")
    return { ...base, background: "rgba(229,57,53,0.10)", color: "#B91C1C" };

  return { ...base, background: "rgba(100,116,139,0.10)", color: "#334155" };
}

export default function SellerClient({ uid, email }: SellerClientProps) {
  const router = useRouter();
  const [loadingLogout, setLoadingLogout] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 🔧 Mock de dados (trocar depois por Firestore/DB/API)
  const stats = useMemo(
    () => [
      { label: "Pedidos hoje", value: "0" },
      { label: "Pedidos pendentes", value: "0" },
      { label: "Faturamento (mês)", value: "R$ 0" },
      { label: "Produtos ativos", value: "0" },
    ],
    []
  );

  const orders = useMemo<Order[]>(
    () => [
      // Exemplo:
      // { id: "A1B2", status: "Pago", total: "R$ 129,90", date: "26/02", customer: "Cliente X" },
    ],
    []
  );

  async function doLogout() {
    try {
      setErr(null);
      setLoadingLogout(true);

      const r = await fetch("/api/sessionLogout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });

      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data?.error || `Falha ao sair (${r.status}).`);
      }

      router.replace("/login?next=%2Fseller");
      router.refresh();
    } catch (e: any) {
      setErr(String(e?.message || "Não foi possível sair."));
    } finally {
      setLoadingLogout(false);
    }
  }

  return (
    <div style={styles.page}>
      {/* TOP BAR */}
      <header style={styles.topbar}>
        <div style={styles.brand}>
          <div style={styles.logo}>CF</div>
          <div>
            <div style={styles.brandTitle}>ConnectFish Seller</div>
            <div style={styles.brandSub}>
              {email ? email : "Painel do vendedor"} • UID {formatUid(uid)}
            </div>
          </div>
        </div>

        <div style={styles.topbarActions}>
          <a
            href="/"
            style={styles.ghostBtn}
            onClick={(e) => {
              e.preventDefault();
              router.push("/");
            }}
          >
            Home
          </a>

          <a
            href="#"
            style={styles.ghostBtn}
            onClick={(e) => {
              e.preventDefault();
              // Ajuste para seu deep link do app depois (expo linking)
              alert("Depois ligamos isso com deep link do app 🙂");
            }}
          >
            Abrir no app
          </a>

          <button
            type="button"
            onClick={doLogout}
            disabled={loadingLogout}
            style={{
              ...styles.primaryBtn,
              ...(loadingLogout ? styles.btnDisabled : {}),
            }}
          >
            {loadingLogout ? "Saindo..." : "Sair"}
          </button>
        </div>
      </header>

      {/* CONTENT */}
      <main style={styles.content}>
        {/* HERO */}
        <section style={styles.hero}>
          <div>
            <div style={styles.h1}>Seu painel</div>
            <div style={styles.heroSub}>
              Aqui você acompanha pedidos, produtos e desempenho. (vamos plugar os
              dados reais em seguida)
            </div>
          </div>

          <div style={styles.status}>
            <div style={styles.statusDot} />
            Sessão ativa
          </div>
        </section>

        {/* STATS */}
        <section style={styles.grid4}>
          {stats.map((s) => (
            <div key={s.label} style={styles.statCard}>
              <div style={styles.statLabel}>{s.label}</div>
              <div style={styles.statValue}>{s.value}</div>
            </div>
          ))}
        </section>

        {/* ROW: Orders + Actions */}
        <section style={styles.grid2}>
          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <div style={styles.panelTitle}>Últimos pedidos</div>
              <button
                type="button"
                style={styles.linkBtn}
                onClick={() => alert("Depois ligamos em /seller/orders")}
              >
                Ver tudo
              </button>
            </div>

            {orders.length === 0 ? (
              <div style={styles.empty}>
                <div style={styles.emptyTitle}>Nenhum pedido ainda</div>
                <div style={styles.emptySub}>
                  Quando alguém comprar, vai aparecer aqui.
                </div>
              </div>
            ) : (
              <div style={styles.table}>
                <div style={styles.tableHead}>
                  <div style={styles.th}>Pedido</div>
                  <div style={styles.th}>Cliente</div>
                  <div style={styles.th}>Data</div>
                  <div style={styles.th}>Total</div>
                  <div style={styles.th}>Status</div>
                </div>

                {orders.map((o) => (
                  <div key={o.id} style={styles.tr}>
                    <div style={styles.tdStrong}>{o.id}</div>
                    <div style={styles.td}>{o.customer}</div>
                    <div style={styles.td}>{o.date}</div>
                    <div style={styles.td}>{o.total}</div>
                    <div style={styles.td}>
                      <span style={statusChipStyle(o.status)}>{o.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <div style={styles.panelTitle}>Ações rápidas</div>
            </div>

            <div style={styles.actions}>
              <button
                type="button"
                style={styles.actionCard}
                onClick={() => alert("Depois ligamos em /seller/products/new")}
              >
                <div style={styles.actionTitle}>Adicionar produto</div>
                <div style={styles.actionSub}>
                  Crie um produto e disponibilize no marketplace.
                </div>
              </button>

              <button
                type="button"
                style={styles.actionCard}
                onClick={() => alert("Depois ligamos em /seller/orders")}
              >
                <div style={styles.actionTitle}>Ver pedidos</div>
                <div style={styles.actionSub}>
                  Acompanhe status, pagamentos e envios.
                </div>
              </button>

              <button
                type="button"
                style={styles.actionCard}
                onClick={() => alert("Depois ligamos em /seller/insights")}
              >
                <div style={styles.actionTitle}>Insights</div>
                <div style={styles.actionSub}>
                  Veja performance, conversão e ranking.
                </div>
              </button>
            </div>

            <div style={styles.noteBox}>
              <div style={styles.noteTitle}>Próximo passo</div>
              <div style={styles.noteSub}>
                Ligar esse painel no Firestore / API e já trazer pedidos reais,
                produtos e faturamento.
              </div>
            </div>
          </div>
        </section>

        {err && <div style={styles.err}>{err}</div>}
      </main>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(120deg, #0B3C5D 0%, #2E8B57 70%)",
    fontFamily: "system-ui",
    color: "#0F172A",
  },
  topbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: "16px 18px",
    borderBottom: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.10)",
  },
  brand: { display: "flex", gap: 12, alignItems: "center" },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 14,
    background: "#0F172A",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    letterSpacing: 1,
    userSelect: "none",
  },
  brandTitle: { fontSize: 14, fontWeight: 900, color: "#fff" },
  brandSub: { fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.78)" },

  topbarActions: { display: "flex", gap: 10, alignItems: "center" },
  ghostBtn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.20)",
    background: "rgba(255,255,255,0.10)",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    textDecoration: "none",
    fontSize: 12,
  },
  primaryBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.14)",
    background: "#0F172A",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontSize: 12,
  },
  btnDisabled: { opacity: 0.6, cursor: "not-allowed" },

  content: {
    width: "min(1100px, 100%)",
    margin: "0 auto",
    padding: 18,
  },

  hero: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    padding: 18,
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(15,23,42,0.10)",
    borderRadius: 18,
    boxShadow: "0 12px 30px rgba(0,0,0,0.10)",
  },
  h1: { fontSize: 22, fontWeight: 1000, letterSpacing: -0.2 },
  heroSub: { marginTop: 6, fontSize: 13, fontWeight: 700, color: "#334155" },

  status: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(46,139,87,0.14)",
    border: "1px solid rgba(46,139,87,0.30)",
    color: "#14532D",
    fontWeight: 900,
    fontSize: 12,
    whiteSpace: "nowrap",
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: "#2E8B57",
    boxShadow: "0 0 0 4px rgba(46,139,87,0.18)",
  },

  grid4: {
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
  },
  statCard: {
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(15,23,42,0.10)",
    borderRadius: 18,
    padding: 14,
    boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
  },
  statLabel: { fontSize: 12, fontWeight: 900, color: "#334155" },
  statValue: { marginTop: 8, fontSize: 22, fontWeight: 1000 },

  grid2: {
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: 12,
  },
  panel: {
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(15,23,42,0.10)",
    borderRadius: 18,
    padding: 14,
    boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  panelTitle: { fontSize: 14, fontWeight: 1000 },
  linkBtn: {
    background: "transparent",
    border: "none",
    padding: 0,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 1000,
    color: "#0B3C5D",
    textDecoration: "underline",
  },

  empty: {
    padding: 14,
    borderRadius: 14,
    border: "1px dashed rgba(15,23,42,0.18)",
    background: "rgba(100,116,139,0.06)",
  },
  emptyTitle: { fontSize: 13, fontWeight: 1000 },
  emptySub: { marginTop: 6, fontSize: 12, fontWeight: 800, color: "#334155" },

  table: { display: "grid", gap: 8 },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "0.7fr 1.2fr 0.7fr 0.8fr 0.8fr",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 12,
    background: "rgba(15,23,42,0.04)",
    border: "1px solid rgba(15,23,42,0.08)",
  },
  th: { fontSize: 12, fontWeight: 1000, color: "#334155" },
  tr: {
    display: "grid",
    gridTemplateColumns: "0.7fr 1.2fr 0.7fr 0.8fr 0.8fr",
    gap: 10,
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "#fff",
  },
  td: { fontSize: 12, fontWeight: 800, color: "#0F172A" },
  tdStrong: { fontSize: 12, fontWeight: 1000, color: "#0F172A" },

  actions: { display: "grid", gap: 10 },
  actionCard: {
    textAlign: "left",
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#fff",
    cursor: "pointer",
  },
  actionTitle: { fontSize: 13, fontWeight: 1000 },
  actionSub: { marginTop: 6, fontSize: 12, fontWeight: 800, color: "#334155" },

  noteBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    background: "rgba(46,139,87,0.10)",
    border: "1px solid rgba(46,139,87,0.20)",
  },
  noteTitle: { fontSize: 12, fontWeight: 1000, color: "#14532D" },
  noteSub: { marginTop: 6, fontSize: 12, fontWeight: 800, color: "#14532D" },

  err: {
    marginTop: 12,
    background: "rgba(229,57,53,0.10)",
    border: "1px solid rgba(229,57,53,0.25)",
    color: "#B91C1C",
    padding: 10,
    borderRadius: 14,
    fontWeight: 900,
    fontSize: 12,
  },
};