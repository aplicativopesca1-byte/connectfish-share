// 📂 src/lib/firebaseAdminAuth.ts
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function getServiceAccount() {
  const json =
    process.env.FIREBASE_ADMIN_JSON ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    "";

  if (!json) {
    throw new Error(
      "Missing FIREBASE_ADMIN_JSON in environment. Add it in Vercel Env Vars."
    );
  }

  let sa: any;
  try {
    sa = JSON.parse(json);
  } catch {
    throw new Error(
      "FIREBASE_ADMIN_JSON is not valid JSON. Ensure it is a single-line JSON string with escaped \\n in private_key."
    );
  }

  const projectId = sa.project_id || sa.projectId;
  const clientEmail = sa.client_email || sa.clientEmail;

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

// ✅ garante singleton no server (evita re-init)
let _inited = false;

function initAdmin() {
  if (_inited) return;
  if (getApps().length) {
    _inited = true;
    return;
  }

  const { projectId, clientEmail, privateKey } = getServiceAccount();

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });

  _inited = true;
}

// ✅ export exatamente como você está importando: { adminAuth }
export function adminAuth() {
  initAdmin();
  return getAuth();
}