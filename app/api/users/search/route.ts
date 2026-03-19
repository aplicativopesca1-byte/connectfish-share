import { NextResponse } from "next/server";
import { adminDb } from "../../../../src/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UserSearchResult = {
  userId: string;
  username: string;
  email: string | null;
  photoUrl: string | null;
};

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const queryParam = searchParams.get("query");

    if (!queryParam || queryParam.trim().length < 2) {
      return NextResponse.json(
        { success: false, message: "Query deve ter ao menos 2 caracteres." },
        { status: 400 }
      );
    }

    const queryNormalized = normalizeQuery(queryParam);
    const db = adminDb();

    const usersRef = db.collection("users");

    const snapshot = await usersRef
      .where("username", ">=", queryNormalized)
      .where("username", "<=", `${queryNormalized}\uf8ff`)
      .limit(10)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({
        success: true,
        results: [],
      });
    }

    const results: UserSearchResult[] = snapshot.docs.map((userDoc) => {
      const data = userDoc.data() as Record<string, unknown>;

      return {
        userId: userDoc.id,
        username: String(data.username ?? ""),
        email: data.email ? String(data.email) : null,
        photoUrl: data.photoUrl ? String(data.photoUrl) : null,
      };
    });

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erro ao buscar usuários.",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}