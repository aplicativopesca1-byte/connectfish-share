export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../../src/lib/firebaseAdminAuth";
import { getServerSessionUid } from "../../../../../src/lib/serverSession";

function createReservationCode() {
  return `CF-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 7)
    .toUpperCase()}`;
}

export async function POST(req: Request) {
  try {
    const uid = await getServerSessionUid();

    if (!uid) {
      return NextResponse.json(
        { error: "Usuário não autenticado." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);

    const sessionId = String(body?.sessionId || "").trim();
    const peopleCount = Number(body?.peopleCount || 1);

    if (!sessionId) {
      return NextResponse.json(
        { error: "Sessão não informada." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(peopleCount) || peopleCount <= 0) {
      return NextResponse.json(
        { error: "Quantidade de pessoas inválida." },
        { status: 400 }
      );
    }

    const db = adminDb();
    const sessionRef = db.collection("fishingSessions").doc(sessionId);
    const reservationRef = db.collection("fishingReservations").doc();

    const now = Date.now();
    const expiresAt = new Date(now + 15 * 60 * 1000);

    const result = await db.runTransaction(async (tx) => {
      const sessionSnap = await tx.get(sessionRef);

      if (!sessionSnap.exists) {
        throw new Error("Sessão não encontrada.");
      }

      const session = sessionSnap.data() || {};

      if (session.active === false) {
        throw new Error("Essa sessão não está disponível para reservas.");
      }

      const capacity = Number(session.capacity || 0);
      const reservedSpots = Number(session.reservedSpots || 0);
      const availableSpots = capacity - reservedSpots;

      if (capacity <= 0) {
        throw new Error("Sessão sem capacidade configurada.");
      }

      if (availableSpots < peopleCount) {
        throw new Error("Não há vagas suficientes para essa sessão.");
      }

      const price = Number(session.price || 0);
      const amount = price * peopleCount;

      const reservationPayload = {
        reservationCode: createReservationCode(),

        pesqueiroId: session.pesqueiroId || session.ownerId || null,
        sessionId,
        areaId: session.areaId || null,

        ownerId: session.ownerId || null,
        userId: uid,

        userName: null,
        userPhoto: null,

        status: "pending",
        paymentStatus: "pending",

        amount,
        pricePerPerson: price,
        peopleCount,

        reservedAt: FieldValue.serverTimestamp(),
        paidAt: null,
        canceledAt: null,
        checkedInAt: null,
        expiresAt,

        qrCode: null,
        waitlistPosition: null,

        source: "web",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      tx.set(reservationRef, reservationPayload);

      tx.update(sessionRef, {
        reservedSpots: FieldValue.increment(peopleCount),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return {
        reservationId: reservationRef.id,
        amount,
        peopleCount,
        expiresAt: expiresAt.toISOString(),
      };
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: e?.message || "Não foi possível criar a reserva.",
      },
      { status: 400 }
    );
  }
}