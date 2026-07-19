/**
 * Pure validation functions for form inputs.
 * Each function receives a string and returns:
 * - `null` if the value is valid
 * - A `string` error message if the value is invalid
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TENANT_CODE_REGEX = /^[A-Za-z0-9]+$/;

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'El email es obligatorio';
  if (!EMAIL_REGEX.test(email)) return 'Formato de email inválido';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'La contraseña es obligatoria';
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  return null;
}

export function validateName(name: string): string | null {
  if (!name.trim()) return 'El nombre es obligatorio';
  if (name.trim().length < 2) return 'El nombre debe tener al menos 2 caracteres';
  return null;
}

export function validateConfirmPassword(password: string, confirmPassword: string): string | null {
  if (!confirmPassword) return 'Debes confirmar tu contraseña';
  if (password !== confirmPassword) return 'Las contraseñas no coinciden';
  return null;
}

export function validateTenantCode(code: string): string | null {
  if (!code.trim()) return 'El código del colegio es obligatorio';
  if (!TENANT_CODE_REGEX.test(code.trim()))
    return 'El código debe ser alfanumérico (solo letras y números)';
  return null;
}
