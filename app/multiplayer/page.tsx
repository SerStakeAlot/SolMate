import { MultiplayerChess } from "@/components/MultiplayerChess";

export default function MultiplayerPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
          <span className="text-gradient">Multiplayer Match</span>
        </h1>
        <p className="text-neutral-400 text-sm mt-2 font-medium">
          Real-time chess with automatic matchmaking
        </p>
      </div>

      <MultiplayerChess />
    </main>
  );
}
