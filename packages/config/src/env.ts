export function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  TIZA_URL: process.env.NEXT_PUBLIC_TIZA_URL || 'http://localhost:3001',
  RELEVO_URL: process.env.NEXT_PUBLIC_RELEVO_URL || 'http://localhost:3002',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
};
