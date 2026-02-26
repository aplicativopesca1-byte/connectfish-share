// 📂 app/api/sessionCheck/route.ts
export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { adminAuth } from "../../../src/lib/firebaseAdminAuth";

export async function GET(req: NextRequest) {
  try {
    const raw = req.cookies.get("__session")?.value;

    if (!raw) {
      return NextResponse.json({ ok: false, reason: "no_cookie" }, { status: 401 });
    }

    // Normalmente já vem pronto aqui; decode só se tiver % no valor
    const sessionCookie = raw.includes("%") ? decodeURIComponent(raw) : raw;

    const decoded = await adminAuth().verifySessionCookie(sessionCookie, true);

    return NextResponse.json({ ok: true, uid: decoded.uid }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, reason: "invalid_cookie", error: String(e?.message || "invalid_session") },
      { status: 401 }
    );
  }
}