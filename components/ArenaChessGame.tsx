'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Chess, Square, Move } from 'chess.js';
import { RotateCcw, Flag, Clock, Cpu, User } from 'lucide-react';
import { ArenaResultModal } from './ArenaResultModal';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://solmate-production.up.railway.app';

// Arena constants
const MAX_GAMES_PER_DAY = 20;
const MIN_MOVES_TO_COUNT = 10;
const COOLDOWN_SECONDS = 30;
const AI_THINK_TIME_MS = 300; // AI "thinks" for realism
const AI_DEPTH = 3; // Minimax depth for AI strength
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

// Piece SVG paths
const PIECE_PATHS: Record<string, string> = {
  wK: '/pieces/wK.svg', wQ: '/pieces/wQ.svg', wR: '/pieces/wR.svg',
  wB: '/pieces/wB.svg', wN: '/pieces/wN.svg', wP: '/pieces/wP.svg',
  bK: '/pieces/bK.svg', bQ: '/pieces/bQ.svg', bR: '/pieces/bR.svg',
  bB: '/pieces/bB.svg', bN: '/pieces/bN.svg', bP: '/pieces/bP.svg',
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
  
  // Result state
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState<'win' | 'loss' | 'draw' | null>(null);
  const [arenaStats, setArenaStats] = useState<ArenaStats | null>(null);
  
  // Time control (10 min per side)
  const [playerTime, setPlayerTime] = useState(600);
  const [aiTime, setAiTime] = useState(600);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
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
    
    // Get best move using minimax with increased depth
    const bestMove = findBestMove(chess, AI_DEPTH);
    
    if (bestMove) {
      const isCapture = chess.get(bestMove.to as Square) !== null;
      const isCastle = bestMove.san?.includes('O-O') || (bestMove.piece === 'k' && Math.abs(bestMove.from.charCodeAt(0) - bestMove.to.charCodeAt(0)) === 2);
      
      chess.move(bestMove);
      setBoard([...chess.board()]);
      setLastMove({ from: bestMove.from as Square, to: bestMove.to as Square });
      setMoveCount(prev => prev + 1);
      
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
      
      // Check for game end
      if (chess.isCheckmate()) {
        handleGameEnd('loss', 'checkmate');
      } else if (chess.isDraw()) {
        handleGameEnd('draw', 'draw');
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
      const targetPiece = chess.get(square);
      const isCapture = targetPiece !== null;
      const movingPiece = chess.get(selectedSquare);
      const isCastle = movingPiece?.type === 'k' && Math.abs(selectedSquare.charCodeAt(0) - square.charCodeAt(0)) === 2;
      
      const move = chess.move({ from: selectedSquare, to: square, promotion: 'q' });
      if (move) {
        setBoard([...chess.board()]);
        setLastMove({ from: selectedSquare, to: square });
        setMoveCount(prev => prev + 1);
        
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
        
        // Check for game end
        if (chess.isCheckmate()) {
          handleGameEnd('win', 'checkmate');
        } else if (chess.isDraw()) {
          handleGameEnd('draw', 'draw');
        }
      }
    }
    
    setSelectedSquare(null);
    setValidMoves([]);
  };

  // Handle game end
  const handleGameEnd = async (gameResult: 'win' | 'loss' | 'draw', reason: string) => {
    setGameOver(true);
    setResult(gameResult);
    
    if (timerRef.current) clearInterval(timerRef.current);
    
    // Check if game counts (minimum moves requirement)
    const counts = moveCount >= MIN_MOVES_TO_COUNT;
    
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
          moveCount,
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
      handleGameEnd('loss', 'resignation');
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
            className="mt-6 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
          >
            Back to Arena
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Game Header */}
      <div className="flex items-center justify-between mb-4 px-4">
        {/* AI Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold">SolMate AI</p>
            <p className="text-sm text-white/50">Level 20 • {isAiThinking ? 'Thinking...' : 'Ready'}</p>
          </div>
        </div>
        
        {/* AI Timer */}
        <div className={`px-4 py-2 rounded-lg font-mono text-lg ${
          chess.turn() !== playerColor ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/10 text-white/60'
        }`}>
          <Clock className="w-4 h-4 inline-block mr-2" />
          {formatTime(aiTime)}
        </div>
      </div>

      {/* Chess Board */}
      <div className="relative">
        <div className="aspect-square max-w-[600px] mx-auto">
          <div className="w-full h-full overflow-hidden rounded-xl border-2 border-white/20 shadow-2xl">
            <div className="grid grid-cols-8 grid-rows-8 h-full w-full">
            {Array.from({ length: 64 }).map((_, i) => {
              const row = Math.floor(i / 8);
              const col = i % 8;
              const visualRow = row;
              const visualCol = col;
              const square = `${FILES[col]}${8 - row}` as Square;
              const piece = board[row]?.[col] ?? null;
              const isLight = (row + col) % 2 === 0;
              const isSelected = selectedSquare === square;
              const isValidMove = validMoves.includes(square);
              const isLastMoveSquare = lastMove && (lastMove.from === square || lastMove.to === square);
              const isCheck = chess.isCheck() && piece?.type === 'k' && piece?.color === chess.turn();
              
              // Coordinate labels
              const showRank = visualCol === 0; // Left edge
              const showFile = visualRow === 7; // Bottom edge
              const rank = 8 - visualRow;
              const file = FILES[visualCol];
              
              // Background color with priority
              let bgColor = isLight ? '#e5e5e5' : '#525252';
              if (isLastMoveSquare && !isSelected && !isCheck) {
                bgColor = isLight ? '#fcd34d' : '#b45309'; // amber highlight
              }
              if (isSelected) {
                bgColor = '#34d399'; // emerald
              }
              if (isCheck) {
                bgColor = '#ef4444'; // red
              }
              
              return (
                <button
                  key={square}
                  type="button"
                  onClick={() => handleSquareClick(square)}
                  className="relative flex items-center justify-center select-none transition-all hover:brightness-110"
                  style={{ 
                    backgroundColor: bgColor,
                    boxShadow: isSelected ? 'inset 0 0 0 4px #10b981' : isCheck ? 'inset 0 0 0 4px #b91c1c' : undefined,
                  }}
                >
                  {/* Piece */}
                  {piece && (
                    <motion.img
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: isSelected ? 1.1 : 1, opacity: 1 }}
                      src={PIECE_PATHS[`${piece.color}${piece.type.toUpperCase()}`]}
                      alt={`${piece.color}${piece.type}`}
                      className="w-[80%] h-[80%] object-contain pointer-events-none drop-shadow-lg"
                      style={{ zIndex: 1 }}
                      draggable={false}
                    />
                  )}
                  
                  {/* Legal move dot (empty square) */}
                  {isValidMove && !piece && (
                    <div 
                      style={{
                        position: 'absolute',
                        width: '30%',
                        height: '30%',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(0, 0, 0, 0.25)',
                        zIndex: 10,
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                  
                  {/* Legal capture indicator (square with piece) */}
                  {isValidMove && piece && (
                    <div 
                      style={{
                        position: 'absolute',
                        inset: '4px',
                        borderRadius: '50%',
                        border: '5px solid rgba(0, 0, 0, 0.25)',
                        zIndex: 10,
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                  
                  {/* Rank numbers on left edge */}
                  {showRank && (
                    <span 
                      className="pointer-events-none select-none"
                      style={{ 
                        position: 'absolute',
                        top: '2px',
                        left: '3px',
                        fontSize: '10px',
                        fontWeight: 700,
                        lineHeight: 1,
                        color: isLight ? '#525252' : '#d4d4d4',
                        zIndex: 5,
                      }}
                    >
                      {rank}
                    </span>
                  )}
                  
                  {/* File letters on bottom edge */}
                  {showFile && (
                    <span 
                      className="pointer-events-none select-none"
                      style={{ 
                        position: 'absolute',
                        bottom: '2px',
                        right: '3px',
                        fontSize: '10px',
                        fontWeight: 700,
                        lineHeight: 1,
                        color: isLight ? '#525252' : '#d4d4d4',
                        zIndex: 5,
                      }}
                    >
                      {file}
                    </span>
                  )}
                </button>
              );
            })}
            </div>
          </div>
        </div>
        
        {/* Thinking Overlay */}
        {isAiThinking && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
            <div className="px-6 py-3 rounded-xl bg-purple-600 text-white font-semibold animate-pulse">
              <Cpu className="w-5 h-5 inline-block mr-2 animate-spin" />
              AI is thinking...
            </div>
          </div>
        )}
      </div>

      {/* Player Info */}
      <div className="flex items-center justify-between mt-4 px-4">
        {/* Player Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-solana-purple to-solana-green flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold">You</p>
            <p className="text-sm text-white/50">Move {Math.ceil(moveCount / 2)}</p>
          </div>
        </div>
        
        {/* Player Timer */}
        <div className={`px-4 py-2 rounded-lg font-mono text-lg ${
          chess.turn() === playerColor ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/60'
        }`}>
          <Clock className="w-4 h-4 inline-block mr-2" />
          {formatTime(playerTime)}
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-4 mt-6">
        <button
          onClick={handleResign}
          disabled={gameOver}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold transition-colors disabled:opacity-50"
        >
          <Flag className="w-5 h-5" />
          Resign
        </button>
      </div>

      {/* Game Stats */}
      <div className="mt-6 text-center text-white/50 text-sm">
        Moves: {moveCount} {moveCount < MIN_MOVES_TO_COUNT && `(${MIN_MOVES_TO_COUNT - moveCount} more needed to count)`}
      </div>

      {/* Result Modal - inline with forced visibility */}
      {gameOver && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99998,
          }}
        >
          <div style={{
            backgroundColor: result === 'win' ? '#166534' : result === 'loss' ? '#7f1d1d' : '#374151',
            padding: '32px',
            borderRadius: '16px',
            border: `2px solid ${result === 'win' ? '#4ade80' : result === 'loss' ? '#f87171' : '#9ca3af'}`,
            maxWidth: '400px',
            width: '100%',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>
              {result === 'win' ? '🏆' : result === 'loss' ? '😔' : '🤝'}
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', marginBottom: '8px' }}>
              {result === 'win' ? 'Victory!' : result === 'loss' ? 'Defeat' : 'Draw'}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '16px' }}>
              {result === 'win' ? 'You defeated the AI!' : result === 'loss' ? 'The AI won this time' : 'The game ended in a draw'}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '24px' }}>Moves played: {moveCount}</p>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={handleCloseResult}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  color: 'white',
                }}
              >
                Continue
              </button>
              <button
                onClick={() => {
                  const text = `I just ${result === 'win' ? 'defeated' : result === 'loss' ? 'lost to' : 'drew with'} the SolMate AI in ${moveCount} moves! ♟️\n\nPlay now: https://playsolmate.fun/arena`;
                  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
                }}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#3b82f6',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  color: 'white',
                }}
              >
                Share on X
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple minimax AI
function findBestMove(chess: Chess, depth: number): Move | null {
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;
  
  let bestMove: Move | null = null;
  let bestScore = chess.turn() === 'b' ? Infinity : -Infinity;
  
  for (const move of moves) {
    chess.move(move);
    const score = minimax(chess, depth - 1, -Infinity, Infinity, chess.turn() === 'b');
    chess.undo();
    
    if (chess.turn() === 'b') {
      // AI plays black, wants minimum score
      if (score < bestScore) {
        bestScore = score;
        bestMove = move;
      }
    } else {
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
  }
  
  return bestMove;
}

function minimax(chess: Chess, depth: number, alpha: number, beta: number, maximizing: boolean): number {
  if (depth === 0 || chess.isGameOver()) {
    return evaluateBoard(chess);
  }
  
  const moves = chess.moves({ verbose: true });
  
  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      chess.move(move);
      const eval_ = minimax(chess, depth - 1, alpha, beta, false);
      chess.undo();
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
      minEval = Math.min(minEval, eval_);
      beta = Math.min(beta, eval_);
      if (beta <= alpha) break;
    }
    return minEval;
  }
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
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
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
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece) {
        const value = pieceValues[piece.type] || 0;
        const table = tables[piece.type];
        
        // Get position bonus from table
        let posBonus = 0;
        if (table) {
          if (piece.color === 'w') {
            posBonus = table[row * 8 + col];
          } else {
            // Mirror for black
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
  
  // Add mobility bonus
  const moves = chess.moves();
  score += moves.length * 5 * (chess.turn() === 'w' ? 1 : -1);
  
  return score;
}
