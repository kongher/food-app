export const DEFAULT_PASSWORD = "123456";

const SPECIAL_RE = /[!@#$%^&*()_\-+=[\]{};:'"\\|,.<>/?`~]/;

export const PASSWORD_REQUIREMENT_ERROR =
  "ລະຫັດຜ່ານໃໝ່ຕ້ອງມີຢ່າງນ້ອຍ 8 ຕົວອັກສອນ, ລວມທັງຕົວພິມໃຫຍ່, ຕົວພິມນ້ອຍ, ໂຕເລກ ແລະ ອັກສອນພິເສດ";

export function hasLowercase(password: string): boolean {
  return /[a-z]/.test(password);
}

export function hasUppercase(password: string): boolean {
  return /[A-Z]/.test(password);
}

export function hasDigit(password: string): boolean {
  return /\d/.test(password);
}

export function hasSpecial(password: string): boolean {
  return SPECIAL_RE.test(password);
}

export function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    password.length <= 100 &&
    hasLowercase(password) &&
    hasUppercase(password) &&
    hasDigit(password) &&
    hasSpecial(password) &&
    password !== DEFAULT_PASSWORD
  );
}

export function passwordPolicyError(password: string): string | null {
  if (!password) return "ກະລຸນາໃສ່ລະຫັດຜ່ານໃໝ່.";
  if (password.length > 100) return "ລະຫັດຜ່ານຍາວເກີນໄປ.";
  if (password === DEFAULT_PASSWORD) return "ບໍ່ສາມາດໃຊ້ລະຫັດຜ່ານເລີ່ມຕົ້ນໄດ້. ກະລຸນາເລືອກລະຫັດທີ່ປອດໄພກວ່າ.";
  if (!isStrongPassword(password)) return PASSWORD_REQUIREMENT_ERROR;
  return null;
}
