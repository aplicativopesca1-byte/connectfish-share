export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { getServerSessionUid } from "../../../../src/lib/serverSession";
import FisheryAreasClient from "./FisheryAreasClient";

export default async function FisheryAreasPage() {
  const uid = await getServerSessionUid();

  if (!uid) {
    redirect("/login?next=%2Fseller%2Ffishery%2Fareas");
  }

  return <FisheryAreasClient uid={uid} />;
}