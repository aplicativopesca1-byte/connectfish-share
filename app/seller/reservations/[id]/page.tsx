import { redirect } from "next/navigation";
import { getServerSessionUid } from "../../../../src/lib/serverSession";
import ReservationDetailClient from "./ReservationDetailClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SellerReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const uid = await getServerSessionUid();

  if (!uid) {
    redirect(`/login?next=%2Fseller%2Freservations%2F${id}`);
  }

  return <ReservationDetailClient uid={uid} reservationId={id} />;
}