import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RELEVO — Datos que transforman',
  description: 'Dashboard de analítica educativa para equipos de gestión',
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
