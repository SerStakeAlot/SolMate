'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

import { Chess } from 'chess.js';

type Mode = 'practice' | 'wager';

type ChessGameProps = {
  initialMode?: Mode;
  showModeSelector?: boolean;
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

const pieceToUnicode = (piece: { type: string; color: string } | null): string => {
  if (!piece) return '';
  const isWhite = piece.color === 'w';
  switch (piece.type) {
    case 'k':
      return isWhite ? '♔' : '♚';
    case 'q':
      return isWhite ? '♕' : '♛';
    case 'r':
      return isWhite ? '♖' : '♜';
    case 'b':
      return isWhite ? '♗' : '♝';
    case 'n':
      return isWhite ? '♘' : '♞';
    case 'p':
      return isWhite ? '♙' : '♟';
    default:
      return '';
  }
};

const squareFromRowCol = (row: number, col: number) => {
  const file = FILES[col];
  const rank = 8 - row;
  return `${file}${rank}`;
};

export const ChessGame: React.FC<ChessGameProps> = ({
  initialMode = 'practice',
  showModeSelector = true,
}) => {
  const { connected } = useWallet();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [wagerAmount, setWagerAmount] = useState('0.1');

  const chessRef = useRef<Chess | null>(null);
  if (!chessRef.current) {
    chessRef.current = new Chess();
  }

  const [fen, setFen] = useState(() => chessRef.current!.fen());
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

  const board = useMemo(() => {
    // chess.js board() is always 8x8 from rank 8 -> 1
    return chessRef.current!.board();
  }, [fen]);

  const legalDestinations = useMemo(() => {
    if (!selectedSquare) return new Set<string>();
    const moves = chessRef.current!.moves({ square: selectedSquare as any, verbose: true }) as Array<any>;
    return new Set(moves.map((m) => m.to));
  }, [selectedSquare, fen]);

  const statusText = useMemo(() => {
    const chess = chessRef.current!;
    if (chess.isCheckmate()) return 'Checkmate';
    if (chess.isStalemate()) return 'Stalemate';
    if (chess.isDraw()) return 'Draw';
    const side = chess.turn() === 'w' ? 'White' : 'Black';
    return chess.isCheck() ? `Check — ${side} to move` : `${side} to move`;
  }, [fen]);

  const resetPractice = () => {
    chessRef.current = new Chess();
    setSelectedSquare(null);
    setFen(chessRef.current.fen());
  };

  const maybeAutoPromote = (from: string, to: string) => {
    const chess = chessRef.current!;
    const piece = chess.get(from as any) as any;
    if (!piece || piece.type !== 'p') return undefined;
    const toRank = Number(to[1]);
    if (piece.color === 'w' && toRank === 8) return 'q';
    if (piece.color === 'b' && toRank === 1) return 'q';
    return undefined;
  };

  const playComputerMove = () => {
    const chess = chessRef.current!;
    if (chess.isGameOver()) return;
    if (chess.turn() !== 'b') return;

    const moves = chess.moves({ verbose: true }) as Array<any>;
    if (moves.length === 0) return;

    const choice = moves[Math.floor(Math.random() * moves.length)];
    chess.move({
      from: choice.from,
      to: choice.to,
      promotion: choice.promotion ?? maybeAutoPromote(choice.from, choice.to),
    } as any);
    setFen(chess.fen());
  };

  const onSquareClick = (square: string) => {
    const chess = chessRef.current!;

    if (chess.isGameOver()) return;

    if (mode === 'practice') {
      // Player is always White in practice mode.
      if (chess.turn() !== 'w') return;
    }

    if (!selectedSquare) {
      const piece = chess.get(square as any) as any;
      if (!piece) return;
      if (mode === 'practice' && piece.color !== 'w') return;
      if (mode === 'wager' && piece.color !== chess.turn()) return;
      setSelectedSquare(square);
      return;
    }

    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }

    const promotion = maybeAutoPromote(selectedSquare, square);
    const move = chess.move({
      from: selectedSquare,
      to: square,
      promotion,
    } as any);

    if (!move) return;
    setSelectedSquare(null);
    setFen(chess.fen());
  };

  useEffect(() => {
    if (mode !== 'practice') return;
    const chess = chessRef.current!;
    if (chess.turn() !== 'b') return;
    if (chess.isGameOver()) return;

    const t = setTimeout(() => {
      playComputerMove();
    }, 250);

    return () => clearTimeout(t);
  }, [fen, mode]);

  const getPieceClassName = (piece: { color: string } | null) => {
    if (!piece) return '';
    return piece.color === 'w'
      ? 'text-slate-50 drop-shadow-md'
      : 'text-slate-900 drop-shadow-md';
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur shadow-2xl p-6 md:p-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Chess Board Placeholder */}
        <div className="md:col-span-2">
          <div className="rounded-xl border border-white/10 bg-neutral-900/40 p-3 shadow-inner">
            <div className="aspect-square w-full max-w-sm md:max-w-md mx-auto overflow-hidden rounded-lg ring-1 ring-black/10">
              <div className="grid h-full w-full grid-cols-8 grid-rows-8">
                {Array.from({ length: 64 }).map((_, i) => {
                  const row = Math.floor(i / 8);
                  const col = i % 8;
                  const isLight = (row + col) % 2 === 0;
                  const square = squareFromRowCol(row, col);
                  const piece = board[row]?.[col] ?? null;
                  const symbol = pieceToUnicode(piece as any);

                  const isSelected = selectedSquare === square;
                  const isLegal = legalDestinations.has(square);

                  return (
                    <button
                      type="button"
                      key={i}
                      onClick={() => onSquareClick(square)}
                      className={`relative flex items-center justify-center select-none leading-none transition-colors border border-black/10 ${
                        isLight ? 'bg-amber-100' : 'bg-emerald-600'
                      } ${
                        isSelected ? 'ring-2 ring-purple-400/80 ring-inset' : ''
                      } ${
                        isLegal ? 'ring-2 ring-purple-400/40 ring-inset' : ''
                      }`}
                      aria-label={symbol ? `${square} ${symbol}` : square}
                    >
                      <span
                        className={
                          piece
                            ? `${getPieceClassName(piece as any)} text-[clamp(20px,4vw,38px)]`
                            : ''
                        }
                        aria-hidden="true"
                      >
                        {symbol}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <p className="text-center text-neutral-300 mt-4 text-sm">
            {mode === 'practice' ? `Practice vs Computer — ${statusText}` : statusText}
          </p>
        </div>

        {/* Game Controls */}
        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-neutral-900/40 p-6">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-xl font-semibold">Game Mode</h3>
              {showModeSelector ? (
                <div className="inline-flex rounded-lg border border-white/10 bg-neutral-950/40 p-1">
                  <button
                    type="button"
                    onClick={() => setMode('practice')}
                    className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                      mode === 'practice'
                        ? 'bg-white/10 text-white'
                        : 'text-neutral-300 hover:text-white'
                    }`}
                  >
                    Practice
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('wager')}
                    className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                      mode === 'wager'
                        ? 'bg-white/10 text-white'
                        : 'text-neutral-300 hover:text-white'
                    }`}
                  >
                    Wager
                  </button>
                </div>
              ) : null}
            </div>

            <div className="mt-4">
              {mode === 'practice' ? (
                <div className="space-y-4">
                  <p className="text-sm text-neutral-300">
                    No wallet required. You play White; the computer plays Black.
                  </p>
                  <button
                    type="button"
                    onClick={resetPractice}
                    className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-semibold py-3 px-6 rounded-lg transition-all"
                  >
                    Reset Practice Game
                  </button>
                  <p className="text-xs text-neutral-400">
                    Computer currently chooses a random legal move.
                  </p>
                </div>
              ) : (
                <>
                  <h4 className="text-lg font-semibold mb-4">Game Settings</h4>
            
            {connected ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Wager Amount (SOL)
                  </label>
                  <input
                    type="number"
                    value={wagerAmount}
                    onChange={(e) => setWagerAmount(e.target.value)}
                    className="w-full px-4 py-2 bg-neutral-950/60 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    step="0.01"
                    min="0"
                  />
                </div>

                <button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-lg transition-all">
                  Create Game
                </button>

                <button className="w-full bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-6 rounded-lg transition-all">
                  Join Game
                </button>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-4">
                  Connect your wallet to play
                </p>
                <div className="text-4xl mb-2">🔒</div>
              </div>
            )}
                </>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-neutral-900/40 p-6">
            <h3 className="text-xl font-semibold mb-4">Side Bets</h3>
            <p className="text-gray-400 text-sm mb-4">
              Place bets on ongoing matches
            </p>
            <div className="space-y-2">
              <div className="bg-gray-800 p-3 rounded">
                <p className="text-xs text-gray-400">No active games</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-neutral-900/40 p-6">
            <h3 className="text-xl font-semibold mb-4">Your Stats</h3>
            {connected ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Games Played:</span>
                  <span className="font-semibold">0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Wins:</span>
                  <span className="font-semibold text-green-400">0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Wagered:</span>
                  <span className="font-semibold">0 SOL</span>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-sm">Connect wallet to view stats</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
