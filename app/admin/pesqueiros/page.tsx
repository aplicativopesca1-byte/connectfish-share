export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { getServerSessionUid } from "../../../src/lib/serverSession";
import { adminDb } from "../../../src/lib/firebaseAdminAuth";
import AdminFisheriesClient from "./AdminFisheriesClient";

export type AdminFisheryItem = {
  id: string;
  ownerId: string;
  name: string;
  city: string;
  state: string;
  status: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  address: string;
  description: string;
  coverImage: string;
  fishTypes: string[];
};

function isAdminUid(uid: string | null | undefined) {
  if (!uid) return false;

  const raw = process.env.ADMIN_UIDS || "";

  const adminUids = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return adminUids.includes(uid);
}

export default async function AdminFisheriesPage() {
  const uid = await getServerSessionUid();

  if (!uid) {
    redirect("/login?next=%2Fadmin%2Fpesqueiros");
  }

  if (!isAdminUid(uid)) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#F8FAFC",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            width: "min(560px, 100%)",
            background: "#FFFFFF",
            border: "1px solid rgba(15,23,42,0.08)",
            borderRadius: 20,
            padding: 24,
            boxShadow: "0 18px 40px rgba(15,23,42,0.08)",
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 1000, color: "#0F172A" }}>
            Acesso restrito
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 14,
              fontWeight: 700,
              lineHeight: 1.6,
              color: "#475569",
            }}
          >
            Sua conta não está autorizada para acessar a área administrativa de
            pesqueiros.
          </div>
        </div>
      </div>
    );
  }

  const db = adminDb();
  const snap = await db.collection("pesqueiros").orderBy("updatedAt", "desc").get();

  const items: AdminFisheryItem[] = snap.docs.map((doc) => {
    const data = doc.data() as any;

    return {
      id: doc.id,
      ownerId: data?.ownerId ?? doc.id,
      name: data?.name ?? "Sem nome",
      city: data?.city ?? "",
      state: data?.state ?? "",
      status: data?.status ?? "draft",
      phone: data?.phone ?? "",
      whatsapp: data?.whatsapp ?? "",
      instagram: data?.instagram ?? "",
      address: data?.address ?? "",
      description: data?.description ?? "",
      coverImage: data?.coverImage ?? "",
      fishTypes: Array.isArray(data?.fishTypes) ? data.fishTypes : [],
    };
  });

  return <AdminFisheriesClient initialItems={items} />;
}