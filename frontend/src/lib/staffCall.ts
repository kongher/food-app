import type { StaffCall } from "../types";

export function staffCallTimes(call: StaffCall): number {
  return Math.max(1, Number(call.times) || 1);
}

export function staffCallWhen(call: StaffCall): string {
  return call.updatedAt || call.createdAt;
}

export function staffCallLabel(call: StaffCall): string {
  const times = staffCallTimes(call);
  if (times <= 1) return call.message;
  return `${call.message} (ເອີ້ນ ${times} ຄັ້ງ)`;
}
