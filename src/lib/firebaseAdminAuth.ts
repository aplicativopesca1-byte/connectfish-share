// 📂 src/lib/firebaseAdminAuth.ts
import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function parseAdminJson(): ServiceAccount {
  const rawJson = process.env.FIREBASE_ADMIN_JSON;
  const b64 = process.env.FIREBASE_ADMIN_JSON_B64;

  let raw = rawJson?.trim();

  if (!raw && b64) {
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
  } catch {
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
    private_key: String(private_key).replace(/\\n/g, "\n"),
  };
}

function getAdminApp() {
  if (!getApps().length) {
    const sa = parseAdminJson();

    initializeApp({
      credential: cert({
        projectId: sa.project_id,
        clientEmail: sa.client_email,
        privateKey: sa.private_key,
      }),
    });
  }

  return getApps()[0];
}

export function adminAuth() {
  return getAuth(getAdminApp());
}

export function adminDb() {
  return getFirestore(getAdminApp());
}