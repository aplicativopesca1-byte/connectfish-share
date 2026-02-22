// 📂 app/api/sessionLogin/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdminAuth";

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const { idToken } = (await req.json()) as { idToken?: string };
    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    // (Opcional) checa se token é recente (evita replay antigo)
    const decoded = await adminAuth().verifyIdToken(idToken, true);

    // cria cookie de sessão
    const sessionCookie = await adminAuth().createSessionCookie(idToken, {
      expiresIn: FIVE_DAYS_MS,
    });

    const res = NextResponse.json({ ok: true, uid: decoded.uid });

    res.cookies.set({
      name: "__session",              // nome padrão que a Vercel/CDN aceita bem
      value: sessionCookie,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(FIVE_DAYS_MS / 1000),
    });

    return res;
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "sessionLogin_failed" },
      { status: 401 }
    );
  }
}