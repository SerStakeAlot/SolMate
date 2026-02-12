import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/components/WalletProvider";
import { Navigation } from "@/components/Navigation";
import { WalletBalanceWarning } from "@/components/WalletBalanceWarning";
import { ClickSounds } from "@/components/ClickSounds";

export const metadata: Metadata = {
  title: "SolMate - Tactical Chess on Solana",
  description: "Compete in staked chess matches on Solana blockchain. Play free or stake SOL in competitive chess matches.",
  manifest: "/manifest.json",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  themeColor: "#9945FF",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SolMate",
  },
  openGraph: {
    title: "SolMate - Tactical Chess on Solana",
    description: "Compete in staked chess matches on Solana blockchain. Play free or stake SOL in competitive chess matches.",
    url: "https://playsolmate.fun",
    siteName: "SolMate",
    images: [
      {
        url: "https://playsolmate.fun/images/og-banner.png",
        width: 1200,
        height: 630,
        alt: "SolMate - Chess on Solana",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SolMate - Tactical Chess on Solana",
    description: "Compete in staked chess matches on Solana blockchain. Play free or stake SOL!",
    images: ["https://playsolmate.fun/images/og-banner.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Inter for body text - clean and modern */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        {/* Space Grotesk for headings - distinctive gaming feel */}
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
        {/* JetBrains Mono for numbers/codes - professional */}
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet" />
        {/* Outfit for Arena pages */}
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-[#07070e] text-white antialiased">
        <WalletProvider>
          <div className="relative min-h-screen">
            {/* Subtle animated gradient orbs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-40 -right-40 w-80 h-80 bg-solana-purple/10 rounded-full blur-[100px] animate-pulse-slow" />
              <div className="absolute top-1/2 -left-40 w-96 h-96 bg-solana-green/5 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
              <div className="absolute -bottom-40 right-1/3 w-72 h-72 bg-solana-purple/8 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '4s' }} />
            </div>
            
            <Navigation />
            <main className="relative z-10" style={{ paddingTop: 72 }}>
              {children}
            </main>
            <WalletBalanceWarning />
            <ClickSounds />
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
