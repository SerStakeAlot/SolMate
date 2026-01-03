"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { WalletButton } from "@/components/WalletButton";

type PlayMode = "join" | "host" | "computer";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function PlayPage({ searchParams }: PageProps) {
  const router = useRouter();
  const isGuest = searchParams?.guest === "1";

  const [mode, setMode] = useState<PlayMode | null>(null);

  const gameHref = useMemo(() => {
    const params = new URLSearchParams();
    if (mode) params.set("mode", mode);
    if (isGuest) params.set("guest", "1");
    return `/game?${params.toString()}`;
  }, [mode, isGuest]);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SolMate</h1>
          <p className="mt-1 text-sm text-neutral-300">
            Choose how you want to play.
          </p>
        </div>
        <WalletButton />
      </header>

      <section className="mt-10">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur shadow-2xl p-6 md:p-8">
          <h2 className="text-xl font-semibold">Match type</h2>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => setMode("join")}
              className={
                "rounded-xl border p-5 text-left transition-colors " +
                (mode === "join"
                  ? "border-white/30 bg-white/10"
                  : "border-white/10 bg-neutral-900/40 hover:bg-neutral-900/55")
              }
            >
              <div className="text-lg font-semibold">Join</div>
              <div className="mt-1 text-sm text-neutral-300">
                Join an existing match.
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode("host")}
              className={
                "rounded-xl border p-5 text-left transition-colors " +
                (mode === "host"
                  ? "border-white/30 bg-white/10"
                  : "border-white/10 bg-neutral-900/40 hover:bg-neutral-900/55")
              }
            >
              <div className="text-lg font-semibold">Host</div>
              <div className="mt-1 text-sm text-neutral-300">
                Create your own match.
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode("computer")}
              className={
                "rounded-xl border p-5 text-left transition-colors " +
                (mode === "computer"
                  ? "border-white/30 bg-white/10"
                  : "border-white/10 bg-neutral-900/40 hover:bg-neutral-900/55")
              }
            >
              <div className="text-lg font-semibold">Computer</div>
              <div className="mt-1 text-sm text-neutral-300">
                Practice locally vs the computer.
              </div>
            </button>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold bg-neutral-800 hover:bg-neutral-700 text-white transition-colors"
            >
              Back
            </button>

            <button
              type="button"
              disabled={!mode}
              onClick={() => router.push(gameHref)}
              className={
                "inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition-colors " +
                (mode
                  ? "bg-white/10 hover:bg-white/15 text-white"
                  : "bg-white/5 text-neutral-400 cursor-not-allowed")
              }
            >
              Start
            </button>
          </div>

          {isGuest ? (
            <p className="mt-4 text-xs text-neutral-400">
              You’re continuing without a wallet.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
