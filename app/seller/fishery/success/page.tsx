export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { getServerSessionUid } from "../../../../src/lib/serverSession";
import SuccessClient from "./SuccessClient";

export default async function FisherySuccessPage() {
  const uid = await getServerSessionUid();

  if (!uid) {
    redirect("/login?next=%2Fseller%2Ffishery%2Fsuccess");
  }

  return <SuccessClient />;
}