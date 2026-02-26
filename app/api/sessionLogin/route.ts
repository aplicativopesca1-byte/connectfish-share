// 📂 app/api/sessionLogin/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminAuth } from "../../../src/lib/firebaseAdminAuth";

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const { idToken } = (await req.json().catch(() => ({}))) as {
      idToken?: string;
    };

    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    const auth = adminAuth();

    // ✅ Produção: pode manter sem checar revogação (mais estável)
    const decoded = await auth.verifyIdToken(idToken);

    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: FIVE_DAYS_MS,
    });

    const res = NextResponse.json({ ok: true, uid: decoded.uid });

    const isProd = process.env.NODE_ENV === "production";

    // ✅ formato MAIS compatível no Vercel
    res.cookies.set("__session", sessionCookie, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(FIVE_DAYS_MS / 1000),
    });

    // ✅ só pra debug rápido (não vaza nada)
    res.headers.set("x-session-set", "1");

    return res;
  } catch (e: any) {
    console.error("[sessionLogin] error:", e);
    return NextResponse.json(
      { error: e?.message || "sessionLogin_failed" },
      { status: 401 }
    );
  }
}