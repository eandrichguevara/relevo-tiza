import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TIZA — Tu tiempo, tu enseñanza',
  description: 'Corrección automática de evaluaciones para profesores',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL">
      <body className={`${inter.className} bg-brand-light min-h-screen`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
