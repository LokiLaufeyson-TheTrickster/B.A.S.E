import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'B.A.S.E. — Behavioral Analysis & Systematic Enforcement',
  description: 'Proactive behavioral warfare tool. Habit failure is a predictable technical error. Monitor Jitter. Predict decay. Execute or be decommissioned.',
  manifest: '/manifest.json',
  icons: { icon: '/assets/favicon.png', apple: '/assets/favicon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#000000',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
