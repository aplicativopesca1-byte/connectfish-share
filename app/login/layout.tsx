import React from "react";
import Link from "next/link";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(120deg, #0B3C5D 0%, #2E8B57 70%)",
        padding: 18,
        fontFamily: "system-ui",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <header
        style={{
          width: "min(980px, 100%)",
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          padding: "12px 12px",
          borderRadius: 16,
          background: "rgba(255,255,255,0.14)",
          border: "1px solid rgba(255,255,255,0.18)",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: "rgba(15,23,42,0.9)",
              display: "grid",
              placeItems: "center",
              fontWeight: 900,
              letterSpacing: 1,
            }}
          >
            CF
          </div>

          <div>
            <div style={{ fontWeight: 900, fontSize: 14, lineHeight: 1.1 }}>
              ConnectFish Seller
            </div>
            <div style={{ fontWeight: 700, fontSize: 12, opacity: 0.85, marginTop: 2 }}>
              Painel do vendedor
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            href="/"
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.18)",
              border: "1px solid rgba(255,255,255,0.22)",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 900,
              fontSize: 12,
            }}
          >
            Home
          </Link>

          <a
            href="connectfish://"
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.18)",
              border: "1px solid rgba(255,255,255,0.22)",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 900,
              fontSize: 12,
            }}
          >
            Abrir no app
          </a>
        </div>
      </header>

      <main style={{ width: "min(980px, 100%)", margin: "0 auto" }}>{children}</main>

      <footer style={{ width: "min(980px, 100%)", margin: "0 auto", opacity: 0.75, textAlign: "center" }}>
        <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>© ConnectFish</span>
      </footer>
    </div>
  );
}
