// 📂 src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  type Auth,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

// ✅ No browser do Next, precisa ser NEXT_PUBLIC_*
function mustPublic(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`[Firebase] Missing env: ${name}`);
  return v;
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

// validação (mensagem clara)
for (const [k, v] of Object.entries(firebaseConfig)) {
  if (!v) throw new Error(`[Firebase] Missing env: ${k}`);
}

// ✅ Singleton global (evita duplicação no dev/turbopack)
const g = globalThis as unknown as {
  __cf_app__?: FirebaseApp;
  __cf_auth__?: Auth;
  __cf_db__?: Firestore;
  __cf_persist__?: boolean;
};

export const app: FirebaseApp =
  g.__cf_app__ ??
  (g.__cf_app__ = getApps().length ? getApp() : initializeApp(firebaseConfig));

export const auth: Auth = g.__cf_auth__ ?? (g.__cf_auth__ = getAuth(app));
export const db: Firestore = g.__cf_db__ ?? (g.__cf_db__ = getFirestore(app));

// ✅ persistence 1x
if (!g.__cf_persist__) {
  g.__cf_persist__ = true;
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.error("[Firebase] persistence error:", err);
  });
}