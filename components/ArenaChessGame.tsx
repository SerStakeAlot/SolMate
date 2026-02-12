'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Chess, Square, Move } from 'chess.js';
import { RotateCcw, Flag, Clock, Cpu, User, Bot } from 'lucide-react';
import { ArenaResultModal } from './ArenaResultModal';
import { shareToX } from '@/utils/shareToX';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://solmate-production.up.railway.app';

// Arena constants
const MAX_GAMES_PER_DAY = 20;
const MIN_MOVES_TO_COUNT = 10;
const COOLDOWN_SECONDS = 30;
const AI_THINK_TIME_MS = 150; // AI "thinks" for realism
const AI_MAX_DEPTH = 6; // Maximum iterative deepening depth
const AI_TIME_LIMIT_MS = 1500; // Time budget for search (ms) - ensures ~1500 ELO strength
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

// Piece SVG paths
const PIECE_PATHS: Record<string, string> = {
  wK: '/pieces/wK.svg', wQ: '/pieces/wQ.svg', wR: '/pieces/wR.svg',
  wB: '/pieces/wB.svg', wN: '/pieces/wN.svg', wP: '/pieces/wP.svg',
  bK: '/pieces/bK.svg', bQ: '/pieces/bQ.svg', bR: '/pieces/bR.svg',
  bB: '/pieces/bB.svg', bN: '/pieces/bN.svg', bP: '/pieces/bP.svg',
};

// Piece display symbols for captured pieces
const PIECE_SYMBOLS: Record<string, string> = {
  P: '♙', N: '♘', B: '♗', R: '♖', Q: '♕',
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛',
};

// Captured pieces tracker
const getCapturedPieces = (chess: Chess) => {
  const initialPieces = { w: { p: 8, n: 2, b: 2, r: 2, q: 1 }, b: { p: 8, n: 2, b: 2, r: 2, q: 1 } };
  const currentPieces = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  
  const board = chess.board();
  for (const row of board) {
    for (const piece of row) {
      if (piece && piece.type !== 'k') {
        currentPieces[piece.color][piece.type as 'p' | 'n' | 'b' | 'r' | 'q']++;
      }
    }
  }
  
  const createPieceGroups = (capturedBy: 'w' | 'b') => {
    const result: { piece: string; count: number }[] = [];
    const pieceOrder: ('q' | 'r' | 'b' | 'n' | 'p')[] = ['q', 'r', 'b', 'n', 'p'];
    const pieceValues: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
    const victimColor = capturedBy === 'w' ? 'b' : 'w';
    
    for (const type of pieceOrder) {
      const initial = capturedBy === 'w' ? initialPieces.b[type] : initialPieces.w[type];
      const current = capturedBy === 'w' ? currentPieces.b[type] : currentPieces.w[type];
      const captured = initial - current;
      if (captured > 0) {
        result.push({ piece: victimColor === 'w' ? type.toUpperCase() : type, count: captured });
      }
    }
    return result;
  };
  
  const getMaterialTotal = (capturedBy: 'w' | 'b') => {
    const pieceValues: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
    const pieceOrder: ('q' | 'r' | 'b' | 'n' | 'p')[] = ['q', 'r', 'b', 'n', 'p'];
    let total = 0;
    for (const type of pieceOrder) {
      const initial = capturedBy === 'w' ? initialPieces.b[type] : initialPieces.w[type];
      const current = capturedBy === 'w' ? currentPieces.b[type] : currentPieces.w[type];
      total += (initial - current) * pieceValues[type];
    }
    return total;
  };
  
  const wTotal = getMaterialTotal('w');
  const bTotal = getMaterialTotal('b');
  
  return {
    wGroups: createPieceGroups('w'),
    bGroups: createPieceGroups('b'),
    wAdvantage: wTotal - bTotal,
    bAdvantage: bTotal - wTotal,
  };
};

// Sound effects hook
const useChessSounds = () => {
  const soundsRef = useRef<{
    move: HTMLAudioElement | null;
    capture: HTMLAudioElement | null;
    check: HTMLAudioElement | null;
    castle: HTMLAudioElement | null;
  } | null>(null);
  const initializedRef = useRef(false);
  
  const getOrCreateSounds = useCallback(() => {
    if (typeof window === 'undefined') return null;
    
    if (!soundsRef.current && !initializedRef.current) {
      initializedRef.current = true;
      const move = new Audio('/sounds/move.ogg');
      const capture = new Audio('/sounds/capture.ogg');
      const check = new Audio('/sounds/check.ogg');
      const castle = new Audio('/sounds/castle.ogg');
      
      [move, capture, check, castle].forEach(audio => {
        audio.load();
        audio.volume = 0.5;
      });
      
      soundsRef.current = { move, capture, check, castle };
    }
    return soundsRef.current;
  }, []);
  
  const playSound = useCallback((type: 'move' | 'capture' | 'check' | 'castle') => {
    const sounds = getOrCreateSounds();
    if (!sounds) return;
    
    const audio = sounds[type];
    if (audio) {
      const clone = audio.cloneNode() as HTMLAudioElement;
      clone.volume = 0.5;
      clone.play().catch(() => {});
    }
  }, [getOrCreateSounds]);
  
  return { playSound };
};

interface ArenaChessGameProps {
  walletAddress: string;
  onGameEnd: () => void;
}

interface ArenaStats {
  matchesPlayed: number;
  wins: number;
  score: number;
  rank: number;
  gamesRemainingToday: number;
  cooldownEndsAt?: number;
}

export function ArenaChessGame({ walletAddress, onGameEnd }: ArenaChessGameProps) {
  // Sound effects
  const { playSound } = useChessSounds();
  
  // Game state
  const [chess] = useState(() => new Chess());
  const [board, setBoard] = useState(chess.board());
  const [playerColor] = useState<'w' | 'b'>('w'); // Player is always white
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [validMoves, setValidMoves] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [moveCount, setMoveCount] = useState(0);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);
  
  // Result state
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState<'win' | 'loss' | 'draw' | null>(null);
  const [arenaStats, setArenaStats] = useState<ArenaStats | null>(null);
  
  // Share tracking
  const [hasShared, setHasShared] = useState(false);
  const [shareBonus, setShareBonus] = useState<number | null>(null);
  
  // Time control (10 min per side)
  const [playerTime, setPlayerTime] = useState(600);
  const [aiTime, setAiTime] = useState(600);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Check remaining games
  const [canPlay, setCanPlay] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check if player can start a game
  useEffect(() => {
    const checkCanPlay = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/arena/status/${walletAddress}`);
        const data = await res.json();
        
        if (data.gamesRemainingToday <= 0) {
          setCanPlay(false);
          setErrorMessage(`Daily limit reached (${MAX_GAMES_PER_DAY} games). Try again tomorrow!`);
        } else if (data.cooldownEndsAt && Date.now() < data.cooldownEndsAt) {
          const remaining = Math.ceil((data.cooldownEndsAt - Date.now()) / 1000);
          setCanPlay(false);
          setErrorMessage(`Cooldown active. Wait ${remaining} seconds.`);
        }
        
        setArenaStats(data);
      } catch (error) {
        console.log('Could not fetch arena status');
      }
    };
    
    checkCanPlay();
  }, [walletAddress]);

  // Timer effect
  useEffect(() => {
    if (gameOver || !canPlay) return;
    
    const isPlayerTurn = chess.turn() === playerColor;
    
    timerRef.current = setInterval(() => {
      if (isPlayerTurn) {
        setPlayerTime(prev => {
          if (prev <= 0) {
            handleGameEnd('loss', 'timeout');
            return 0;
          }
          return prev - 1;
        });
      } else {
        setAiTime(prev => {
          if (prev <= 0) {
            handleGameEnd('win', 'ai_timeout');
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [chess.turn(), gameOver, canPlay]);

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // AI move using simple evaluation (no external engine needed)
  const makeAiMove = useCallback(async () => {
    if (gameOver || chess.turn() === playerColor) return;

    setIsAiThinking(true);

    // Simulate thinking time
    await new Promise(resolve => setTimeout(resolve, AI_THINK_TIME_MS));

    // Get best move using iterative deepening minimax
    const bestMove = findBestMove(chess, AI_MAX_DEPTH);

    if (bestMove) {
      const isCapture = chess.get(bestMove.to as Square) !== null;
      const isCastle = bestMove.san?.includes('O-O') || (bestMove.piece === 'k' && Math.abs(bestMove.from.charCodeAt(0) - bestMove.to.charCodeAt(0)) === 2);

      chess.move(bestMove);
      setBoard([...chess.board()]);
      setLastMove({ from: bestMove.from as Square, to: bestMove.to as Square });

      // Count full moves (white + black = 1 move), standard chess convention
      const updatedMoveCount = Math.ceil(chess.history().length / 2);
      setMoveCount(updatedMoveCount);

      // Play sound
      if (chess.isCheck()) {
        playSound('check');
      } else if (isCastle) {
        playSound('castle');
      } else if (isCapture) {
        playSound('capture');
      } else {
        playSound('move');
      }

      // Check for game end - use the updated move count
      if (chess.isCheckmate()) {
        handleGameEnd('loss', 'checkmate', updatedMoveCount);
      } else if (chess.isDraw()) {
        handleGameEnd('draw', 'draw', updatedMoveCount);
      }
    }

    setIsAiThinking(false);
  }, [chess, gameOver, playerColor]);

  // Trigger AI move when it's AI's turn
  useEffect(() => {
    if (!gameOver && chess.turn() !== playerColor && canPlay) {
      makeAiMove();
    }
  }, [board, gameOver, playerColor, canPlay]);

  // Execute a player move on the arena board
  const executeArenaMove = (from: Square, to: Square, promotion?: string) => {
    const targetPiece = chess.get(to);
    const isCapture = targetPiece !== null;
    const movingPiece = chess.get(from);
    const isCastle = movingPiece?.type === 'k' && Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) === 2;

    const moveOptions: any = { from, to };
    if (promotion) moveOptions.promotion = promotion;
    const move = chess.move(moveOptions);
    if (move) {
      setBoard([...chess.board()]);
      setLastMove({ from, to });

      // Count full moves (white + black = 1 move), standard chess convention
      const updatedMoveCount = Math.ceil(chess.history().length / 2);
      setMoveCount(updatedMoveCount);
      setPendingPromotion(null);

      if (chess.isCheck()) {
        playSound('check');
      } else if (isCastle) {
        playSound('castle');
      } else if (isCapture) {
        playSound('capture');
      } else {
        playSound('move');
      }

      // Check for game end - use the updated move count
      if (chess.isCheckmate()) {
        handleGameEnd('win', 'checkmate', updatedMoveCount);
      } else if (chess.isDraw()) {
        handleGameEnd('draw', 'draw', updatedMoveCount);
      }
    }
    setSelectedSquare(null);
    setValidMoves([]);
  };

  const handlePromotionSelect = (piece: string) => {
    if (!pendingPromotion) return;
    executeArenaMove(pendingPromotion.from, pendingPromotion.to, piece);
  };

  // Handle player move
  const handleSquareClick = (square: Square) => {
    if (gameOver || isAiThinking || chess.turn() !== playerColor) return;
    
    const piece = chess.get(square);
    
    // If clicking on own piece, select it
    if (piece && piece.color === playerColor) {
      setSelectedSquare(square);
      const moves = chess.moves({ square, verbose: true });
      setValidMoves(moves.map(m => m.to as Square));
      return;
    }
    
    // If a piece is selected and clicking valid square, make move
    if (selectedSquare && validMoves.includes(square)) {
      // Check if this is a pawn promotion
      const movingPiece = chess.get(selectedSquare);
      const toRank = Number(square[1]);
      const isPromotion = movingPiece?.type === 'p' && ((movingPiece.color === 'w' && toRank === 8) || (movingPiece.color === 'b' && toRank === 1));

      if (isPromotion) {
        setPendingPromotion({ from: selectedSquare, to: square });
        return;
      }

      executeArenaMove(selectedSquare, square);
      return;
    }
    
    setSelectedSquare(null);
    setValidMoves([]);
  };

  // Handle game end
  const handleGameEnd = async (gameResult: 'win' | 'loss' | 'draw', reason: string, finalMoveCount?: number) => {
    setGameOver(true);
    setResult(gameResult);

    if (timerRef.current) clearInterval(timerRef.current);

    // Use the provided move count or fall back to state (for timeout/resignation cases)
    const actualMoveCount = finalMoveCount ?? moveCount;

    // Check if game counts (minimum moves requirement)
    const counts = actualMoveCount >= MIN_MOVES_TO_COUNT;
    
    // Create default stats in case backend fails
    const defaultStats: ArenaStats = {
      matchesPlayed: (arenaStats?.matchesPlayed || 0) + 1,
      wins: (arenaStats?.wins || 0) + (gameResult === 'win' ? 1 : 0),
      score: arenaStats?.score || 0,
      rank: arenaStats?.rank || 999,
      gamesRemainingToday: (arenaStats?.gamesRemainingToday || MAX_GAMES_PER_DAY) - 1,
    };
    
    // Submit result to backend
    try {
      const res = await fetch(`${BACKEND_URL}/api/arena/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          result: gameResult,
          moveCount: actualMoveCount,
          reason,
          counts,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.stats) {
          setArenaStats(data.stats);
        } else {
          setArenaStats(defaultStats);
        }
      } else {
        setArenaStats(defaultStats);
      }
    } catch (error) {
      console.error('Failed to submit arena result:', error);
      setArenaStats(defaultStats);
    }
  };

  // Resign
  const handleResign = () => {
    if (!gameOver) {
      // Resignations don't count towards leaderboard - warn user
      if (window.confirm('Resigned games do NOT count towards the leaderboard. Are you sure you want to resign?')) {
        handleGameEnd('loss', 'resignation');
      }
    }
  };

  // Close result and return to lobby
  const handleCloseResult = () => {
    onGameEnd();
  };

  // Render blocked state
  if (!canPlay) {
    return (
      <div className="max-w-md mx-auto text-center p-8">
        <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/30">
          <Clock className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-red-400 mb-2">Cannot Start Game</h3>
          <p className="text-white/70">{errorMessage}</p>
          <button
            onClick={onGameEnd}
            className="mt-6 px-6 py-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-white transition-colors border border-white/10"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
          >
            Back to Arena
          </button>
        </div>
      </div>
    );
  }

  // Compute captured pieces
  const captured = useMemo(() => getCapturedPieces(chess), [board]);

  // Build move history pairs
  const moveHistory = chess.history();
  const movePairs: { num: number; white: string; black?: string }[] = [];
  for (let i = 0; i < moveHistory.length; i += 2) {
    movePairs.push({
      num: Math.floor(i / 2) + 1,
      white: moveHistory[i],
      black: moveHistory[i + 1],
    });
  }

  const isPlayerTurn = chess.turn() === playerColor;
  const isAiTurn = !isPlayerTurn;
  const moveProgress = Math.min(moveCount, MIN_MOVES_TO_COUNT);
  const movesCount = moveCount >= MIN_MOVES_TO_COUNT;
  const gamesPlayedToday = arenaStats ? (MAX_GAMES_PER_DAY - (arenaStats.gamesRemainingToday || 0)) : 0;
  const winRate = arenaStats && arenaStats.matchesPlayed > 0
    ? Math.round((arenaStats.wins / arenaStats.matchesPlayed) * 100) : 0;

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', fontFamily: "'Outfit', 'SF Pro Display', sans-serif" }}>
      {/* CSS Grid Layout */}
      <style>{`
        .arena-chess-grid { display: grid; grid-template-columns: 620px 1fr; gap: 28px; align-items: start; }
        @media (max-width: 960px) { .arena-chess-grid { grid-template-columns: 1fr; } .arena-board-col { max-width: 100% !important; } }
      `}</style>

      <div className="arena-chess-grid">
        {/* ─── LEFT COLUMN: Board + Timers ─── */}
        <div className="arena-board-col flex flex-col" style={{ width: '100%', maxWidth: 620 }}>

          {/* ─── AI TIMER (top) ─── */}
          <div style={{
            padding: '12px 20px',
            background: isAiTurn ? 'rgba(234,179,8,0.06)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${isAiTurn ? 'rgba(234,179,8,0.2)' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: 14,
            transition: 'all 0.3s',
            marginBottom: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Active dot */}
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: isAiTurn ? '#eab308' : '#333',
                  boxShadow: isAiTurn ? '0 0 12px rgba(234,179,8,0.5)' : 'none',
                  transition: 'all 0.3s',
                }} />
                {/* Bot icon */}
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: 'rgba(153,69,255,0.12)',
                  border: '1px solid rgba(153,69,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Bot style={{ width: 16, height: 16, color: '#b388ff' }} />
                </div>
                <div>
                  <div style={{
                    fontSize: 14, fontWeight: 600,
                    color: isAiTurn ? '#e8e8f0' : '#6b6b80',
                    fontFamily: "'Outfit', sans-serif",
                  }}>
                    SolMate AI {isAiThinking && <span style={{ color: '#eab308', fontSize: 12 }}>• thinking...</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#444', fontFamily: "'Space Mono', monospace" }}>Level 20</div>
                </div>
              </div>
              {/* Timer */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 14, height: 14, borderRadius: 4,
                  background: '#1a1a2e',
                  border: '1px solid rgba(255,255,255,0.15)',
                }} />
                <Clock style={{ width: 14, height: 14, color: isAiTurn ? '#eab308' : '#444' }} />
                <span style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 22, fontWeight: 700,
                  color: isAiTurn ? '#eab308' : '#6b6b80',
                  letterSpacing: '0.05em',
                }}>{formatTime(aiTime)}</span>
              </div>
            </div>
            {/* AI Captured Pieces */}
            {captured.bGroups.length > 0 && (
              <div style={{
                marginTop: 8, paddingTop: 8,
                borderTop: '1px solid rgba(255,255,255,0.04)',
                display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', minHeight: 24,
              }}>
                {captured.bGroups.map((g, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                    {Array.from({ length: g.count }).map((_, j) => (
                      <span key={j} style={{
                        fontSize: 18, lineHeight: 1, color: '#e8e8f0',
                        filter: 'drop-shadow(0 1px 4px rgba(255,255,255,0.2))',
                        marginLeft: j > 0 ? -6 : 0,
                        position: 'relative', zIndex: g.count - j, opacity: 0.9, userSelect: 'none',
                      }}>{PIECE_SYMBOLS[g.piece]}</span>
                    ))}
                  </div>
                ))}
                {captured.bAdvantage > 0 && (
                  <span style={{
                    fontSize: 12, fontWeight: 700, fontFamily: "'Space Mono', monospace",
                    color: '#eab308', marginLeft: 6, padding: '2px 6px', borderRadius: 6,
                    background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.15)',
                  }}>+{captured.bAdvantage}</span>
                )}
              </div>
            )}
          </div>

          {/* ─── CHESS BOARD ─── */}
          <div className="rounded-lg sm:rounded-2xl p-0 sm:p-3" style={{
            background: 'rgba(14,14,30,0.7)',
            border: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(12px)',
          }}>
            <div className="relative">
              <div className="aspect-square w-full overflow-hidden rounded-xl sm:rounded-2xl" style={{
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 80px rgba(234,179,8,0.05)',
                background: 'linear-gradient(135deg, rgba(234,179,8,0.02), rgba(153,69,255,0.02))',
              }}>
                <div className="grid grid-cols-8 grid-rows-8 h-full w-full">
                  {Array.from({ length: 64 }).map((_, i) => {
                    const row = Math.floor(i / 8);
                    const col = i % 8;
                    const square = `${FILES[col]}${8 - row}` as Square;
                    const piece = board[row]?.[col] ?? null;
                    const isLight = (row + col) % 2 === 0;
                    const isSelected = selectedSquare === square;
                    const isValidMove = validMoves.includes(square);
                    const isLastMoveSquare = lastMove && (lastMove.from === square || lastMove.to === square);
                    const isCheck = chess.isCheck() && piece?.type === 'k' && piece?.color === chess.turn();

                    // Coordinate labels
                    const showRank = col === 0;
                    const showFile = row === 7;
                    const rank = 8 - row;
                    const file = FILES[col];

                    // Square colors - light and dark
                    let bgColor = isLight ? '#e8e0f0' : '#12122a';
                    if (isLastMoveSquare && !isSelected && !isCheck) {
                      bgColor = isLight ? 'rgba(153,69,255,0.22)' : 'rgba(153,69,255,0.28)';
                    }
                    if (isSelected) {
                      bgColor = 'rgba(0,255,163,0.25)';
                    }
                    if (isCheck) {
                      bgColor = 'rgba(239,68,68,0.4)';
                    }

                    const boxShadow = isSelected
                      ? 'inset 0 0 0 3px rgba(0,255,163,0.5)'
                      : isCheck
                        ? 'inset 0 0 0 3px rgba(239,68,68,0.7)'
                        : undefined;

                    return (
                      <button
                        key={square}
                        type="button"
                        onClick={() => handleSquareClick(square)}
                        className="relative flex items-center justify-center select-none"
                        style={{
                          backgroundColor: bgColor,
                          borderRadius: '2px',
                          boxShadow,
                          transition: 'background-color 0.15s',
                        }}
                      >
                        {/* Piece */}
                        {piece && (
                          <motion.div
                            className="relative w-[92%] h-[92%] sm:w-[82%] sm:h-[82%]"
                            style={{ zIndex: 1 }}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: isSelected ? 1.08 : 1, opacity: 1 }}
                          >
                            <img
                              src={PIECE_PATHS[`${piece.color}${piece.type.toUpperCase()}`]}
                              alt={`${piece.color}${piece.type}`}
                              className="w-full h-full object-contain pointer-events-none"
                              style={{
                                filter: piece.color === 'b'
                                  ? 'drop-shadow(0 2px 8px rgba(153,69,255,0.4))'
                                  : 'drop-shadow(0 2px 8px rgba(255,255,255,0.2))',
                              }}
                              draggable={false}
                            />
                          </motion.div>
                        )}

                        {/* Legal move dot (empty square) */}
                        {isValidMove && !piece && (
                          <div style={{
                            position: 'absolute', width: '30%', height: '30%',
                            borderRadius: '50%', backgroundColor: 'rgba(0,255,163,0.3)',
                            zIndex: 10, pointerEvents: 'none',
                          }} />
                        )}

                        {/* Legal capture indicator (square with piece) */}
                        {isValidMove && piece && (
                          <div style={{
                            position: 'absolute', inset: '4px', borderRadius: '50%',
                            border: '4px solid rgba(0,255,163,0.35)',
                            zIndex: 10, pointerEvents: 'none',
                          }} />
                        )}

                        {/* Rank numbers on left edge */}
                        {showRank && (
                          <span className="pointer-events-none select-none" style={{
                            position: 'absolute', top: '2px', left: '3px',
                            fontSize: '10px', fontWeight: 700, lineHeight: 1,
                            fontFamily: "'Space Mono', monospace",
                            color: 'rgba(255,255,255,0.12)', zIndex: 5,
                          }}>{rank}</span>
                        )}

                        {/* File letters on bottom edge */}
                        {showFile && (
                          <span className="pointer-events-none select-none" style={{
                            position: 'absolute', bottom: '2px', right: '3px',
                            fontSize: '10px', fontWeight: 700, lineHeight: 1,
                            fontFamily: "'Space Mono', monospace",
                            color: 'rgba(255,255,255,0.12)', zIndex: 5,
                          }}>{file}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Thinking Overlay */}
              {isAiThinking && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0,0,0,0.25)', borderRadius: 16,
                }}>
                  <div style={{
                    padding: '10px 24px', borderRadius: 14,
                    background: 'rgba(14,14,30,0.9)',
                    border: '1px solid rgba(234,179,8,0.2)',
                    color: '#eab308', fontSize: 14, fontWeight: 600,
                    fontFamily: "'Outfit', sans-serif",
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <Cpu style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                    AI is thinking...
                  </div>
                </div>
              )}

              {/* Pawn Promotion Picker */}
              {pendingPromotion && (() => {
                const movingPiece = chess.get(pendingPromotion.from);
                const color = movingPiece?.color || 'w';
                const toCol = pendingPromotion.to.charCodeAt(0) - 97;
                // Arena player is always white (no flip)
                const fromTop = color === 'w'; // white promotes to rank 8 = top of board
                const pieces = ['q', 'r', 'b', 'n'] as const;

                return (
                  <motion.div
                    key="promotion-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => { setPendingPromotion(null); setSelectedSquare(null); setValidMoves([]); }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      zIndex: 50,
                      background: 'rgba(0,0,0,0.5)',
                      borderRadius: '16px',
                    }}
                  >
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        left: `${toCol * 12.5}%`,
                        width: '12.5%',
                        ...(fromTop ? { top: 0 } : { bottom: 0 }),
                        display: 'flex',
                        flexDirection: fromTop ? 'column' : 'column-reverse',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                      }}
                    >
                      {pieces.map((p) => (
                        <motion.button
                          key={p}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          transition={{ duration: 0.12 }}
                          whileHover={{ scale: 1.1, backgroundColor: 'rgba(234,179,8,0.3)' }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handlePromotionSelect(p)}
                          style={{
                            aspectRatio: '1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(14,14,30,0.95)',
                            border: 'none',
                            cursor: 'pointer',
                            borderBottom: '1px solid rgba(255,255,255,0.08)',
                            padding: '8%',
                          }}
                        >
                          <img
                            src={`/pieces/${color}${p.toUpperCase()}.svg`}
                            alt={p}
                            style={{ width: '85%', height: '85%', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
                            draggable={false}
                          />
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                );
              })()}
            </div>
          </div>

          {/* ─── PLAYER TIMER (bottom) ─── */}
          <div style={{
            padding: '12px 20px',
            background: isPlayerTurn ? 'rgba(234,179,8,0.06)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${isPlayerTurn ? 'rgba(234,179,8,0.2)' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: 14,
            transition: 'all 0.3s',
            marginTop: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Active dot */}
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: isPlayerTurn ? '#eab308' : '#333',
                  boxShadow: isPlayerTurn ? '0 0 12px rgba(234,179,8,0.5)' : 'none',
                  transition: 'all 0.3s',
                }} />
                {/* User icon */}
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: 'rgba(234,179,8,0.12)',
                  border: '1px solid rgba(234,179,8,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <User style={{ width: 16, height: 16, color: '#eab308' }} />
                </div>
                <div>
                  <div style={{
                    fontSize: 14, fontWeight: 600,
                    color: isPlayerTurn ? '#e8e8f0' : '#6b6b80',
                    fontFamily: "'Outfit', sans-serif",
                  }}>You</div>
                  <div style={{ fontSize: 11, color: '#444', fontFamily: "'Space Mono', monospace" }}>
                    Move {moveCount}
                  </div>
                </div>
              </div>
              {/* Timer */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 14, height: 14, borderRadius: 4,
                  background: '#e8e8f0',
                  border: '1px solid rgba(255,255,255,0.15)',
                }} />
                <Clock style={{ width: 14, height: 14, color: isPlayerTurn ? '#eab308' : '#444' }} />
                <span style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 22, fontWeight: 700,
                  color: isPlayerTurn ? '#eab308' : '#6b6b80',
                  letterSpacing: '0.05em',
                }}>{formatTime(playerTime)}</span>
              </div>
            </div>
            {/* Player Captured Pieces */}
            {captured.wGroups.length > 0 && (
              <div style={{
                marginTop: 8, paddingTop: 8,
                borderTop: '1px solid rgba(255,255,255,0.04)',
                display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', minHeight: 24,
              }}>
                {captured.wGroups.map((g, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                    {Array.from({ length: g.count }).map((_, j) => (
                      <span key={j} style={{
                        fontSize: 18, lineHeight: 1, color: '#b388ff',
                        filter: 'drop-shadow(0 1px 4px rgba(153,69,255,0.4))',
                        marginLeft: j > 0 ? -6 : 0,
                        position: 'relative', zIndex: g.count - j, opacity: 0.9, userSelect: 'none',
                      }}>{PIECE_SYMBOLS[g.piece]}</span>
                    ))}
                  </div>
                ))}
                {captured.wAdvantage > 0 && (
                  <span style={{
                    fontSize: 12, fontWeight: 700, fontFamily: "'Space Mono', monospace",
                    color: '#eab308', marginLeft: 6, padding: '2px 6px', borderRadius: 6,
                    background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.15)',
                  }}>+{captured.wAdvantage}</span>
                )}
              </div>
            )}
          </div>

          {/* ─── MOVE PROGRESS BAR ─── */}
          <div style={{
            marginTop: 12,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12,
            padding: '12px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 13, fontWeight: 600,
                color: movesCount ? '#22c55e' : '#a0a0b8',
              }}>
                {movesCount ? '✓ Game counts toward score' : `Move ${moveCount} / ${MIN_MOVES_TO_COUNT} minimum`}
              </span>
            </div>
            {/* Progress track */}
            <div style={{
              width: '100%', height: 3, borderRadius: 2,
              background: 'rgba(255,255,255,0.04)',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${(moveProgress / MIN_MOVES_TO_COUNT) * 100}%`,
                height: '100%', borderRadius: 2,
                background: movesCount
                  ? '#22c55e'
                  : 'linear-gradient(90deg, #eab308, #f59e0b)',
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        </div>

        {/* ─── RIGHT COLUMN: Side Panel ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 280 }}>

          {/* Game Status Card */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 16, padding: '20px 24px',
          }}>
            <div style={{
              fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.1em', color: '#eab308', marginBottom: 14,
              fontFamily: "'Space Mono', monospace",
            }}>Game Status</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Mode', value: '⚡ Arena' },
                { label: 'Opponent', value: 'SolMate AI (Lvl 20)' },
                { label: 'Stakes', value: 'Season Points' },
                { label: 'Your Color', value: '⬜ White' },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#6b6b80' }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f0', fontFamily: "'Space Mono', monospace" }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Move History Card */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 16, padding: '20px 24px',
          }}>
            <div style={{
              fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.1em', color: '#6b6b80', marginBottom: 14,
              fontFamily: "'Space Mono', monospace",
            }}>Move History</div>
            <div style={{ maxHeight: 200, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
              {movePairs.length === 0 ? (
                <div style={{ fontSize: 13, color: '#444', fontStyle: 'italic', padding: '8px 0' }}>
                  No moves yet — make the first move!
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr', gap: '2px 8px' }}>
                  {/* Header */}
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#444', paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>#</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#444', paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>White</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#444', paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Black</span>
                  {/* Rows */}
                  {movePairs.map((pair, idx) => {
                    const isLatest = idx === movePairs.length - 1;
                    const rowBg = isLatest ? 'rgba(234,179,8,0.08)' : 'transparent';
                    return (
                      <React.Fragment key={idx}>
                        <span style={{
                          fontSize: 12, fontFamily: "'Space Mono', monospace", color: '#444',
                          padding: '4px 0', background: rowBg,
                          borderRadius: isLatest ? '6px 0 0 6px' : 0,
                        }}>{pair.num}.</span>
                        <span style={{
                          fontSize: 13, fontFamily: "'Space Mono', monospace", color: '#e8e8f0',
                          padding: '4px 0', background: rowBg,
                        }}>{pair.white}</span>
                        <span style={{
                          fontSize: 13, fontFamily: "'Space Mono', monospace", color: '#e8e8f0',
                          padding: '4px 0', background: rowBg,
                          borderRadius: isLatest ? '0 6px 6px 0' : 0,
                        }}>{pair.black || ''}</span>
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Arena Stats Card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(234,179,8,0.04), rgba(234,179,8,0.01))',
            border: '1px solid rgba(234,179,8,0.12)',
            borderRadius: 16, padding: '20px 24px',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Top gold accent line */}
            <div style={{
              position: 'absolute', top: 0, left: '30%', width: 120, height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(234,179,8,0.4), transparent)',
            }} />
            <div style={{
              fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.1em', color: '#eab308', marginBottom: 14,
              fontFamily: "'Space Mono', monospace",
            }}>Arena Stats</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Games Today', value: `${gamesPlayedToday}/${MAX_GAMES_PER_DAY}` },
                { label: 'Season Score', value: `${arenaStats?.score?.toFixed(1) || '0.0'} pts` },
                { label: 'Win Rate', value: `${winRate}%` },
                { label: 'Rank', value: arenaStats?.rank ? `#${arenaStats.rank}` : '—' },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#6b6b80' }}>{row.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#eab308', fontFamily: "'Space Mono', monospace" }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Resign Button */}
          <button
            onClick={handleResign}
            disabled={gameOver}
            className="arena-resign-btn"
            style={{
              padding: '10px 20px', borderRadius: 10,
              fontSize: 13, fontWeight: 600,
              fontFamily: "'Outfit', sans-serif",
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#6b6b80',
              cursor: gameOver ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: gameOver ? 0.4 : 1,
              width: '100%',
            }}
            onMouseEnter={(e) => {
              if (!gameOver) {
                e.currentTarget.style.background = 'rgba(255,80,80,0.1)';
                e.currentTarget.style.borderColor = 'rgba(255,80,80,0.3)';
                e.currentTarget.style.color = '#ff5050';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.color = '#6b6b80';
            }}
          >
            <Flag style={{ width: 14, height: 14 }} />
            Resign Game
          </button>
        </div>
      </div>

      {/* ─── RESULT MODAL ─── */}
      {gameOver && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99998,
        }}>
          <div style={{
            background: 'rgba(14,14,30,0.95)',
            border: `1px solid ${result === 'win' ? 'rgba(234,179,8,0.3)' : result === 'loss' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.15)'}`,
            backdropFilter: 'blur(20px)',
            boxShadow: result === 'win' ? '0 0 60px rgba(234,179,8,0.15)' : '0 0 60px rgba(0,0,0,0.5)',
            padding: '32px',
            borderRadius: '20px',
            maxWidth: '420px',
            width: '100%',
            textAlign: 'center' as const,
          }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>
              {result === 'win' ? '🏆' : result === 'loss' ? '😔' : '🤝'}
            </div>
            <h2 style={{
              fontSize: '28px', fontWeight: 800, marginBottom: '8px',
              fontFamily: "'Outfit', sans-serif",
              color: result === 'win' ? '#eab308' : result === 'loss' ? '#f87171' : '#e8e8f0',
            }}>
              {result === 'win' ? 'Victory!' : result === 'loss' ? 'Defeat' : 'Draw'}
            </h2>
            <p style={{ color: '#6b6b80', marginBottom: '8px', fontSize: 15 }}>
              {result === 'win' ? 'You defeated the AI!' : result === 'loss' ? 'The AI won this time' : 'The game ended in a draw'}
            </p>
            <p style={{
              color: '#444', marginBottom: '24px',
              fontFamily: "'Space Mono', monospace", fontSize: 13,
            }}>Moves played: {moveCount}</p>
            
            {/* Share bonus indicator */}
            {shareBonus !== null && (
              <div style={{
                marginBottom: '16px', padding: '10px 16px',
                background: 'rgba(34,197,94,0.08)',
                borderRadius: '12px',
                border: '1px solid rgba(34,197,94,0.2)',
              }}>
                <p style={{ color: '#22c55e', fontWeight: 600, fontSize: 14, fontFamily: "'Space Mono', monospace" }}>
                  ✨ +{shareBonus} bonus points awarded!
                </p>
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={handleCloseResult}
                style={{
                  padding: '12px 24px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  fontWeight: 600, fontSize: 14,
                  cursor: 'pointer',
                  color: '#e8e8f0',
                  fontFamily: "'Outfit', sans-serif",
                  transition: 'all 0.2s',
                }}
              >
                Continue
              </button>
              <button
                onClick={async () => {
                  // Open tweet window first for better UX
                  const text = `I just ${result === 'win' ? 'defeated' : result === 'loss' ? 'lost to' : 'drew with'} the SolMate AI in ${moveCount} moves! ♟️\n\n$500 prize pool — top 3 win!\n\nPlay now: https://playsolmate.fun/arena`;
                  shareToX(text);
                  
                  // Award share bonus if not already claimed
                  if (!hasShared) {
                    try {
                      const res = await fetch(`${BACKEND_URL}/api/arena/share`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ walletAddress }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        setHasShared(true);
                        setShareBonus(data.bonusAwarded);
                      }
                    } catch (error) {
                      console.error('Failed to record share:', error);
                    }
                  }
                }}
                disabled={hasShared}
                style={{
                  padding: '12px 24px',
                  background: hasShared
                    ? 'rgba(34,197,94,0.15)'
                    : 'linear-gradient(135deg, #eab308, #f59e0b)',
                  border: hasShared ? '1px solid rgba(34,197,94,0.25)' : 'none',
                  borderRadius: '12px',
                  fontWeight: 700, fontSize: 14,
                  cursor: hasShared ? 'default' : 'pointer',
                  color: hasShared ? '#22c55e' : '#07070e',
                  fontFamily: "'Outfit', sans-serif",
                  opacity: hasShared ? 0.9 : 1,
                  boxShadow: hasShared ? 'none' : '0 4px 20px rgba(234,179,8,0.25)',
                  transition: 'all 0.2s',
                }}
              >
                {hasShared ? '✓ Shared (+0.25)' : '𝕏 Share (+0.25)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Opening book - common strong responses for first ~6 moves
const OPENING_BOOK: Record<string, string[]> = {
  // Starting position responses (as black)
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq': ['e7e5', 'c7c5', 'd7d5'], // vs e4
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq': ['d7d5', 'g8f6', 'e7e6'], // vs d4
  'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq': ['e7e5', 'c7c5', 'g8f6'], // vs c4
  'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq': ['d7d5', 'g8f6', 'c7c5'], // vs Nf3
  // After 1.e4 e5
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq': ['b8c6', 'g8f6'], // vs Nf3
  'rnbqkbnr/pppp1ppp/8/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR b KQkq': ['g8f6', 'f8c5'], // vs Bc4
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq': ['f1b5', 'f1c4', 'd2d4'], // Ruy Lopez / Italian / Scotch
  // After 1.d4 d5
  'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq': ['c2c4', 'g1f3', 'b1c3'], // Queen's Gambit
  'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq': ['e7e6', 'c7c6', 'd5c4'], // vs c4
  // After 1.e4 c5 (Sicilian)
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq': ['g1f3', 'b1c3', 'd2d4'], // vs Sicilian
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq': ['d7d6', 'b8c6', 'e7e6'], // Sicilian cont.
  // After 1.e4 e6 (French)
  'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq': ['d2d4', 'g1f3'], // vs French
  'rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq': ['d7d5'], // French cont.
  // After 1.e4 d5 (Scandinavian)
  'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq': ['e4d5'], // vs Scandinavian
};

// Enhanced minimax AI with iterative deepening, quiescence search, and improved evaluation
// Target: ~1500 ELO strength with non-deterministic play

let searchStartTime = 0;
let searchTimedOut = false;

// Variance window: moves within this score range of the best are eligible for random selection.
// 25 centipawns keeps play strong but varied (~1500 ELO). Forced tactics won't be missed
// because a +25cp move is still clearly better than a blunder.
const SCORE_VARIANCE_CP = 25;

function findBestMove(chess: Chess, maxDepth: number): Move | null {
  // Check opening book first
  const fen = chess.fen().split(' ').slice(0, 4).join(' ');
  const bookMoves = OPENING_BOOK[fen];
  if (bookMoves && bookMoves.length > 0) {
    const bookMove = bookMoves[Math.floor(Math.random() * bookMoves.length)];
    const from = bookMove.slice(0, 2);
    const to = bookMove.slice(2, 4);
    const promotion = bookMove.length > 4 ? bookMove[4] : undefined;
    try {
      const move = chess.move({ from, to, promotion });
      if (move) {
        chess.undo();
        return move;
      }
    } catch {
      // Book move not valid, fall through to search
    }
  }

  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0]; // Only one legal move

  searchStartTime = Date.now();
  searchTimedOut = false;
  let bestMove: Move | null = null;
  let candidateMoves: { move: Move; score: number }[] = [];

  // Iterative deepening: search depth 1, 2, 3... up to maxDepth or time limit
  for (let depth = 1; depth <= maxDepth; depth++) {
    if (Date.now() - searchStartTime > AI_TIME_LIMIT_MS) break;

    const isMaximizing = chess.turn() === 'w';
    const depthCandidates: { move: Move; score: number }[] = [];

    // Order moves: put previous best move first, then captures/checks, then rest
    const orderedMoves = orderMoves(chess, moves, bestMove);

    for (const move of orderedMoves) {
      if (searchTimedOut) break;

      chess.move(move);
      const score = minimax(chess, depth - 1, -Infinity, Infinity, !isMaximizing);
      chess.undo();

      if (searchTimedOut) break;

      depthCandidates.push({ move, score });
    }

    // Only update candidates if we completed this depth fully
    if (!searchTimedOut && depthCandidates.length > 0) {
      candidateMoves = depthCandidates;

      // Sort by score (best first depending on side)
      if (isMaximizing) {
        candidateMoves.sort((a, b) => b.score - a.score);
      } else {
        candidateMoves.sort((a, b) => a.score - b.score);
      }
      bestMove = candidateMoves[0].move;

      // Stop if we found a forced mate
      if (Math.abs(candidateMoves[0].score) > 9000) break;
    } else if (depthCandidates.length > 0 && !bestMove) {
      // Use partial result if we have nothing yet
      candidateMoves = depthCandidates;
      if (chess.turn() === 'w') {
        candidateMoves.sort((a, b) => b.score - a.score);
      } else {
        candidateMoves.sort((a, b) => a.score - b.score);
      }
      bestMove = candidateMoves[0].move;
    }
  }

  // Non-deterministic selection: pick randomly among moves within SCORE_VARIANCE_CP of best
  if (candidateMoves.length > 1 && Math.abs(candidateMoves[0].score) < 9000) {
    const bestScore = candidateMoves[0].score;
    const eligible = candidateMoves.filter(
      c => Math.abs(c.score - bestScore) <= SCORE_VARIANCE_CP
    );
    if (eligible.length > 1) {
      return eligible[Math.floor(Math.random() * eligible.length)].move;
    }
  }

  return bestMove;
}

// Order moves for better alpha-beta pruning
function orderMoves(chess: Chess, moves: Move[], pvMove: Move | null): Move[] {
  const scored = moves.map(move => {
    let score = 0;
    // PV move from previous iteration always first
    if (pvMove && move.from === pvMove.from && move.to === pvMove.to) {
      score += 10000;
    }
    // MVV-LVA: Most Valuable Victim - Least Valuable Attacker
    if (move.captured) {
      score += 1000 + getPieceValue(move.captured) * 100 - getPieceValue(move.piece) * 10;
    }
    // Promotions
    if (move.promotion) {
      score += 900 + (move.promotion === 'q' ? 800 : 0);
    }
    // Check bonus (cheap check detection via san)
    if (move.san && (move.san.includes('+') || move.san.includes('#'))) {
      score += 500;
    }
    // Center moves
    if (['d4','d5','e4','e5'].includes(move.to)) score += 20;
    if (['c3','c4','c5','c6','d3','d6','e3','e6','f3','f4','f5','f6'].includes(move.to)) score += 10;
    return { move, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.move);
}

// Lightweight move ordering inside the tree (no PV move, no check detection)
function orderMovesInTree(moves: Move[]): Move[] {
  return moves.sort((a, b) => {
    let sa = 0, sb = 0;
    if (a.captured) sa += 1000 + getPieceValue(a.captured) * 100 - getPieceValue(a.piece) * 10;
    if (b.captured) sb += 1000 + getPieceValue(b.captured) * 100 - getPieceValue(b.piece) * 10;
    if (a.promotion) sa += 900;
    if (b.promotion) sb += 900;
    if (['d4','d5','e4','e5'].includes(a.to)) sa += 20;
    if (['d4','d5','e4','e5'].includes(b.to)) sb += 20;
    return sb - sa;
  });
}

function minimax(chess: Chess, depth: number, alpha: number, beta: number, maximizing: boolean): number {
  // Time check every few nodes
  if ((Date.now() - searchStartTime) > AI_TIME_LIMIT_MS) {
    searchTimedOut = true;
    return evaluateBoard(chess);
  }

  if (chess.isGameOver()) {
    if (chess.isCheckmate()) {
      // Add depth bonus so engine prefers faster mates
      return chess.turn() === 'w' ? -10000 - depth : 10000 + depth;
    }
    return 0; // Draw
  }

  if (depth <= 0) {
    return quiescenceSearch(chess, alpha, beta, maximizing, 6);
  }

  const moves = orderMovesInTree(chess.moves({ verbose: true }));

  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      chess.move(move);
      const eval_ = minimax(chess, depth - 1, alpha, beta, false);
      chess.undo();
      if (searchTimedOut) return eval_;
      maxEval = Math.max(maxEval, eval_);
      alpha = Math.max(alpha, eval_);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      chess.move(move);
      const eval_ = minimax(chess, depth - 1, alpha, beta, true);
      chess.undo();
      if (searchTimedOut) return eval_;
      minEval = Math.min(minEval, eval_);
      beta = Math.min(beta, eval_);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

// Quiescence search: only evaluate captures/promotions at leaf nodes to avoid horizon effect
function quiescenceSearch(chess: Chess, alpha: number, beta: number, maximizing: boolean, qDepth: number): number {
  if (searchTimedOut || (Date.now() - searchStartTime) > AI_TIME_LIMIT_MS) {
    searchTimedOut = true;
    return evaluateBoard(chess);
  }

  const standPat = evaluateBoard(chess);

  if (qDepth <= 0) return standPat;

  if (chess.isGameOver()) {
    if (chess.isCheckmate()) {
      return chess.turn() === 'w' ? -10000 : 10000;
    }
    return 0;
  }

  if (maximizing) {
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;

    // Only search captures and promotions
    const moves = chess.moves({ verbose: true }).filter(m => m.captured || m.promotion);
    const sorted = moves.sort((a, b) => {
      const sa = (a.captured ? getPieceValue(a.captured) * 100 - getPieceValue(a.piece) * 10 : 0) + (a.promotion ? 800 : 0);
      const sb = (b.captured ? getPieceValue(b.captured) * 100 - getPieceValue(b.piece) * 10 : 0) + (b.promotion ? 800 : 0);
      return sb - sa;
    });

    for (const move of sorted) {
      // Delta pruning: skip captures that can't possibly raise alpha
      if (move.captured && standPat + getPieceValue(move.captured) * 100 + 200 < alpha) continue;

      chess.move(move);
      const score = quiescenceSearch(chess, alpha, beta, false, qDepth - 1);
      chess.undo();
      if (searchTimedOut) return score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) return beta;
    }
    return alpha;
  } else {
    if (standPat <= alpha) return alpha;
    if (standPat < beta) beta = standPat;

    const moves = chess.moves({ verbose: true }).filter(m => m.captured || m.promotion);
    const sorted = moves.sort((a, b) => {
      const sa = (a.captured ? getPieceValue(a.captured) * 100 - getPieceValue(a.piece) * 10 : 0) + (a.promotion ? 800 : 0);
      const sb = (b.captured ? getPieceValue(b.captured) * 100 - getPieceValue(b.piece) * 10 : 0) + (b.promotion ? 800 : 0);
      return sb - sa;
    });

    for (const move of sorted) {
      if (move.captured && standPat - getPieceValue(move.captured) * 100 - 200 > beta) continue;

      chess.move(move);
      const score = quiescenceSearch(chess, alpha, beta, true, qDepth - 1);
      chess.undo();
      if (searchTimedOut) return score;
      if (score < beta) beta = score;
      if (alpha >= beta) return alpha;
    }
    return beta;
  }
}

// Helper for move ordering
function getPieceValue(piece: string): number {
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  return values[piece] || 0;
}

function evaluateBoard(chess: Chess): number {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -10000 : 10000;
  }
  if (chess.isDraw()) return 0;
  
  const pieceValues: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
  
  // Piece-square tables for positional evaluation (from white's perspective)
  const pawnTable = [
    0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5,  5, 10, 25, 25, 10,  5,  5,
    0,  0,  0, 20, 20,  0,  0,  0,
    5, -5,-10,  0,  0,-10, -5,  5,
    5, 10, 10,-20,-20, 10, 10,  5,
    0,  0,  0,  0,  0,  0,  0,  0
  ];
  
  const knightTable = [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50
  ];
  
  const bishopTable = [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10,  5, 10, 15, 15, 10,  5,-10,
    -10,  0, 15, 15, 15, 15,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20
  ];
  
  const rookTable = [
    0,  0,  0,  0,  0,  0,  0,  0,
    5, 10, 10, 10, 10, 10, 10,  5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
   -5,  0,  0,  0,  0,  0,  0, -5,
    0,  0,  0,  5,  5,  0,  0,  0
  ];
  
  const queenTable = [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20
  ];
  
  const kingMiddleTable = [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20
  ];
  
  const kingEndgameTable = [
    -50,-40,-30,-20,-20,-30,-40,-50,
    -30,-20,-10,  0,  0,-10,-20,-30,
    -30,-10, 20, 30, 30, 20,-10,-30,
    -30,-10, 30, 40, 40, 30,-10,-30,
    -30,-10, 30, 40, 40, 30,-10,-30,
    -30,-10, 20, 30, 30, 20,-10,-30,
    -30,-30,  0,  0,  0,  0,-30,-30,
    -50,-30,-30,-30,-30,-30,-30,-50
  ];
  
  const tables: Record<string, number[]> = {
    p: pawnTable,
    n: knightTable,
    b: bishopTable,
    r: rookTable,
    q: queenTable,
    k: kingMiddleTable,
  };
  
  let score = 0;
  const board = chess.board();
  
  // Determine game phase for king table selection
  let totalMaterial = 0;
  let wBishopCount = 0, bBishopCount = 0;
  const wPawnCols: number[][] = [[], [], [], [], [], [], [], []];
  const bPawnCols: number[][] = [[], [], [], [], [], [], [], []];
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece) {
        if (piece.type !== 'k' && piece.type !== 'p') {
          totalMaterial += pieceValues[piece.type] || 0;
        }
        if (piece.type === 'b') {
          if (piece.color === 'w') wBishopCount++;
          else bBishopCount++;
        }
        if (piece.type === 'p') {
          if (piece.color === 'w') wPawnCols[col].push(row);
          else bPawnCols[col].push(row);
        }
      }
    }
  }
  
  const isEndgame = totalMaterial < 2600; // ~queen + rook gone
  if (isEndgame) {
    tables['k'] = kingEndgameTable;
  }
  
  // Material + piece-square tables
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece) {
        const value = pieceValues[piece.type] || 0;
        const table = tables[piece.type];
        
        let posBonus = 0;
        if (table) {
          if (piece.color === 'w') {
            posBonus = table[row * 8 + col];
          } else {
            posBonus = table[(7 - row) * 8 + col];
          }
        }
        
        if (piece.color === 'w') {
          score += value + posBonus;
        } else {
          score -= value + posBonus;
        }
      }
    }
  }
  
  // Bishop pair bonus (+30 centipawns)
  if (wBishopCount >= 2) score += 30;
  if (bBishopCount >= 2) score -= 30;
  
  // Pawn structure evaluation
  for (let col = 0; col < 8; col++) {
    // Doubled pawns penalty
    if (wPawnCols[col].length > 1) score -= 20 * (wPawnCols[col].length - 1);
    if (bPawnCols[col].length > 1) score += 20 * (bPawnCols[col].length - 1);
    
    // Isolated pawns penalty (no friendly pawns on adjacent files)
    if (wPawnCols[col].length > 0) {
      const hasNeighbor = (col > 0 && wPawnCols[col-1].length > 0) || (col < 7 && wPawnCols[col+1].length > 0);
      if (!hasNeighbor) score -= 15;
    }
    if (bPawnCols[col].length > 0) {
      const hasNeighbor = (col > 0 && bPawnCols[col-1].length > 0) || (col < 7 && bPawnCols[col+1].length > 0);
      if (!hasNeighbor) score += 15;
    }
    
    // Passed pawns bonus (no opposing pawns on same or adjacent files ahead)
    for (const row of wPawnCols[col]) {
      let isPassed = true;
      for (let r = row - 1; r >= 0; r--) {
        for (let c = Math.max(0, col-1); c <= Math.min(7, col+1); c++) {
          if (bPawnCols[c].includes(r)) { isPassed = false; break; }
        }
        if (!isPassed) break;
      }
      if (isPassed) score += 20 + (7 - row) * 10; // More bonus the further advanced
    }
    for (const row of bPawnCols[col]) {
      let isPassed = true;
      for (let r = row + 1; r <= 7; r++) {
        for (let c = Math.max(0, col-1); c <= Math.min(7, col+1); c++) {
          if (wPawnCols[c].includes(r)) { isPassed = false; break; }
        }
        if (!isPassed) break;
      }
      if (isPassed) score -= 20 + row * 10;
    }
  }
  
  // Rook on open/semi-open file bonus
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type === 'r') {
        const ownPawns = piece.color === 'w' ? wPawnCols[col] : bPawnCols[col];
        const oppPawns = piece.color === 'w' ? bPawnCols[col] : wPawnCols[col];
        if (ownPawns.length === 0 && oppPawns.length === 0) {
          score += piece.color === 'w' ? 25 : -25; // Open file
        } else if (ownPawns.length === 0) {
          score += piece.color === 'w' ? 15 : -15; // Semi-open file
        }
      }
    }
  }
  
  // King safety: pawn shield bonus in middlegame
  if (!isEndgame) {
    // Find king positions
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.type === 'k') {
          let shieldBonus = 0;
          if (piece.color === 'w' && row >= 6) {
            // Check pawns in front of white king
            for (let c = Math.max(0, col-1); c <= Math.min(7, col+1); c++) {
              if (board[row-1]?.[c]?.type === 'p' && board[row-1]?.[c]?.color === 'w') shieldBonus += 15;
              if (board[row-2]?.[c]?.type === 'p' && board[row-2]?.[c]?.color === 'w') shieldBonus += 5;
            }
            score += shieldBonus;
          } else if (piece.color === 'b' && row <= 1) {
            for (let c = Math.max(0, col-1); c <= Math.min(7, col+1); c++) {
              if (board[row+1]?.[c]?.type === 'p' && board[row+1]?.[c]?.color === 'b') shieldBonus += 15;
              if (board[row+2]?.[c]?.type === 'p' && board[row+2]?.[c]?.color === 'b') shieldBonus += 5;
            }
            score -= shieldBonus;
          }
        }
      }
    }
  }
  
  // Mobility: count legal moves (only if not too expensive - approximate with current side)
  const mobility = chess.moves().length;
  score += mobility * 3 * (chess.turn() === 'w' ? 1 : -1);
  
  return score;
}
