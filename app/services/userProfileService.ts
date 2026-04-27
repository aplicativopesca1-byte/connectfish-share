import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

function normalizeEmail(value: string) {
  return String(value || "").trim().toLowerCase();
}

function buildSafeUsernameFromUser(user: any) {
  const emailPrefix = user?.email?.split("@")?.[0] || "";
  const displayName = user?.displayName || "";
  const base = emailPrefix || displayName || "usuario";

  const normalized = String(base)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._]/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "");

  return normalized.length >= 3
    ? normalized
    : `user_${user?.uid?.slice(0, 6) || "cf"}`;
}

export async function ensureUserProfile(user: any, provider = "web_login") {
  if (!user?.uid) return;

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) return;

  const now = Date.now();

  await setDoc(ref, {
    userId: user.uid,
    email: normalizeEmail(user.email || ""),
    username: buildSafeUsernameFromUser(user),
    createdAt: now,
    updatedAt: now,

    photoUrl: user.photoURL || null,
    bio: "",
    completedSetup: false,

    membership: {
      tier: "free",
      status: "inactive",
      provider,
      startedAt: null,
      expiresAt: null,
      autoRenew: false,
    },

    xpTotal: 0,
    level: 1,
    badges: [],
    stats: {
      totalPosts: 0,
      totalDistance: 0,
      totalTime: 0,
      totalFish: 0,
      biggestCatchLength: null,
      biggestCatchWeight: null,
    },

    region: {
      state: null,
      city: null,
      country: "Brasil",
    },

    usage: {
      fishingLogsMonthCount: 0,
      savedPinsCount: 0,
      currentMonthKey: null,
    },
  });
}