import './globals.css';
import { Outfit } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });

export const metadata = {
  title: "Artpar B2B",
  description: "Bayi yönetim sistemi ve B2B satış platformu",
};

import { ThemeProvider } from '@/components/ThemeProvider';
import { CartProvider } from '@/components/CartProvider';
import PWAInstaller from '@/components/PWAInstaller';
import MobileNav from '@/components/MobileNav';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

export default function RootLayout({ children }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Artpar B2B" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="192x192" href="/pwa-icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/pwa-icon-512.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/pwa-icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/pwa-icon-512.png" />
      </head>
      <body className={outfit.variable}>
        <ThemeProvider>
          <CartProvider>
            {children}
            <PWAInstaller />
            <MobileNav />
            <Analytics />
            <SpeedInsights />
          </CartProvider>
        </ThemeProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(registration) {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                  }, function(err) {
                    console.log('ServiceWorker registration failed: ', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
