import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#1A3A5C',
          light: '#EBF4FF',
          accent: '#2B6CB0',
          secondary: '#4A5568',
        },
      },
    },
  },
  plugins: [],
};

export default config;
