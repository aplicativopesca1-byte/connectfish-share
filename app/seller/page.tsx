// 📂 app/seller/page.tsx
export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { getServerSessionUid } from "../../src/lib/serverSession";
import SellerClient from "./SellerClient";

export default async function SellerPage() {
  const uid = await getServerSessionUid();
  if (!uid) redirect("/login?next=%2Fseller");

  return <SellerClient uid={uid} />;
}