// 📂 app/seller/SellerClient.tsx
"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SellerClient({ uid }: { uid: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function doLogout() {
    try {
      setErr(null);
      setLoading(true);

      const r = await fetch("/api/sessionLogout", {
        method: "POST",
        credentials: "include",
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
      setLoading(false);
    }
  }

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div>
          <div style={styles.h1}>Seller</div>
          <div style={styles.sub}>UID: {uid}</div>
          <div style={styles.ok}>✅ Sessão OK — rota /seller funcionando.</div>
        </div>

        <button
          type="button"
          onClick={doLogout}
          disabled={loading}
          style={{ ...styles.btn, ...(loading ? styles.btnDisabled : {}) }}
        >
          {loading ? "Saindo..." : "Sair"}
        </button>
      </div>

      {err && <div style={styles.err}>{err}</div>}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    width: "min(720px, 100%)",
    background: "rgba(255,255,255,0.96)",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
    border: "1px solid rgba(15,23,42,0.10)",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  h1: { fontSize: 22, fontWeight: 900, color: "#0F172A" },
  sub: { marginTop: 4, fontSize: 12, fontWeight: 800, color: "#334155" },
  ok: { marginTop: 8, fontSize: 12, fontWeight: 800, color: "#14532D" },
  btn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.14)",
    background: "#0F172A",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  btnDisabled: { opacity: 0.6, cursor: "not-allowed" },
  err: {
    marginTop: 12,
    background: "rgba(229,57,53,0.10)",
    border: "1px solid rgba(229,57,53,0.25)",
    color: "#B91C1C",
    padding: 10,
    borderRadius: 14,
    fontWeight: 800,
    fontSize: 12,
  },
};