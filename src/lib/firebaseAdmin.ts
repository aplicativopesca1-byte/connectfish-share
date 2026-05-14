// 📂 src/lib/firebaseAdmin.ts
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * ✅ Lê o service account do ENV em JSON.
 * Use na Vercel (Environment Variables):
 *   FIREBASE_ADMIN_JSON = {"type":"service_account", ...}
 *
 * Dica:
 * - Se você colar o JSON inteiro, mantenha tudo em UMA linha (Vercel aceita).
 * - Se quebrar build, quase sempre é aspas/escape do JSON.
 */
function getServiceAccount() {
  const json =
    process.env.FIREBASE_ADMIN_JSON ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON || // alias opcional
    "";

  if (!json) {
    throw new Error(
      "Missing FIREBASE_ADMIN_JSON in environment. Add it in Vercel Env Vars."
    );
  }

  let sa: any;
  try {
    sa = JSON.parse(json);
  } catch (e) {
    throw new Error(
      "FIREBASE_ADMIN_JSON is not valid JSON. Tip: ensure it's a single-line JSON string and quotes are correct."
    );
  }

  const projectId = sa.project_id || sa.projectId;
  const clientEmail = sa.client_email || sa.clientEmail;

  // ✅ comum vir com \"\\n\" no env
  const privateKeyRaw = sa.private_key || sa.privateKey;
  const privateKey =
    typeof privateKeyRaw === "string"
      ? privateKeyRaw.replace(/\\n/g, "\n")
      : privateKeyRaw;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "FIREBASE_ADMIN_JSON missing project_id/client_email/private_key"
    );
  }

  return { projectId, clientEmail, privateKey };
}

// ✅ Singleton global (evita múltiplas inicializações no dev)
const g = globalThis as unknown as {
  __cf_admin_db__?: Firestore;
  __cf_admin_inited__?: boolean;
};

export function adminDb(): Firestore {
  if (g.__cf_admin_db__) return g.__cf_admin_db__;

  // init 1x
  if (!getApps().length && !g.__cf_admin_inited__) {
    const { projectId, clientEmail, privateKey } = getServiceAccount();

    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });

    g.__cf_admin_inited__ = true;
  }

  g.__cf_admin_db__ = getFirestore();
  return g.__cf_admin_db__;
}
