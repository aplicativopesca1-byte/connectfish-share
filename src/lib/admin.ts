// 📂 src/lib/admin.ts
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function getServiceAccount() {
  const json =
    process.env.FIREBASE_ADMIN_JSON ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    "";

  if (!json) throw new Error("Missing FIREBASE_ADMIN_JSON");

  const sa = JSON.parse(json);
  const projectId = sa.project_id || sa.projectId;
  const clientEmail = sa.client_email || sa.clientEmail;

  const privateKeyRaw = sa.private_key || sa.privateKey;
  const privateKey =
    typeof privateKeyRaw === "string"
      ? privateKeyRaw.replace(/\\n/g, "\n")
      : privateKeyRaw;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Service account missing fields");
  }

  return { projectId, clientEmail, privateKey };
}

export function adminAuth() {
  if (!getApps().length) {
    const { projectId, clientEmail, privateKey } = getServiceAccount();
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return getAuth();
}