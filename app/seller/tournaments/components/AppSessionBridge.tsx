"use client";

import { useEffect, useState } from "react";

export default function AppSessionBridge() {
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (typeof window === "undefined") return;

      const hash = window.location.hash?.replace(/^#/, "") || "";
      const params = new URLSearchParams(hash);
      const appToken = params.get("appToken");

      console.log("[AppSessionBridge] mounted");
      console.log("[AppSessionBridge] hash:", window.location.hash);
      console.log("[AppSessionBridge] has appToken:", !!appToken);

      if (!appToken) return;

      setProcessing(true);

      try {
       // 1. limpa sessão antiga
await fetch("/api/sessionLogout", {
  method: "POST",
  credentials: "include",
});

// 2. cria nova sessão
const response = await fetch("/api/sessionLogin", {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ idToken: appToken }),
});

        const data = await response.json().catch(() => ({}));

        console.log("[AppSessionBridge] sessionLogin status:", response.status);
        console.log("[AppSessionBridge] sessionLogin data:", data);

        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || "Falha ao criar sessão web.");
        }

        const cleanUrl = window.location.pathname + window.location.search;

        if (!cancelled) {
          window.location.replace(cleanUrl);
        }
      } catch (error) {
        console.error("[AppSessionBridge] erro:", error);
        if (!cancelled) {
          setProcessing(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!processing) return null;

  return (
    <div
      style={{
        marginBottom: 12,
        padding: 12,
        borderRadius: 12,
        background: "#EFF6FF",
        border: "1px solid #BFDBFE",
        color: "#1E40AF",
        fontSize: 14,
        fontWeight: 700,
      }}
    >
      Validando seu acesso vindo do app...
    </div>
  );
}