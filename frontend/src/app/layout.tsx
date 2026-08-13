import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

const instrument = Instrument_Serif({
  subsets: ["latin"],
  style: ["italic", "normal"],
  weight: ["400"],
  variable: "--font-display",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sentinelview.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "SentinelView — Real-Time Threat Intelligence Dashboard",
    template: "%s | SentinelView",
  },
  description:
    "Real-time cybersecurity threat monitoring console. Detect high-frequency network anomalies, brute-force storms, port scans, and data exfiltration mapped live onto an interactive 3D attack globe.",
  keywords: [
    "SentinelView",
    "cybersecurity dashboard",
    "threat intelligence",
    "real-time SIEM",
    "3D attack map",
    "network security monitor",
    "brute force detection",
    "port scan visualizer",
    "data exfiltration detection",
    "FastAPI Next.js security",
  ],
  authors: [{ name: "SentinelView Team" }],
  creator: "SentinelView",
  publisher: "SentinelView",
  icons: {
    icon: "/SentinelView_logo.png",
    shortcut: "/SentinelView_logo.png",
    apple: "/SentinelView_logo.png",
  },
  openGraph: {
    title: "SentinelView — Real-Time Threat Intelligence Dashboard",
    description:
      "Real-time cybersecurity threat monitoring console. Detect brute-force storms, port scans, and data exfiltrations live on a 3D attack globe.",
    url: appUrl,
    siteName: "SentinelView",
    images: [
      {
        url: "/SentinelView_logo.png",
        width: 1200,
        height: 630,
        alt: "SentinelView Threat Intelligence Platform Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SentinelView — Real-Time Threat Intelligence Dashboard",
    description:
      "Real-time cybersecurity threat monitoring console. Detect brute-force storms, port scans, and data exfiltrations live on a 3D attack globe.",
    images: ["/SentinelView_logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "SentinelView",
  "operatingSystem": "Web",
  "applicationCategory": "SecurityApplication",
  "description":
    "Real-time cybersecurity threat monitoring console and SIEM visualization engine.",
  "url": appUrl,
  "logo": `${appUrl}/SentinelView_logo.png`,
  "image": `${appUrl}/SentinelView_logo.png`,
  "publisher": {
    "@type": "Organization",
    "name": "SentinelView Security",
    "url": appUrl,
    "logo": `${appUrl}/SentinelView_logo.png`,
  },
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${jakarta.variable} ${instrument.variable} ${jetbrains.variable} font-sans antialiased bg-[#FAFAF8] text-[#111318]`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}



