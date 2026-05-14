import "server-only";

export function isAdminUid(uid: string | null | undefined) {
  if (!uid) return false;

  const raw = process.env.ADMIN_UIDS || "";

  const adminUids = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return adminUids.includes(uid);
}