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
  apiKey: mustPublic("AIzaSyCoV-Qwq-hQ8zALhWxrDv-go8s_MQBjjIY"),
  authDomain: mustPublic("connectfish.firebaseapp.com"),
  projectId: mustPublic("connectfish"),
  storageBucket: mustPublic("connectfish.firebasestorage.app"),
  messagingSenderId: mustPublic("1002946531833"),
  appId: mustPublic("1:1002946531833:web:2e050c04233107dbaf2d28"),
};

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