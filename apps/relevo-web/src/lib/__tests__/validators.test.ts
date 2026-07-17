import { describe, it, expect } from 'vitest';
import {
  validateName,
  validateSchool,
  validateEmail,
  validatePassword,
  validateConfirmPassword,
} from '@/lib/validators';

describe('validateName', () => {
  it('retorna null para un nombre válido', () => {
    expect(validateName('María')).toBeNull();
    expect(validateName('Juan Pérez')).toBeNull();
    expect(validateName('An')).toBeNull();
  });

  it('retorna mensaje de error para nombre vacío', () => {
    expect(validateName('')).toBe('El nombre es obligatorio');
    expect(validateName('   ')).toBe('El nombre es obligatorio');
  });

  it('retorna mensaje de error para nombre de menos de 2 caracteres', () => {
    expect(validateName('A')).toBe('El nombre debe tener al menos 2 caracteres');
    expect(validateName(' a ')).toBe('El nombre debe tener al menos 2 caracteres');
  });
});

describe('validateSchool', () => {
  it('retorna null para un nombre de colegio válido', () => {
    expect(validateSchool('Colegio San Martín')).toBeNull();
    expect(validateSchool('A')).toBeNull();
    expect(validateSchool('  Instituto Nacional  ')).toBeNull();
  });

  it('retorna mensaje de error para nombre de colegio vacío', () => {
    expect(validateSchool('')).toBe('El nombre del colegio es obligatorio');
    expect(validateSchool('   ')).toBe('El nombre del colegio es obligatorio');
  });
});

describe('validateEmail', () => {
  it('retorna null para un email válido', () => {
    expect(validateEmail('director@colegio.cl')).toBeNull();
    expect(validateEmail('user@example.com')).toBeNull();
    expect(validateEmail('a.b@c.co')).toBeNull();
  });

  it('retorna mensaje de error para un email inválido', () => {
    expect(validateEmail('invalido')).toBe('Formato de email inválido');
    expect(validateEmail('@dominio.com')).toBe('Formato de email inválido');
    expect(validateEmail('usuario@')).toBe('Formato de email inválido');
    expect(validateEmail('usuario@dominio')).toBe('Formato de email inválido');
    expect(validateEmail('usuario @dominio.com')).toBe('Formato de email inválido');
  });

  it('retorna mensaje de error para email vacío', () => {
    expect(validateEmail('')).toBe('El email es obligatorio');
    expect(validateEmail('   ')).toBe('El email es obligatorio');
  });
});

describe('validatePassword', () => {
  it('retorna null para una contraseña válida (≥ 8 caracteres)', () => {
    expect(validatePassword('12345678')).toBeNull();
    expect(validatePassword('abcdefgh')).toBeNull();
    expect(validatePassword('secreto!')).toBeNull();
    expect(validatePassword('a'.repeat(100))).toBeNull();
  });

  it('retorna mensaje de error para contraseña corta (< 8 caracteres)', () => {
    expect(validatePassword('1234567')).toBe('La contraseña debe tener al menos 8 caracteres');
    expect(validatePassword('a')).toBe('La contraseña debe tener al menos 8 caracteres');
    expect(validatePassword('123456')).toBe('La contraseña debe tener al menos 8 caracteres');
  });

  it('retorna mensaje de error para contraseña vacía', () => {
    expect(validatePassword('')).toBe('La contraseña es obligatoria');
    expect(validatePassword('')).not.toBeNull();
  });
});

describe('validateConfirmPassword', () => {
  it('retorna null cuando las contraseñas coinciden', () => {
    expect(validateConfirmPassword('secreto123', 'secreto123')).toBeNull();
    expect(validateConfirmPassword('abc', 'abc')).toBeNull();
  });

  it('retorna mensaje de error cuando las contraseñas no coinciden', () => {
    expect(validateConfirmPassword('secreto123', 'otra')).toBe('Las contraseñas no coinciden');
    expect(validateConfirmPassword('abc', 'cba')).toBe('Las contraseñas no coinciden');
  });

  it('retorna mensaje de error cuando confirmación está vacía', () => {
    expect(validateConfirmPassword('secreto123', '')).toBe('Debes confirmar tu contraseña');
  });
});
