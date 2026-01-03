import Link from "next/link";

import { WalletButton } from "@/components/WalletButton";
import { ChessGame } from "@/components/ChessGame";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

type PlayMode = "join" | "host" | "computer";

type ChessMode = "practice" | "wager";

const normalizeMode = (value: unknown): PlayMode | null => {
  if (typeof value !== "string") return null;
  if (value === "join" || value === "host" || value === "computer") return value;
  return null;
};

export default function GamePage({ searchParams }: PageProps) {
  const params = searchParams ?? {};
  const playMode = normalizeMode(params.mode);
  const isGuest = params.guest === "1";

  const initialMode: ChessMode = playMode === "computer" ? "practice" : "wager";
  const title =
    playMode === "join"
      ? "Join match"
      : playMode === "host"
        ? "Host match"
        : "Play vs computer";

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SolMate</h1>
          <p className="mt-1 text-sm text-neutral-300">{title}</p>
        </div>
        <WalletButton />
      </header>

      <div className="mt-6 flex items-center justify-between gap-4">
        <Link
          href={isGuest ? "/play?guest=1" : "/play"}
          className="text-sm text-neutral-300 hover:text-white"
        >
          ← Back
        </Link>
        {isGuest ? (
          <span className="text-xs text-neutral-400">Guest session</span>
        ) : null}
      </div>

      <section className="mt-6">
        <ChessGame initialMode={initialMode} showModeSelector={false} />
      </section>

      {!playMode ? (
        <p className="mt-4 text-xs text-neutral-400">
          No mode selected. Go back and choose Join, Host, or Computer.
        </p>
      ) : null}
    </main>
  );
}
