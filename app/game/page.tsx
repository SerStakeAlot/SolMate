"use client";

import { ChessGame } from "@/components/ChessGame";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

type PlayMode = "join" | "host" | "computer";

type ChessMode = "practice" | "wager";

const normalizeMode = (value: string | null): PlayMode | null => {
  if (value === "join" || value === "host" || value === "computer") return value;
  return null;
};

function GameContent() {
  const searchParams = useSearchParams();
  const playMode = normalizeMode(searchParams.get("mode"));
  const matchParam = searchParams.get("match");

  const initialMode: ChessMode = playMode === "computer" ? "practice" : "wager";
  const title =
    playMode === "join"
      ? "Active Match"
      : playMode === "host"
        ? "Staked Match"
        : "Practice Mode";

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="text-gradient">{title}</span>
        </h1>
        <p className="text-neutral-500 text-sm mt-2">
          {playMode === "computer" ? "Train your tactics against AI" : "May the best strategist win"}
        </p>
      </div>

      <ChessGame
        initialMode={initialMode}
        showModeSelector={playMode === "computer"}
        matchPubkey={matchParam || undefined}
      />
    </main>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-7xl px-4 py-8">Loading...</div>}>
      <GameContent />
    </Suspense>
  );
}
