// 📂 app/api/sessionLogout/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

function clearSessionCookie(res: NextResponse) {
  // remove cookie __session
  res.cookies.set("__session", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

export async function GET() {
  const res = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store, private", Vary: "Cookie" } }
  );
  return clearSessionCookie(res);
}

export async function POST() {
  const res = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store, private", Vary: "Cookie" } }
  );
  return clearSessionCookie(res);
}