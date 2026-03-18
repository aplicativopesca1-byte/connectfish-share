export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { getServerSessionUid } from "../../../src/lib/serverSession";
import FisheryClient from "./FisheryClient";

export default async function SellerFisheryPage() {
  const uid = await getServerSessionUid();

  if (!uid) {
    redirect("/login?next=%2Fseller%2Ffishery");
  }

  return <FisheryClient uid={uid} />;
}