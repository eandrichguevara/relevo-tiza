export const BRAND = {
  TIZA: 'tiza' as const,
  RELEVO: 'relevo' as const,
} as const;

export const ROLES = {
  TEACHER: 'TEACHER',
  HOLDER: 'HOLDER',
  ADMIN: 'ADMIN',
} as const;

export const PORTS = {
  TIZA_WEB: 3001,
  RELEVO_WEB: 3002,
  API: 8000,
  POSTGRES: 5432,
  REDIS: 6379,
} as const;

export const CONFIDENCE_THRESHOLD = 0.65;

export const SUBJECTS = ['Lenguaje', 'Matemáticas', 'Ciencias', 'Historia', 'Inglés'] as const;

export const GRADES = [
  '1° básico',
  '2° básico',
  '3° básico',
  '4° básico',
  '5° básico',
  '6° básico',
  '7° básico',
  '8° básico',
  'I medio',
  'II medio',
  'III medio',
  'IV medio',
] as const;

export const QUESTION_TYPES = ['multiple_choice', 'written'] as const;

export const BRAND_THEMES = {
  tiza: {
    name: 'TIZA',
    tagline: 'Tu tiempo, tu enseñanza',
    primary: '#F4813D',
    primaryLight: '#FFF8F0',
    secondary: '#2D3748',
    accent: '#ED8936',
  },
  relevo: {
    name: 'RELEVO',
    tagline: 'Datos que transforman',
    primary: '#1A3A5C',
    primaryLight: '#EBF4FF',
    secondary: '#4A5568',
    accent: '#2B6CB0',
  },
} as const;
