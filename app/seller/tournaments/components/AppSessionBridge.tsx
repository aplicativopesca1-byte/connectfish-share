"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function AppSessionBridge() {
  const { refresh } = useAuth();
  const [processing, setProcessing] = useState(false);

  console.log("[AppSessionBridge] mounted");
  console.log("[AppSessionBridge] hash:", typeof window !== "undefined" ? window.location.hash : "no-window");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (typeof window === "undefined") return;

      const hash = window.location.hash?.replace(/^#/, "") || "";
      const params = new URLSearchParams(hash);
      const appToken = params.get("appToken");

      console.log("[AppSessionBridge] parsed hash:", hash);
      console.log("[AppSessionBridge] has appToken:", !!appToken);

      if (!appToken) return;

      setProcessing(true);

      try {
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
        window.history.replaceState({}, document.title, cleanUrl);

        if (!cancelled) {
          await refresh();
        }
      } catch (error) {
        console.error("[AppSessionBridge] erro:", error);
      } finally {
        if (!cancelled) {
          setProcessing(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

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