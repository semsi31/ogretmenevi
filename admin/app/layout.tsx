import './globals.css';
import Toaster from '@/components/Toaster';
import Script from 'next/script';

export const metadata = { title: 'Öğretmenevi Admin' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="p-6 max-w-6xl mx-auto">
        {!!process.env.NEXT_PUBLIC_SENTRY_DSN && (
          <Script id="sentry-init" strategy="afterInteractive">
            {`
              (function(){
                try {
                  if (!window.Sentry) {
                    // Minimal client init; replace with official loader if needed
                    window.Sentry = window.Sentry || {};
                  }
                } catch {}
              })();
            `}
          </Script>
        )}
        {children}
        <Toaster />
      </body>
    </html>
  );
}

