import type { SongRequestStatus } from "../types";

export const SONG_STATUS_LABEL: Record<SongRequestStatus, string> = {
  pending: "ກຳລັງລໍຖ້າ",
  approved: "ຫຼິ້ນແລ້ວ",
  rejected: "ປະຕິເສດ",
};

export function songStatusClass(status: SongRequestStatus): string {
  if (status === "pending") return "bg-orange-100 text-orange-800";
  if (status === "approved") return "bg-emerald-100 text-emerald-800";
  return "bg-stone-200 text-stone-600";
}

export function isSongLink(title: string): boolean {
  return /^https?:\/\//i.test(title.trim());
}
