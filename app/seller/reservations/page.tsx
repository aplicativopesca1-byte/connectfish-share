import { redirect } from "next/navigation";
import { getServerSessionUid } from "../../../src/lib/serverSession";
import ReservationsClient from "./ReservationsClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SellerReservationsPage() {
  const uid = await getServerSessionUid();

  if (!uid) {
    redirect("/login?next=%2Fseller%2Freservations");
  }

  return <ReservationsClient uid={uid} />;
}