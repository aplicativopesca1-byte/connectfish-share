export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSessionUid } from "@/lib/serverSession";
import { adminDb } from "@/lib/firebaseAdminAuth";

function isAdminUid(uid: string | null | undefined) {
  if (!uid) return false;

  const raw = process.env.ADMIN_UIDS || "";

  const adminUids = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return adminUids.includes(uid);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ fisheryId: string }> }
) {
  try {
    const uid = await getServerSessionUid();

    if (!uid) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    if (!isAdminUid(uid)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { fisheryId } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const nextStatus = body?.status;

    if (!fisheryId) {
      return NextResponse.json({ error: "FisheryId ausente." }, { status: 400 });
    }

    if (nextStatus !== "active" && nextStatus !== "draft") {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }

    const db = adminDb();
    const ref = db.collection("pesqueiros").doc(fisheryId);

    const payload: Record<string, any> = {
      status: nextStatus,
      updatedAt: new Date(),
    };

    if (nextStatus === "active") {
      payload.approvedAt = new Date();
    }

    if (nextStatus === "draft") {
      payload.approvedAt = null;
    }

    await ref.set(payload, { merge: true });

    return NextResponse.json({ ok: true, status: nextStatus });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Erro interno." },
      { status: 500 }
    );
  }
}