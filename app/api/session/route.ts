// 📂 app/api/session/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminAuth } from "../../../src/lib/firebaseAdminAuth";

export async function POST(req: Request) {
  try {
    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json({ ok: false, reason: "missing_idToken" }, { status: 400 });
    }

    // 7 dias
    const expiresInMs = 1000 * 60 * 60 * 24 * 7;

    const sessionCookie = await adminAuth().createSessionCookie(idToken, {
      expiresIn: expiresInMs,
    });

    const res = NextResponse.json({ ok: true });

    res.cookies.set("__session", sessionCookie, {
      httpOnly: true,
      secure: true,       // Vercel = HTTPS
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(expiresInMs / 1000),
    });

    return res;
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, reason: "session_create_failed", error: String(e?.message || e) },
      { status: 401 }
    );
  }
}