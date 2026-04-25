import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import ReaderHighlightStyles from "@/components/ReaderHighlightStyles";
import ShellGate from "@/components/ShellGate";
import { ThemeBridge } from "@/components/Theme/ThemeBridge";
import { AppShell } from "@/components/app-shell/AppShell";
import LocalFirstBoot from "@/components/local-first/LocalFirstBoot";
import StarshipAmbient from "@/components/starship/StarshipAmbient";
import { Toaster } from "@/components/ui/sonner";
import { getAppBaseUrl } from "@/lib/env/deployment";
import { ThemeProvider } from "@/providers/ThemeProvider";

import "./globals.css";

/* ── Fonts ─────────────────────────────────────────────────────────── */

const vazirmatn = localFont({
  src: "../../public/fonts/Vazirmatn[wght].woff2",
  variable: "--font-vazir",
  display: "swap",
  weight: "100 900",
});

export const runtime = "nodejs";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F7F9" },
    { media: "(prefers-color-scheme: dark)", color: "#1A1C1C" },
  ],
};

export const metadata: Metadata = {
  metadataBase: getAppBaseUrl(),
  title: "Hossein Starship",
  description: "Mission Control — Medical Study Platform",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Starship",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning className={vazirmatn.variable}>
      <head>
        <ReaderHighlightStyles />
        {/* PWA: Apple touch icon */}
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        {/* PWA: Splash screens for iPad */}
        <link rel="apple-touch-startup-image" href="/icons/splash-1024x1366.png" media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)" />
        <link rel="apple-touch-startup-image" href="/icons/splash-1668x2388.png" media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)" />
      </head>
      <body className="bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ThemeBridge />
          <ShellGate plain={<><StarshipAmbient />{children}</>} shell={<AppShell>{children}</AppShell>} />
          <LocalFirstBoot />
          <Toaster richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
