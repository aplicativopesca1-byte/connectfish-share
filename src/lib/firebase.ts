// 📂 src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  type Auth,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

// 🔒 Garantir que este módulo só execute no browser
const isBrowser = typeof window !== "undefined";

// ✅ Config com acesso ESTÁTICO (necessário pro bundler)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// ✅ validação: só no browser (onde realmente precisa)
if (isBrowser) {
  const missing = Object.entries(firebaseConfig)
    .filter(([_, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    throw new Error(`[Firebase] Missing env: ${missing.join(", ")}`);
  }
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
  (g.__cf_app__ = getApps().length ? getApp() : initializeApp(firebaseConfig as any));

export const auth: Auth = g.__cf_auth__ ?? (g.__cf_auth__ = getAuth(app));
export const db: Firestore = g.__cf_db__ ?? (g.__cf_db__ = getFirestore(app));

// ✅ persistence: apenas no browser
if (isBrowser && !g.__cf_persist__) {
  g.__cf_persist__ = true;
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.error("[Firebase] persistence error:", err);
  });
}