export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { getServerSessionUid } from "../../../../src/lib/serverSession";
import FisheryClient from "../FisheryClient";

export default async function FisheryProfilePage() {
  const uid = await getServerSessionUid();

  if (!uid) {
    redirect("/login?next=%2Fseller%2Ffishery%2Fprofile");
  }

  return <FisheryClient uid={uid} />;
}