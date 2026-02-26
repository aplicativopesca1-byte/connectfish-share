// 📂 app/seller/page.tsx
export const runtime = "nodejs";
import { redirect } from "next/navigation";
import { getServerSessionUid } from "../../src/lib/serverSession";

export default async function SellerPage() {
  const uid = await getServerSessionUid();

  if (!uid) {
    redirect("/login?next=%2Fseller");
  }

  return (
    <div style={{ padding: 40, fontFamily: "system-ui" }}>
      <h1>Seller</h1>
      <p>UID: {uid}</p>
      <p>✅ Sessão OK — rota /seller funcionando.</p>
    </div>
  );
}