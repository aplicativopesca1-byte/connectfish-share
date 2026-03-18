"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";

export default function SuccessClient() {
  const router = useRouter();

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.icon}>✓</div>

        <h1 style={styles.title}>Pesqueiro salvo com sucesso</h1>

        <p style={styles.sub}>
          Seu cadastro foi enviado para análise e está aguardando revisão antes de
          aparecer no app.
        </p>

        <div style={styles.infoBox}>
          <div style={styles.infoTitle}>Próximo passo</div>
          <div style={styles.infoText}>
            Agora você pode voltar ao painel ou editar seu cadastro caso queira
            ajustar fotos, localização ou informações do pesqueiro.
          </div>
        </div>

        <div style={styles.actions}>
          <button
            type="button"
            style={styles.secondaryBtn}
            onClick={() => router.push("/seller/fishery")}
          >
            Editar cadastro
          </button>

          <button
            type="button"
            style={styles.primaryBtn}
            onClick={() => router.push("/seller")}
          >
            Voltar ao painel
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "calc(100vh - 140px)",
    display: "grid",
    placeItems: "center",
    padding: 24,
  },

  card: {
    width: "min(640px, 100%)",
    background: "#FFFFFF",
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 24,
    padding: 28,
    boxShadow: "0 18px 40px rgba(15,23,42,0.08)",
    display: "grid",
    gap: 16,
    textAlign: "center",
    fontFamily: "system-ui, sans-serif",
  },

  icon: {
    width: 64,
    height: 64,
    borderRadius: 999,
    margin: "0 auto",
    display: "grid",
    placeItems: "center",
    background: "rgba(46,139,87,0.12)",
    color: "#14532D",
    fontSize: 28,
    fontWeight: 1000,
    border: "1px solid rgba(46,139,87,0.20)",
    boxShadow: "0 0 0 8px rgba(46,139,87,0.08)",
  },

  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 1000,
    color: "#0F172A",
    letterSpacing: -0.3,
  },

  sub: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.6,
    fontWeight: 700,
    color: "#475569",
  },

  infoBox: {
    marginTop: 4,
    padding: 16,
    borderRadius: 16,
    background: "rgba(11,60,93,0.06)",
    border: "1px solid rgba(11,60,93,0.10)",
    textAlign: "left",
  },

  infoTitle: {
    fontSize: 13,
    fontWeight: 1000,
    color: "#0B3C5D",
  },

  infoText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 1.6,
    fontWeight: 700,
    color: "#0B3C5D",
  },

  actions: {
    marginTop: 6,
    display: "flex",
    justifyContent: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  primaryBtn: {
    height: 44,
    padding: "0 18px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#0B3C5D",
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: 1000,
    cursor: "pointer",
  },

  secondaryBtn: {
    height: 44,
    padding: "0 18px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "#FFFFFF",
    color: "#0F172A",
    fontSize: 13,
    fontWeight: 1000,
    cursor: "pointer",
  },
};