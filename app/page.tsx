export default function Home() {
  return (
    <main style={{ padding: 32, maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ marginBottom: 48 }}>
        <h1 style={{ fontSize: 42, fontWeight: 900 }}>
          🎣 ConnectFish
        </h1>
        <p style={{ fontSize: 18, marginTop: 12 }}>
          A plataforma definitiva para registrar, reviver e compartilhar suas pescarias.
        </p>
      </header>

      <section style={{ marginBottom: 48 }}>
        <h2>📱 O App</h2>
        <p>
          Grave sua rota, registre capturas, acompanhe replays e navegue como no Waze — feito por pescadores.
        </p>
      </section>

      <section style={{ marginBottom: 48 }}>
        <h2>🛒 Marketplace</h2>
        <p>
          Guias, pousadas, produtos e experiências — tudo conectado à sua pescaria.
        </p>
        <a
          href="/seller"
          style={{
            display: "inline-block",
            marginTop: 12,
            padding: "10px 16px",
            background: "#0f766e",
            color: "#fff",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          Acessar área do vendedor
        </a>
      </section>

      <footer style={{ borderTop: "1px solid #ddd", paddingTop: 24 }}>
        <p style={{ color: "#666" }}>
          © {new Date().getFullYear()} ConnectFish
        </p>
      </footer>
    </main>
  );
}
