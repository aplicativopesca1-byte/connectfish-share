import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function getServiceAccount() {
  const json = process.env.FIREBASE_ADMIN_JSON;
  if (!json) {
    throw new Error("Missing FIREBASE_ADMIN_JSON in .env.local");
  }

  let sa: any;
  try {
    sa = JSON.parse(json);
  } catch {
    throw new Error("FIREBASE_ADMIN_JSON is not valid JSON (check quotes/escapes in .env.local)");
  }

  const projectId = sa.project_id || sa.projectId;
  const clientEmail = sa.client_email || sa.clientEmail;

  // ✅ muito comum vir com "\n" no env
  const privateKeyRaw = sa.private_key || sa.privateKey;
  const privateKey =
    typeof privateKeyRaw === "string" ? privateKeyRaw.replace(/\\n/g, "\n") : privateKeyRaw;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("FIREBASE_ADMIN_JSON missing project_id/client_email/private_key");
  }

  return { projectId, clientEmail, privateKey };
}

// ✅ Singleton global (evita múltiplas inicializações no dev)
const g = globalThis as unknown as {
  __cf_admin_db__?: Firestore;
};

export function adminDb() {
  if (g.__cf_admin_db__) return g.__cf_admin_db__;

  if (!getApps().length) {
    const { projectId, clientEmail, privateKey } = getServiceAccount();

    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }

  g.__cf_admin_db__ = getFirestore();
  return g.__cf_admin_db__;
}
