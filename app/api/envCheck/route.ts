// 📂 app/api/envCheck/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function GET() {
  // ⚠️ Não exponha segredos aqui.
  // Só confirma se variáveis "existem" (true/false).
  const keys = [
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
    "FIREBASE_SERVICE_ACCOUNT",
  ];

  const present: Record<string, boolean> = {};
  for (const k of keys) present[k] = Boolean(process.env[k]);

  return NextResponse.json(
    {
      ok: true,
      nodeEnv: process.env.NODE_ENV,
      present,
    },
    { headers: { "Cache-Control": "no-store, private" } }
  );
}