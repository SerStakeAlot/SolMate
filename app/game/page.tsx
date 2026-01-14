import { ChessGame } from "@/components/ChessGame";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type PlayMode = "join" | "host" | "computer";

type ChessMode = "practice" | "wager";

const normalizeMode = (value: unknown): PlayMode | null => {
  if (typeof value !== "string") return null;
  if (value === "join" || value === "host" || value === "computer") return value;
  return null;
};

export default async function GamePage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const playMode = normalizeMode(params.mode);

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
        matchPubkey={typeof params.match === "string" ? params.match : undefined}
      />
    </main>
  );
}
