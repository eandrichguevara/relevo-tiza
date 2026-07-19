/**
 * Pure validation functions for form inputs.
 * Each function receives a string and returns:
 * - `null` if the value is valid
 * - A `string` error message if the value is invalid
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateName(name: string): string | null {
  if (!name.trim()) return 'El nombre es obligatorio';
  if (name.trim().length < 2) return 'El nombre debe tener al menos 2 caracteres';
  return null;
}

export function validateSchool(school: string): string | null {
  if (!school.trim()) return 'El nombre del colegio es obligatorio';
  return null;
}

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

export function validateConfirmPassword(password: string, confirmPassword: string): string | null {
  if (!confirmPassword) return 'Debes confirmar tu contraseña';
  if (password !== confirmPassword) return 'Las contraseñas no coinciden';
  return null;
}
