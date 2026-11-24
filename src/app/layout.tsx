import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";

// Barlow: grotesk berakar rambu jalan, terbaca jelas di layar yang kena
// matahari. Versi condensed untuk kode unit, nomor WO, dan angka besar.
const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sans",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-condensed",
});

export const metadata: Metadata = {
  title: "CECS — Company Equipment Control System",
  description: "Sistem kontrol dan histori unit teknik",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-square.png", sizes: "256x256", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/icon-square.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom tetap diizinkan (layar terkena matahari); input sudah 16px
  // sehingga iOS tidak auto-zoom saat fokus.
  viewportFit: "cover",
  themeColor: "#133462",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${barlow.variable} ${barlowCondensed.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased text-foreground">
        <NextTopLoader
          color="#133462"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow={false}
          zIndex={1600}
        />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
