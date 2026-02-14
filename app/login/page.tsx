// app/login/page.tsx
import { Suspense } from "react";
import type { CSSProperties } from "react";
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div style={fallbackStyle}>Carregando…</div>}>
      <LoginClient />
    </Suspense>
  );
}

const fallbackStyle: CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(120deg, #0B3C5D 0%, #2E8B57 70%)",
  color: "#fff",
  fontFamily: "system-ui",
  fontWeight: 900,
};
