// 📂 src/lib/firebaseAdminAuth.ts
import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function parseAdminJson(): ServiceAccount {
  const rawJson = process.env.FIREBASE_ADMIN_JSON;
  const b64 = process.env.FIREBASE_ADMIN_JSON_B64;

  // Preferir JSON direto (menos chance de runtime pegar Buffer)
  let raw = rawJson?.trim();

  // Se só tiver B64, decodifica usando atob (funciona em runtimes web/edge também)
  if (!raw && b64) {
    // atob existe em runtimes web; no Node também funciona via global em Next (mas se não existir, caímos no fallback)
    const decode =
      typeof atob === "function"
        ? atob
        : (s: string) => Buffer.from(s, "base64").toString("utf8");
    raw = decode(b64).trim();
  }

  if (!raw) {
    throw new Error(
      "Missing FIREBASE_ADMIN_JSON (preferred) or FIREBASE_ADMIN_JSON_B64 in environment."
    );
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error("FIREBASE_ADMIN_JSON is not valid JSON (parse failed).");
  }

  const { project_id, client_email, private_key } = parsed || {};
  if (!project_id || !client_email || !private_key) {
    throw new Error(
      "FIREBASE_ADMIN_JSON is missing required fields (project_id/client_email/private_key)."
    );
  }

  return {
    project_id,
    client_email,
    // importante: normalizar \n
    private_key: String(private_key).replace(/\\n/g, "\n"),
  };
}

function initAdmin() {
  if (getApps().length) return;

  const sa = parseAdminJson();

  initializeApp({
    credential: cert({
      projectId: sa.project_id,
      clientEmail: sa.client_email,
      privateKey: sa.private_key,
    }),
  });
}

export function adminAuth() {
  initAdmin();
  return getAuth();
}