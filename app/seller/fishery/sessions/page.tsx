export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { getServerSessionUid } from "../../../../src/lib/serverSession";
import FisherySessionsClient from "./FisherySessionsClient";

export default async function FisherySessionsPage() {
  const uid = await getServerSessionUid();

  if (!uid) {
    redirect("/login?next=%2Fseller%2Ffishery%2Fsessions");
  }

  return <FisherySessionsClient uid={uid} />;
}