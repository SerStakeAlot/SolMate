import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/components/WalletProvider";
import { Navigation } from "@/components/Navigation";
import { WalletBalanceWarning } from "@/components/WalletBalanceWarning";

export const metadata: Metadata = {
  title: "SolMate - Tactical Chess on Solana",
  description: "Compete in staked chess matches on Solana blockchain",
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
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-[#050505] text-white antialiased bg-mesh">
        <WalletProvider>
          <div className="relative min-h-screen">
            {/* Subtle animated gradient orbs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-40 -right-40 w-80 h-80 bg-solana-purple/20 rounded-full blur-[100px] animate-pulse-slow" />
              <div className="absolute top-1/2 -left-40 w-96 h-96 bg-solana-green/10 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
              <div className="absolute -bottom-40 right-1/3 w-72 h-72 bg-solana-purple/15 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '4s' }} />
            </div>
            
            <Navigation />
            <main className="relative z-10">
              {children}
            </main>
            <WalletBalanceWarning />
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
