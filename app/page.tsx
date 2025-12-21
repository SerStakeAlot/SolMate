import Image from "next/image";
import { WalletButton } from "@/components/WalletButton";
import { ChessGame } from "@/components/ChessGame";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gradient-to-b from-gray-900 to-black">
      <div className="z-10 max-w-7xl w-full items-center justify-between font-mono text-sm lg:flex">
        <h1 className="text-4xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
          ♟️ SolMate
        </h1>
        <WalletButton />
      </div>

      <div className="mt-8 mb-4 text-center">
        <h2 className="text-2xl font-semibold mb-2">Welcome to SolMate</h2>
        <p className="text-gray-400">
          Play chess, wager SOL, and place side bets on matches
        </p>
      </div>

      <div className="mt-8 w-full max-w-4xl">
        <ChessGame />
      </div>

      <footer className="mt-16 text-center text-gray-500 text-sm">
        <p>Built on Solana • Powered by Anchor</p>
      </footer>
    </main>
  );
}
