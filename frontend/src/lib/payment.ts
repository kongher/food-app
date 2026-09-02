import type { PaymentMethod } from "../types";

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "ເງິນສົດ",
  transfer: "ໂອນເງິນ",
};

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === "cash" || value === "transfer";
}

export function orderReportAt(order: { paidAt?: string; createdAt: string }): string {
  return order.paidAt || order.createdAt;
}
