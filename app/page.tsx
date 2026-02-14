export default function Home() {
  const year = new Date().getFullYear();

  return (
    <main style={styles.page}>
      {/* Background glow */}
      <div style={styles.bgGlow} aria-hidden="true" />

      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.brandRow}>
            <div style={styles.logoMark} aria-hidden="true">
              CF
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h3 style={styles.newsTitle}>Quer ser avisado quando abrir?</h3>
            <p style={styles.newsText}>
              Deixe seu e-mail e você recebe um aviso quando liberarmos o acesso.
            </p>
          </div>

          <form
            style={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              // ✅ Por enquanto só não faz nada. Quando quiser, eu ligo isso no seu backend/Email service.
              alert("Cadastro recebido! (modo preview)");
            }}
          >
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
          <span style={styles.footerTextMuted}>Build em progresso</span>
        </footer>
      </div>
    </main>
  );
}

const styles = {
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
    marginBottom: 34,
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
  dot: { opacity: 0.5 },
};
