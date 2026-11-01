import type { Metadata, Viewport } from 'next';
import { ToastProvider } from '@/components/ui/Toast';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Requirement Board · Abacus Spaces', template: '%s · Abacus Requirement Board' },
  description: 'Abacus Spaces requirement board for retail property brokers and the Abacus team.',
  robots: { index: false, follow: false },
  icons: { icon: '/abacus-logo.png' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#7F1416' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap"
        />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
