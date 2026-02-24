// 📂 app/api/sessionCheck/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminAuth } from "../../../src/lib/firebaseAdminAuth";

export async function GET(req: Request) {
  try {
    const cookie = req.headers.get("cookie") || "";
    const m = cookie.match(/(?:^|;\s*)__session=([^;]+)/);
    const sessionCookie = m?.[1];

    if (!sessionCookie) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    // valida cookie
    const decoded = await adminAuth().verifySessionCookie(sessionCookie, true);

    return NextResponse.json({ ok: true, uid: decoded.uid });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "invalid_session" },
      { status: 401 }
    );
  }
}