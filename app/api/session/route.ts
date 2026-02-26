// 📂 app/api/sessionCheck/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { adminAuth } from "../../../src/lib/firebaseAdminAuth";

export async function GET(req: NextRequest) {
  try {
    const raw = req.cookies.get("__session")?.value;

    if (!raw) {
      return NextResponse.json(
        { ok: false, reason: "no_cookie" },
        { status: 401, headers: { "Cache-Control": "no-store, private", Vary: "Cookie" } }
      );
    }

    const sessionCookie = raw.includes("%") ? decodeURIComponent(raw) : raw;
    const decoded = await adminAuth().verifySessionCookie(sessionCookie, true);

    return NextResponse.json(
      { ok: true, uid: decoded.uid, email: (decoded as any).email ?? null },
      { status: 200, headers: { "Cache-Control": "no-store, private", Vary: "Cookie" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, reason: "invalid_cookie", error: String(e?.message || "invalid_session") },
      { status: 401, headers: { "Cache-Control": "no-store, private", Vary: "Cookie" } }
    );
  }
}