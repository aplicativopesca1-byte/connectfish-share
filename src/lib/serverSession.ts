// 📂 src/lib/serverSession.ts
import "server-only";
import { cookies } from "next/headers";

export async function getServerSessionUid() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("__session")?.value;

    if (!sessionCookie) return null;

    const { adminAuth } = await import("./firebaseAdminAuth");
    const decoded = await adminAuth().verifySessionCookie(sessionCookie, true);

    return decoded?.uid ?? null;
  } catch (e) {
    console.error("[getServerSessionUid] failed:", e);
    return null;
  }
}