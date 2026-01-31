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
const AI_THINK_TIME_MS = 1500; // AI "thinks" for realism

// Piece SVG paths
const PIECE_PATHS: Record<string, string> = {
  wK: '/pieces/wK.svg', wQ: '/pieces/wQ.svg', wR: '/pieces/wR.svg',
  wB: '/pieces/wB.svg', wN: '/pieces/wN.svg', wP: '/pieces/wP.svg',
  bK: '/pieces/bK.svg', bQ: '/pieces/bQ.svg', bR: '/pieces/bR.svg',
  bB: '/pieces/bB.svg', bN: '/pieces/bN.svg', bP: '/pieces/bP.svg',
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
  const [showResult, setShowResult] = useState(false);
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
    
    // Get best move using minimax
    const bestMove = findBestMove(chess, 3); // depth 3 for reasonable difficulty
    
    if (bestMove) {
      chess.move(bestMove);
      setBoard([...chess.board()]);
      setLastMove({ from: bestMove.from as Square, to: bestMove.to as Square });
      setMoveCount(prev => prev + 1);
      
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
      const move = chess.move({ from: selectedSquare, to: square, promotion: 'q' });
      if (move) {
        setBoard([...chess.board()]);
        setLastMove({ from: selectedSquare, to: square });
        setMoveCount(prev => prev + 1);
        
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
      
      const data = await res.json();
      setArenaStats(data.stats);
    } catch (error) {
      console.error('Failed to submit arena result');
    }
    
    setShowResult(true);
  };

  // Resign
  const handleResign = () => {
    if (!gameOver) {
      handleGameEnd('loss', 'resignation');
    }
  };

  // Close result and return to lobby
  const handleCloseResult = () => {
    setShowResult(false);
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
            <p className="text-sm text-white/50">Level 15 • {isAiThinking ? 'Thinking...' : 'Ready'}</p>
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
          <div className="grid grid-cols-8 gap-0 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl">
            {board.flat().map((piece, i) => {
              const row = Math.floor(i / 8);
              const col = i % 8;
              const square = `${'abcdefgh'[col]}${8 - row}` as Square;
              const isLight = (row + col) % 2 === 0;
              const isSelected = selectedSquare === square;
              const isValidMove = validMoves.includes(square);
              const isLastMove = lastMove && (lastMove.from === square || lastMove.to === square);
              const isCheck = chess.isCheck() && piece?.type === 'k' && piece?.color === chess.turn();
              
              return (
                <div
                  key={square}
                  onClick={() => handleSquareClick(square)}
                  className={`
                    aspect-square relative cursor-pointer transition-all
                    ${isLight ? 'bg-[#f0d9b5]' : 'bg-[#b58863]'}
                    ${isSelected ? 'ring-4 ring-yellow-400 ring-inset z-10' : ''}
                    ${isLastMove ? 'bg-yellow-400/40' : ''}
                    ${isCheck ? 'bg-red-500/50' : ''}
                    hover:brightness-110
                  `}
                >
                  {/* Valid move indicator */}
                  {isValidMove && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      {piece ? (
                        <div className="w-full h-full border-4 border-green-500/60 rounded-full" />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-green-500/50" />
                      )}
                    </div>
                  )}
                  
                  {/* Piece */}
                  {piece && (
                    <motion.img
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      src={PIECE_PATHS[`${piece.color}${piece.type.toUpperCase()}`]}
                      alt={`${piece.color}${piece.type}`}
                      className="absolute inset-0 w-full h-full p-1 pointer-events-none"
                      draggable={false}
                    />
                  )}
                </div>
              );
            })}
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

      {/* Result Modal */}
      {showResult && result && arenaStats && (
        <ArenaResultModal
          result={result}
          moveCount={moveCount}
          stats={arenaStats}
          minMovesToCount={MIN_MOVES_TO_COUNT}
          onClose={handleCloseResult}
        />
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
  let score = 0;
  
  const board = chess.board();
  for (const row of board) {
    for (const piece of row) {
      if (piece) {
        const value = pieceValues[piece.type] || 0;
        score += piece.color === 'w' ? value : -value;
      }
    }
  }
  
  // Add position bonuses
  const moves = chess.moves();
  score += moves.length * 5 * (chess.turn() === 'w' ? 1 : -1);
  
  return score;
}
