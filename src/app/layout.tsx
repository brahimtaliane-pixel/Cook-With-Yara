import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "Cook with Yara — Mediterranean & Levantine Recipes",
    template: "%s | Cook with Yara",
  },
  description:
    "Mediterranean and Levantine recipes from Yara's kitchen. Fresh herbs, bold spices, and dishes worth gathering around.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://cookwithyara.com"
  ),
  openGraph: {
    siteName: "Cook with Yara",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/hero-yara-kitchen.webp",
        width: 1672,
        height: 941,
        alt: "Cook with Yara — Mediterranean & Levantine recipes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/hero-yara-kitchen.webp"],
  },
  alternates: {
    canonical: process.env.NEXT_PUBLIC_SITE_URL || "https://cookwithyara.com",
  },
  icons: {
    icon: "/favicon.ico",
    // To add iOS home-screen icon: drop a 180x180 PNG at app/apple-icon.png
    // (Next.js conventional file — no config needed).
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FEF7ED" },
    { media: "(prefers-color-scheme: dark)", color: "#9A3412" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${playfair.variable} font-sans antialiased`}
      >
        {/* AdSense loader. strategy="beforeInteractive" makes Next.js hoist
            this into the server-rendered <head>, matching what AdSense's
            "place between <head></head>" verification expects. Gated on the
            env var so non-prod builds don't load it. */}
        {process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID && (
          <Script
            id="adsense-loader"
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID}`}
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
        {children}
      </body>
    </html>
  );
}
