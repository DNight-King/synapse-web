import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "@/i18n/config";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { AMBER, BG0 } from "@/lib/constants";
import { ToastProvider } from "@/components/ui/Toast";
import { SorobanProvider } from "@/lib/soroban/SorobanProvider";
import { WalletProvider } from "@/lib/wallet/WalletProvider";
import { FlagProvider } from "@/lib/flags/FlagProvider";
import { WebVitalsReporter } from "@/components/telemetry/WebVitalsReporter";
import { LiveRegion } from "@/components/ui/LiveRegion";
import "./globals.css";

/**
 * Self-hosted at build time by next/font/google with latin subsetting,
 * preloading, display: "swap", and automated fallback metric adjustments
 * to eliminate cumulative layout shift (CLS).
 */
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: true,
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
  adjustFontFallback: true,
  variable: "--font-ibm-plex-mono",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

const title = "Synapse Core · Testnet";
const description = "Soroban transaction lifecycle dashboard";

export const viewport: Viewport = {
  themeColor: BG0,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "512x512" }],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
    shortcut: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Synapse Core",
    title,
    description,
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Synapse Core — Soroban transaction lifecycle dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/twitter-image.png"],
  },
  other: {
    "msapplication-TileColor": AMBER,
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  return (
    <html lang={locale} className={ibmPlexMono.variable}>
      <body className="scanline-overlay">
        <I18nProvider locale={locale}>
          <LiveRegion />
          <WebVitalsReporter />
          <ToastProvider>
            <SorobanProvider
              rpcUrl={process.env.NEXT_PUBLIC_SOROBAN_RPC_URL}
              defaultContractId={process.env.NEXT_PUBLIC_CONTRACT_ID}
            >
              <WalletProvider>
                {/*
                  Outermost of the app providers so any component can read a flag.
                  It renders children immediately against registry defaults and
                  upgrades to the remote config in an effect, so SSR and the first
                  client render always agree — see lib/flags/FlagProvider.tsx.
                */}
                <FlagProvider>{children}</FlagProvider>
              </WalletProvider>
            </SorobanProvider>
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
