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
  const codeParam = searchParams.get("code");
  const tierParam = searchParams.get("tier");
  const freePlayCode = searchParams.get("freeplay"); // Join free play via link

  const initialMode: ChessMode = (playMode === "computer" || freePlayCode) ? "practice" : "wager";
  const stakeTier = tierParam ? parseInt(tierParam, 10) : 4; // Default to test tier
  const title =
    freePlayCode
      ? "Free Online Match"
      : playMode === "join"
        ? "Active Match (Black)"
        : playMode === "host"
          ? "Staked Match (White)"
          : "Practice Mode";
  
  // Determine player role for multiplayer
  const playerRole = playMode === "host" ? "host" : playMode === "join" ? "join" : undefined;

  return (
    <main className="mx-auto w-full max-w-7xl px-2 sm:px-4 py-4 sm:py-8">
      <div className="mb-4 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          <span className="text-gradient">{title}</span>
        </h1>
        <p className="text-neutral-500 text-sm mt-2">
          {playMode === "computer" 
            ? "Train your tactics" 
            : playMode === "join" 
              ? "You are playing as Black" 
              : playMode === "host"
                ? "You are playing as White - waiting for opponent"
                : "May the best strategist win"}
        </p>
      </div>

      <ChessGame
        initialMode={initialMode}
        showModeSelector={playMode === "computer" && !freePlayCode}
        matchPubkey={matchParam || undefined}
        playerRole={playerRole as "host" | "join" | undefined}
        matchCode={codeParam || undefined}
        initialStakeTier={stakeTier}
        freePlayJoinCode={freePlayCode || undefined}
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
