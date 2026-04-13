"use client";
import type { CSSProperties, FormEvent } from "react";

export default function Home() {
  const year = new Date().getFullYear();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    alert("Cadastro recebido! (modo preview)");
  };

  return (
    <main style={styles.page}>
      <div style={styles.bgGlow} aria-hidden="true" />

      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.brandRow}>
            <div style={styles.logoMark} aria-hidden="true">
              CF
            </div>

            <div style={styles.brandText}>
              <h1 style={styles.title}>ConnectFish</h1>
              <div style={styles.badges}>
                <span style={styles.badge}>Private beta</span>
                <span style={styles.badgeMuted}>Em construção</span>
              </div>
            </div>
          </div>

          <p style={styles.subtitle}>
            Uma nova experiência está chegando. Design, performance e detalhes
            pensados do zero.
          </p>

          <div style={styles.ctaRow}>
            <a href="/seller" style={styles.primaryCta}>
              Acessar portal
            </a>
            <a href="#updates" style={styles.secondaryCta}>
              Receber novidades
            </a>
          </div>
        </header>

        <section style={styles.legalSectionHighlight}>
          <div style={styles.legalHeroHeader}>
            <div style={styles.legalHeroBadge}>Segurança e transparência</div>
            <h2 style={styles.legalHeroTitle}>Documentos oficiais do ConnectFish</h2>
            <p style={styles.legalHeroSubtitle}>
              Consulte nossos Termos de Uso e Política de Privacidade para
              entender como a plataforma funciona, como tratamos dados, quais
              são os direitos dos usuários e quais regras se aplicam ao uso do
              app e do site.
            </p>
          </div>

          <div style={styles.legalGrid}>
            <a href="/terms" style={styles.legalCard}>
              <div style={styles.legalIcon} aria-hidden="true">
                📘
              </div>

              <div style={styles.legalContent}>
                <h3 style={styles.legalCardTitle}>Termos de Uso</h3>
                <p style={styles.legalCardText}>
                  Regras de uso da plataforma, responsabilidades do usuário,
                  limites de uso, riscos da atividade, suspensão de conta,
                  propriedade intelectual e condições aplicáveis ao ConnectFish.
                </p>
                <span style={styles.legalLink}>Abrir Termos de Uso</span>
              </div>
            </a>

            <a href="/privacy" style={styles.legalCard}>
              <div style={styles.legalIcon} aria-hidden="true">
                🔐
              </div>

              <div style={styles.legalContent}>
                <h3 style={styles.legalCardTitle}>Política de Privacidade</h3>
                <p style={styles.legalCardText}>
                  Entenda como coletamos, utilizamos, armazenamos, protegemos e
                  compartilhamos dados, incluindo localização, replay, mapa,
                  conta, conteúdos publicados e recursos sociais.
                </p>
                <span style={styles.legalLink}>Abrir Política de Privacidade</span>
              </div>
            </a>
          </div>
        </section>

        <section style={styles.grid}>
          <div style={styles.card}>
            <div style={styles.cardIcon} aria-hidden="true">
              ✦
            </div>
            <h2 style={styles.cardTitle}>Produto em evolução</h2>
            <p style={styles.cardText}>
              Estamos finalizando as principais funcionalidades antes de abrir ao
              público.
            </p>
          </div>

          <div style={styles.card}>
            <div style={styles.cardIcon} aria-hidden="true">
              ⚡
            </div>
            <h2 style={styles.cardTitle}>Foco em qualidade</h2>
            <p style={styles.cardText}>
              Interface limpa, fluxo rápido e experiência consistente em todas as
              telas.
            </p>
          </div>

          <div style={styles.card}>
            <div style={styles.cardIcon} aria-hidden="true">
              🔒
            </div>
            <h2 style={styles.cardTitle}>Acesso controlado</h2>
            <p style={styles.cardText}>
              Por enquanto, apenas áreas internas e parceiros selecionados.
            </p>
          </div>
        </section>

        <section id="updates" style={styles.newsletter}>
          <div style={styles.newsLeft}>
            <h3 style={styles.newsTitle}>Quer ser avisado quando abrir?</h3>
            <p style={styles.newsText}>
              Deixe seu e-mail e você recebe um aviso quando liberarmos o acesso.
            </p>
          </div>

          <form style={styles.form} onSubmit={handleSubmit}>
            <input
              type="email"
              required
              placeholder="seuemail@exemplo.com"
              style={styles.input}
            />
            <button type="submit" style={styles.button}>
              Entrar na lista
            </button>
          </form>
        </section>

        <footer style={styles.footer}>
          <span style={styles.footerText}>© {year} ConnectFish</span>

          <span style={styles.dot} aria-hidden="true">
            •
          </span>

          <a href="/terms" style={styles.footerLink}>
            Termos
          </a>

          <span style={styles.dot} aria-hidden="true">
            •
          </span>

          <a href="/privacy" style={styles.footerLink}>
            Privacidade
          </a>

          <span style={styles.dot} aria-hidden="true">
            •
          </span>

          <span style={styles.footerTextMuted}>Build em progresso</span>
        </footer>
      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 800px at 20% 10%, rgba(45,212,191,0.20), transparent 60%)," +
      "radial-gradient(900px 600px at 85% 30%, rgba(56,189,248,0.18), transparent 60%)," +
      "linear-gradient(180deg, #06141a 0%, #050a0f 100%)",
    color: "#e6f6f7",
    position: "relative",
    overflow: "hidden",
  },

  bgGlow: {
    position: "absolute",
    inset: -200,
    background:
      "radial-gradient(circle at 50% 50%, rgba(16,185,129,0.10), transparent 55%)",
    filter: "blur(30px)",
    pointerEvents: "none",
  },

  container: {
    position: "relative",
    padding: 32,
    maxWidth: 1100,
    margin: "0 auto",
  },

  header: {
    marginTop: 24,
    marginBottom: 22,
    padding: 28,
    borderRadius: 20,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
  },

  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
  },

  brandText: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  logoMark: {
    width: 52,
    height: 52,
    borderRadius: 16,
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    letterSpacing: 0.5,
    color: "#001114",
    background:
      "linear-gradient(135deg, rgba(45,212,191,1) 0%, rgba(56,189,248,1) 100%)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
    userSelect: "none",
  },

  title: {
    fontSize: 42,
    fontWeight: 950,
    margin: 0,
    lineHeight: 1.05,
    letterSpacing: -0.8,
  },

  badges: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  badge: {
    fontSize: 12,
    fontWeight: 800,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(45,212,191,0.16)",
    border: "1px solid rgba(45,212,191,0.28)",
    color: "#bff7ee",
  },

  badgeMuted: {
    fontSize: 12,
    fontWeight: 800,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "rgba(230,246,247,0.75)",
  },

  subtitle: {
    marginTop: 14,
    marginBottom: 0,
    fontSize: 18,
    lineHeight: 1.55,
    color: "rgba(230,246,247,0.80)",
    maxWidth: 720,
  },

  ctaRow: {
    display: "flex",
    gap: 12,
    marginTop: 18,
    flexWrap: "wrap",
  },

  primaryCta: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "12px 16px",
    borderRadius: 12,
    textDecoration: "none",
    fontWeight: 900,
    color: "#001114",
    background:
      "linear-gradient(135deg, rgba(45,212,191,1) 0%, rgba(56,189,248,1) 100%)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
  },

  secondaryCta: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "12px 16px",
    borderRadius: 12,
    textDecoration: "none",
    fontWeight: 900,
    color: "rgba(230,246,247,0.88)",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
  },

  legalSectionHighlight: {
    marginTop: 16,
    marginBottom: 24,
    padding: 22,
    borderRadius: 20,
    background:
      "linear-gradient(135deg, rgba(0,191,223,0.14), rgba(94,252,161,0.08))",
    border: "1px solid rgba(0,191,223,0.35)",
    boxShadow: "0 20px 60px rgba(0,191,223,0.15)",
    backdropFilter: "blur(10px)",
  },

  legalHeroHeader: {
    marginBottom: 16,
  },

  legalHeroBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    color: "#bff7ee",
    background: "rgba(45,212,191,0.16)",
    border: "1px solid rgba(45,212,191,0.28)",
  },

  legalHeroTitle: {
    marginTop: 14,
    marginBottom: 0,
    fontSize: 24,
    fontWeight: 950,
    letterSpacing: -0.4,
  },

  legalHeroSubtitle: {
    marginTop: 10,
    marginBottom: 0,
    fontSize: 15,
    lineHeight: 1.7,
    color: "rgba(230,246,247,0.78)",
    maxWidth: 820,
  },

  legalGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 14,
  },

  legalCard: {
    display: "flex",
    gap: 14,
    alignItems: "flex-start",
    padding: 18,
    borderRadius: 18,
    textDecoration: "none",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.20)",
    color: "#e6f6f7",
  },

  legalIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    flexShrink: 0,
    userSelect: "none",
  },

  legalContent: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  legalCardTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 900,
    letterSpacing: -0.2,
  },

  legalCardText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.65,
    color: "rgba(230,246,247,0.78)",
  },

  legalLink: {
    fontSize: 13,
    fontWeight: 900,
    color: "#bff7ee",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 14,
    marginBottom: 18,
  },

  card: {
    padding: 18,
    borderRadius: 18,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.25)",
  },

  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    marginBottom: 12,
    userSelect: "none",
  },

  cardTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 900,
    letterSpacing: -0.2,
  },

  cardText: {
    marginTop: 8,
    marginBottom: 0,
    fontSize: 14,
    lineHeight: 1.6,
    color: "rgba(230,246,247,0.75)",
  },

  newsletter: {
    marginTop: 18,
    padding: 18,
    borderRadius: 18,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03))",
    border: "1px solid rgba(255,255,255,0.10)",
    display: "flex",
    gap: 14,
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },

  newsLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  newsTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 950,
    letterSpacing: -0.2,
  },

  newsText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.5,
    color: "rgba(230,246,247,0.75)",
  },

  form: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
  },

  input: {
    width: 280,
    maxWidth: "80vw",
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    outline: "none",
    background: "rgba(0,0,0,0.25)",
    color: "#e6f6f7",
    fontWeight: 700,
  },

  button: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(45,212,191,0.28)",
    background: "rgba(45,212,191,0.16)",
    color: "#bff7ee",
    fontWeight: 950,
    cursor: "pointer",
  },

  footer: {
    marginTop: 26,
    paddingTop: 18,
    borderTop: "1px solid rgba(255,255,255,0.10)",
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },

  footerText: {
    color: "rgba(230,246,247,0.70)",
    fontWeight: 800,
    fontSize: 13,
  },

  footerTextMuted: {
    color: "rgba(230,246,247,0.50)",
    fontWeight: 800,
    fontSize: 13,
  },

  footerLink: {
    color: "rgba(230,246,247,0.82)",
    fontWeight: 800,
    fontSize: 13,
    textDecoration: "none",
  },

  dot: {
    opacity: 0.5,
  },
};