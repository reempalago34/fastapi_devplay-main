import type { Metadata } from "next";
import Script from "next/script";
import { Fraunces, Bitter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { Providers } from "@/components/providers";
import { LangProvider } from "@/lib/i18n";
import { OfflineWatcher } from "@/components/devplay/shared/offline-watcher";
import { ADSENSE_CLIENT } from "@/lib/ads";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const bitter = Bitter({
  variable: "--font-bitter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DevPlay — Red social para devs de videojuegos indie",
  description: "Conecta creadores de juegos 2D/3D con testers. Descubre betas exclusivas, mira directos y únete a la comunidad.",
  keywords: ["DevPlay", "indie games", "game dev", "betas", "streaming", "comunidad"],
  authors: [{ name: "DevPlay" }],
  openGraph: {
    title: "DevPlay",
    description: "Red social para devs de videojuegos indie y testers",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${bitter.variable} ${fraunces.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <Providers>
            <LangProvider>
              {children}
              <Toaster />
              <SonnerToaster position="top-right" />
              {/* Sin internet → pantalla retro amable (misma del 404/error) */}
              <OfflineWatcher />
            </LangProvider>
          </Providers>
          {/* Google AdSense 📢 — solo se carga si NEXT_PUBLIC_ADSENSE_CLIENT está en .env */}
          {ADSENSE_CLIENT && (
            <Script
              async
              src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
              crossOrigin="anonymous"
              strategy="afterInteractive"
            />
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}
