import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { QueryProvider } from '../components/providers/QueryProvider';
import { ToastProvider } from '../components/ui/Toast';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Vilar DS — Plateforme de gestion',
  description: 'CRM · Facturation · RH — SARL Vilar DS',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={inter.className}>
        <QueryProvider>
          {children}
          <ToastProvider />
        </QueryProvider>
      </body>
    </html>
  );
}
