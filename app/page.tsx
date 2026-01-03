"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";

import { WalletButton } from "@/components/WalletButton";

export default function Home() {
  const router = useRouter();
  const { connected } = useWallet();

  const continueHref = useMemo(() => "/play", []);
  const continueGuestHref = useMemo(() => "/play?guest=1", []);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">SolMate</h1>
          <p className="mt-1 text-sm text-neutral-300">Solana chess, made simple.</p>
        </div>
        <WalletButton />
      </header>

      <section className="mt-10">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur shadow-2xl p-6 md:p-8">
          <h2 className="text-2xl font-semibold">Start playing</h2>
          <p className="mt-2 text-sm text-neutral-300">
            Connect a wallet to host/join wager matches, or continue as a guest.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              disabled={!connected}
              onClick={() => router.push(continueHref)}
              className={
                "inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition-colors " +
                (connected
                  ? "bg-white/10 hover:bg-white/15 text-white"
                  : "bg-white/5 text-neutral-400 cursor-not-allowed")
              }
            >
              Continue
            </button>

            <button
              type="button"
              onClick={() => router.push(continueGuestHref)}
              className="inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold bg-neutral-800 hover:bg-neutral-700 text-white transition-colors"
            >
              Continue without wallet
            </button>
          </div>

          {!connected ? (
            <p className="mt-4 text-xs text-neutral-400">
              Tip: use the Connect Wallet button in the top right.
            </p>
          ) : null}
        </div>
      </section>

      <footer className="mt-10 text-center text-neutral-500 text-sm">
        Built on Solana • Powered by Anchor
      </footer>
    </main>
  );
}
