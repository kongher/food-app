export const DEFAULT_PASSWORD = "123456";
export const PASSWORD_METER_SEGMENTS = 8;

const SPECIAL_RE = /[!@#$%^&*()_\-+=[\]{};:'"\\|,.<>/?`~]/;

export const PASSWORD_REQUIREMENT_ERROR =
  "ລະຫັດຜ່ານໃໝ່ຕ້ອງມີຢ່າງນ້ອຍ 8 ຕົວອັກສອນ, ລວມທັງຕົວພິມໃຫຍ່, ຕົວພິມນ້ອຍ, ໂຕເລກ ແລະ ອັກສອນພິເສດ";

export type PasswordRuleId = "length" | "lower" | "upper" | "digit" | "special";

export const PASSWORD_RULES: { id: PasswordRuleId; label: string; test: (password: string) => boolean }[] = [
  { id: "length", label: "ຢ່າງນ້ອຍ 8 ຕົວອັກສອນ", test: (password) => password.length >= 8 },
  { id: "lower", label: "ຕົວພິມນ້ອຍ (a-z)", test: (password) => /[a-z]/.test(password) },
  { id: "upper", label: "ຕົວພິມໃຫຍ່ (A-Z)", test: (password) => /[A-Z]/.test(password) },
  { id: "digit", label: "ຕົວເລກ (0-9)", test: (password) => /\d/.test(password) },
  { id: "special", label: "ອັກສອນພິເສດ (!@#$...)", test: (password) => SPECIAL_RE.test(password) },
];

export function isStrongPassword(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password)) && password !== DEFAULT_PASSWORD && password.length <= 100;
}

export function passwordPolicyError(password: string): string | null {
  if (!password) return "ກະລຸນາໃສ່ລະຫັດຜ່ານໃໝ່.";
  if (password.length > 100) return "ລະຫັດຜ່ານຍາວເກີນໄປ.";
  if (password === DEFAULT_PASSWORD) {
    return "ບໍ່ສາມາດໃຊ້ລະຫັດຜ່ານເລີ່ມຕົ້ນໄດ້. ກະລຸນາເລືອກລະຫັດທີ່ປອດໄພກວ່າ.";
  }
  if (!isStrongPassword(password)) return PASSWORD_REQUIREMENT_ERROR;
  return null;
}

export function passwordMeterScore(password: string): number {
  if (!password) return 0;
  if (isStrongPassword(password)) return PASSWORD_METER_SEGMENTS;

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 10) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (SPECIAL_RE.test(password)) score += 1;
  if (password.length >= 14) score += 1;
  return Math.min(PASSWORD_METER_SEGMENTS - 1, score);
}

export type PasswordMeterTone = "empty" | "weak" | "fair" | "strong";

export function passwordMeterTone(password: string): PasswordMeterTone {
  if (!password) return "empty";
  if (isStrongPassword(password)) return "strong";
  return passwordMeterScore(password) <= 3 ? "weak" : "fair";
}

export function passwordMeterLabel(tone: PasswordMeterTone): string {
  if (tone === "strong") return "ແຂງແຮງ";
  if (tone === "fair") return "ປານກາງ";
  if (tone === "weak") return "ອ່ອນ";
  return "";
}
