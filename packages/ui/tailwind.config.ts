import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', '../../apps/*/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        tiza: {
          primary: '#F4813D',
          light: '#FFF8F0',
          accent: '#ED8936',
          secondary: '#2D3748',
        },
        relevo: {
          primary: '#1A3A5C',
          light: '#EBF4FF',
          accent: '#2B6CB0',
          secondary: '#4A5568',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
