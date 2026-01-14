'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Trophy, RefreshCw, X, CheckCircle2 } from 'lucide-react';

import { Chess } from 'chess.js';
import { EscrowClient, STAKE_TIERS, getStakeTierInfo, lamportsToSol } from '@/utils/escrow';

type Mode = 'practice' | 'wager';

type ChessGameProps = {
  initialMode?: Mode;
  showModeSelector?: boolean;
  matchPubkey?: string;
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

const pieceToSvg = (piece: { type: string; color: string } | null): string => {
  if (!piece) return '';
  const color = piece.color === 'w' ? 'w' : 'b';
  const type = piece.type.toUpperCase();
  return `/pieces/${color}${type}.svg`;
};

const squareFromRowCol = (row: number, col: number) => {
  const file = FILES[col];
  const rank = 8 - row;
  return `${file}${rank}`;
};

export const ChessGame: React.FC<ChessGameProps> = ({
  initialMode = 'practice',
  showModeSelector = true,
  matchPubkey,
}) => {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { connected, publicKey } = wallet;
  
  const [mode, setMode] = useState<Mode>(initialMode);
  const [selectedStakeTier, setSelectedStakeTier] = useState(1);
  const [isCreatingMatch, setIsCreatingMatch] = useState(false);
  const [isJoiningMatch, setIsJoiningMatch] = useState(false);
  const [matchCreated, setMatchCreated] = useState(false);
  const [currentMatchPubkey, setCurrentMatchPubkey] = useState<PublicKey | null>(
    matchPubkey ? new PublicKey(matchPubkey) : null
  );
  const [gameWinner, setGameWinner] = useState<'w' | 'b' | null>(null);
  const [isSubmittingResult, setIsSubmittingResult] = useState(false);
  const [payoutComplete, setPayoutComplete] = useState(false);
  const [txSignature, setTxSignature] = useState<string>('');
  const [canJoinAt, setCanJoinAt] = useState<number>(0);
  const [showResultModal, setShowResultModal] = useState(false);

  const chessRef = useRef<Chess | null>(null);
  if (!chessRef.current) {
    chessRef.current = new Chess();
  }

  const [fen, setFen] = useState(() => chessRef.current!.fen());
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

  const board = useMemo(() => {
    return chessRef.current!.board();
  }, [fen]);

  const legalDestinations = useMemo(() => {
    if (!selectedSquare) return new Set<string>();
    const moves = chessRef.current!.moves({ square: selectedSquare as any, verbose: true }) as Array<any>;
    return new Set(moves.map((m) => m.to));
  }, [selectedSquare, fen]);

  const statusText = useMemo(() => {
    const chess = chessRef.current!;
    if (chess.isCheckmate()) {
      const winner = chess.turn() === 'w' ? 'b' : 'w';
      if (gameWinner !== winner) {
        setGameWinner(winner);
        setShowResultModal(true);
      }
      return 'Checkmate';
    }
    if (chess.isStalemate()) return 'Stalemate';
    if (chess.isDraw()) return 'Draw';
    const side = chess.turn() === 'w' ? 'White' : 'Black';
    return chess.isCheck() ? `Check — ${side} to move` : `${side} to move`;
  }, [fen, gameWinner]);

  const resetPractice = () => {
    chessRef.current = new Chess();
    setSelectedSquare(null);
    setGameWinner(null);
    setShowResultModal(false);
    setFen(chessRef.current.fen());
  };

  const handleCreateMatch = async () => {
    if (!connected || !publicKey) {
      alert('Please connect your wallet');
      return;
    }

    setIsCreatingMatch(true);
    try {
      const client = new EscrowClient(connection, wallet);
      const { signature, matchPubkey } = await client.createMatch(selectedStakeTier, 30);
      
      setTxSignature(signature);
      setCurrentMatchPubkey(matchPubkey);
      setMatchCreated(true);
      setCanJoinAt(Date.now() + 3000);
      
      alert(`Match created! Signature: ${signature.slice(0, 8)}...`);
    } catch (error) {
      console.error('Error creating match:', error);
      alert(`Failed to create match: ${error}`);
    } finally {
      setIsCreatingMatch(false);
    }
  };

  const handleJoinMatch = async () => {
    if (!connected || !publicKey) {
      alert('Please connect your wallet');
      return;
    }

    if (!currentMatchPubkey) {
      alert('No match selected');
      return;
    }

    if (Date.now() < canJoinAt) {
      const waitSeconds = Math.ceil((canJoinAt - Date.now()) / 1000);
      alert(`Please wait ${waitSeconds} seconds before joining`);
      return;
    }

    setIsJoiningMatch(true);
    try {
      const client = new EscrowClient(connection, wallet);
      const signature = await client.joinMatch(currentMatchPubkey);
      
      setTxSignature(signature);
      alert(`Joined match! Signature: ${signature.slice(0, 8)}...`);
    } catch (error) {
      console.error('Error joining match:', error);
      alert(`Failed to join match: ${error}`);
    } finally {
      setIsJoiningMatch(false);
    }
  };

  const handleSubmitResult = async () => {
    if (!connected || !publicKey || !currentMatchPubkey || !gameWinner) {
      return;
    }

    setIsSubmittingResult(true);
    try {
      const client = new EscrowClient(connection, wallet);
      
      const matchData = await client.fetchMatch(currentMatchPubkey);
      if (!matchData) {
        alert('Could not fetch match data');
        return;
      }

      const winnerPubkey = gameWinner === 'w' ? matchData.playerA : matchData.playerB!;
      
      const signature = await client.submitResult(currentMatchPubkey, winnerPubkey);
      setTxSignature(signature);
      
      await handleConfirmPayout(winnerPubkey, matchData.playerA);
    } catch (error) {
      console.error('Error submitting result:', error);
      alert(`Failed to submit result: ${error}`);
    } finally {
      setIsSubmittingResult(false);
    }
  };

  const handleConfirmPayout = async (winner: PublicKey, playerA: PublicKey) => {
    if (!connected || !publicKey || !currentMatchPubkey) {
      return;
    }

    try {
      const client = new EscrowClient(connection, wallet);
      const signature = await client.confirmPayout(currentMatchPubkey, winner, playerA);
      
      setTxSignature(signature);
      setPayoutComplete(true);
      
      alert(`Payout complete! Winner received reward. Signature: ${signature.slice(0, 8)}...`);
    } catch (error) {
      console.error('Error confirming payout:', error);
      alert(`Failed to confirm payout: ${error}`);
    }
  };

  useEffect(() => {
    if (mode === 'wager' && gameWinner && currentMatchPubkey && !payoutComplete && !isSubmittingResult) {
      const timer = setTimeout(() => {
        handleSubmitResult();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [gameWinner, mode, currentMatchPubkey, payoutComplete]);

  const maybeAutoPromote = (from: string, to: string) => {
    const chess = chessRef.current!;
    const piece = chess.get(from as any) as any;
    if (!piece || piece.type !== 'p') return undefined;
    const toRank = Number(to[1]);
    if (piece.color === 'w' && toRank === 8) return 'q';
    if (piece.color === 'b' && toRank === 1) return 'q';
    return undefined;
  };

  const playComputerMove = React.useCallback(() => {
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
  }, []);

  const onSquareClick = (square: string) => {
    const chess = chessRef.current!;

    if (chess.isGameOver()) return;

    if (mode === 'practice') {
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
  }, [fen, mode, playComputerMove]);

  const getMatchInfo = () => {
    if (!matchCreated) return null;
    const tier = getStakeTierInfo(selectedStakeTier);
    return {
      stake: tier.label,
      pot: `${tier.tier * 1.8} SOL`,
    };
  };

  const matchInfo = getMatchInfo();

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 max-w-6xl mx-auto">
        {/* Chess Board */}
        <div className="flex-1 flex flex-col items-center w-full">
          {/* Match Header */}
          {mode === 'wager' && matchInfo && (
            <div className="w-full max-w-[480px] glass-card border-solana-purple/20 rounded-xl lg:rounded-2xl p-3 lg:p-4 shadow-glow-sm mb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <Swords className="h-4 w-4 text-solana-purple" />
                  <span className="font-medium">Staked Match</span>
                </div>
                <div className="flex gap-3 sm:gap-4 text-neutral-300">
                  <span>Stake: <span className="text-white font-semibold">{matchInfo.stake}</span></span>
                  <span className="text-neutral-600">|</span>
                  <span>Pot: <span className="text-solana-green font-semibold">{matchInfo.pot}</span></span>
                </div>
              </div>
            </div>
          )}

          <div className="w-full max-w-[480px] space-y-4">
            <div className="glass-card rounded-xl lg:rounded-2xl p-3 lg:p-4 shadow-glow">
              <div className="aspect-square w-full overflow-hidden rounded-xl border-2 border-white/10">
                <div className="grid h-full w-full grid-cols-8 grid-rows-8">
              {Array.from({ length: 64 }).map((_, i) => {
                const row = Math.floor(i / 8);
                const col = i % 8;
                const isLight = (row + col) % 2 === 0;
                const square = squareFromRowCol(row, col);
                const piece = board[row]?.[col] ?? null;
                const svgPath = pieceToSvg(piece as any);

                const isSelected = selectedSquare === square;
                const isLegal = legalDestinations.has(square);

                return (
                  <motion.button
                    type="button"
                    key={i}
                    onClick={() => onSquareClick(square)}
                    whileHover={piece ? { scale: 1.05 } : {}}
                    whileTap={{ scale: 0.95 }}
                    className={`relative flex items-center justify-center select-none transition-all ${
                      isLight ? 'bg-neutral-200' : 'bg-neutral-600'
                    } ${
                      isSelected ? 'ring-4 ring-inset ring-solana-green bg-solana-green/20' : ''
                    }`}
                    style={{ borderRadius: '2px' }}
                    aria-label={square}
                  >
                    {isLegal && !piece && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-3 h-3 rounded-full bg-solana-green opacity-50" />
                      </div>
                    )}
                    {isLegal && piece && (
                      <div className="absolute inset-0 rounded-full ring-4 ring-inset ring-solana-green opacity-50" />
                    )}
                    {piece && svgPath && (
                      <motion.div
                        initial={false}
                        animate={{ scale: isSelected ? 1.1 : 1 }}
                        className="relative w-[80%] h-[80%]"
                      >
                        <img
                          src={svgPath}
                          alt=""
                          className="w-full h-full object-contain pointer-events-none drop-shadow-lg"
                          draggable={false}
                        />
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
        
        <div className="text-center py-3">
          <p className="text-sm font-medium text-neutral-400">
            {statusText}
          </p>
        </div>
      </div>

      {/* Game Controls */}
      <div className="w-full lg:w-80 space-y-4">
        <div className="glass-card rounded-xl lg:rounded-2xl p-4 lg:p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Game Mode</h3>
              {showModeSelector && (
                <div className="flex rounded-xl border border-white/10 bg-black/40 p-1">
                  <button
                    type="button"
                    onClick={() => setMode('practice')}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                      mode === 'practice'
                        ? 'bg-gradient-to-r from-solana-purple to-solana-green text-white'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Practice
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('wager')}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                      mode === 'wager'
                        ? 'bg-gradient-to-r from-solana-purple to-solana-green text-white'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Wager
                  </button>
                </div>
              )}
            </div>

            {mode === 'practice' ? (
              <div className="space-y-4">
                <p className="text-sm text-neutral-400">
                  Train against AI. No stakes required.
                </p>
                <motion.button
                  type="button"
                  onClick={resetPractice}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-center gap-2 btn-glow text-white font-semibold py-3 px-6 rounded-xl"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reset Game
                </motion.button>
              </div>
            ) : (
              <>
                {connected ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500 mb-3">
                        Stake Amount
                      </label>
                      <select
                        value={selectedStakeTier}
                        onChange={(e) => setSelectedStakeTier(Number(e.target.value))}
                        disabled={matchCreated}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-solana-purple text-white disabled:opacity-50 transition-all"
                      >
                        {STAKE_TIERS.map((tier) => (
                          <option key={tier.tier} value={tier.tier}>
                            {tier.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-neutral-500 mt-2">
                        10% platform fee on payout
                      </p>
                    </div>

                    {payoutComplete ? (
                      <div className="bg-solana-green/10 border border-solana-green/30 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Trophy className="h-5 w-5 text-solana-green" />
                          <p className="text-solana-green font-semibold">Payout Complete</p>
                        </div>
                        <p className="text-xs text-neutral-400 break-all font-mono">
                          {txSignature.slice(0, 8)}...{txSignature.slice(-8)}
                        </p>
                      </div>
                    ) : gameWinner ? (
                      <div className="bg-solana-purple/10 border border-solana-purple/30 rounded-xl p-4">
                        <p className="text-solana-purple font-semibold">
                          {isSubmittingResult ? 'Finalizing...' : 'Processing...'}
                        </p>
                      </div>
                    ) : matchCreated ? (
                      <div className="bg-solana-purple/10 border border-solana-purple/30 rounded-xl p-4">
                        <p className="text-white font-semibold mb-1">Match Active</p>
                        <p className="text-sm text-neutral-300">
                          {getStakeTierInfo(selectedStakeTier).label}
                        </p>
                      </div>
                    ) : (
                      <>
                        <motion.button
                          onClick={handleCreateMatch}
                          disabled={isCreatingMatch}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="w-full btn-glow text-white font-semibold py-3 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isCreatingMatch ? 'Creating...' : 'Create Match'}
                        </motion.button>

                        <motion.button
                          onClick={handleJoinMatch}
                          disabled={isJoiningMatch || !currentMatchPubkey}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="w-full bg-white/5 hover:bg-white/10 text-white font-semibold py-3 px-6 rounded-xl border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          {isJoiningMatch ? 'Joining...' : 'Join Match'}
                        </motion.button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-neutral-500 text-sm">
                      Connect wallet to stake
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Result Modal */}
    <AnimatePresence>
      {showResultModal && gameWinner && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center z-[9999] p-4"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
          }}
          onClick={() => setShowResultModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="glass-card border-solana-purple/30 rounded-2xl p-6 w-[320px] shadow-glow relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Victory + Knight Icon + Check */}
            <div className="flex items-center justify-center gap-1.5 mb-3">
              <img 
                src="/pieces/wN.svg" 
                alt="Knight" 
                className="w-3.5 h-3.5 flex-shrink-0"
              />
              <h2 className="text-sm font-bold text-white whitespace-nowrap">
                Victory!
              </h2>
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />
            </div>

            {/* You vs Opponent */}
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="flex flex-col items-center gap-1">
                <img 
                  src={gameWinner === 'w' ? '/pieces/wK.svg' : '/pieces/bK.svg'} 
                  alt="You" 
                  className="w-6 h-6 flex-shrink-0"
                />
                <span className="text-[10px] font-medium text-neutral-400 uppercase">You</span>
              </div>
              
              <div className="text-xs font-bold text-purple-400">VS</div>
              
              <div className="flex flex-col items-center gap-1">
                <img 
                  src={gameWinner === 'w' ? '/pieces/bK.svg' : '/pieces/wK.svg'} 
                  alt="Opponent" 
                  className="w-6 h-6 flex-shrink-0"
                />
                <span className="text-[10px] font-medium text-neutral-400 uppercase">Opp</span>
              </div>
            </div>

            {/* Reward Section (for wager mode) */}
            {mode === 'wager' && matchCreated && (
              <div className="mb-3 text-center">
                <p className="text-[10px] font-medium text-neutral-400 uppercase mb-1">Reward</p>
                <div className="bg-gradient-to-r from-purple-600/20 to-purple-400/20 border border-purple-500/30 rounded-lg py-2 px-3">
                  <p className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-purple-200">
                    +{getStakeTierInfo(selectedStakeTier).stake * 1.8} SOL
                  </p>
                </div>
                {payoutComplete && (
                  <p className="text-[10px] text-emerald-400 mt-1 font-medium">
                    ✓ Claimed
                  </p>
                )}
              </div>
            )}

            {/* Status Text (for practice or other info) */}
            {mode === 'practice' && (
              <p className="text-center text-neutral-300 text-[11px] mb-3 opacity-80">
                {statusText}
              </p>
            )}

            {/* Dismiss Button */}
            <motion.button
              onClick={() => {
                setShowResultModal(false);
                if (mode === 'practice') resetPractice();
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white font-semibold py-2 px-4 rounded-lg transition-all text-sm"
            >
              Dismiss
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
};
