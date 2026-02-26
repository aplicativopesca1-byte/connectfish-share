// 📂 app/api/sessionLogout/route.ts
export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function POST(_req: NextRequest) {
  const res = NextResponse.json({ ok: true });

  // 🔥 apaga cookie __session corretamente
  res.cookies.set({
    name: "__session",
    value: "",
    httpOnly: true,
    secure: true,        // obrigatório no Vercel (https)
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),   // 👈 garante remoção em todos browsers
  });

  return res;
}