export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return new Response(JSON.stringify({ ok: true, hit: "POST /api/postTest" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}