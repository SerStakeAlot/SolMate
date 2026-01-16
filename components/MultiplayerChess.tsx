'use client';

import { useEffect, useState, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { io, Socket } from 'socket.io-client';
import { Chess } from 'chess.js';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Trophy, Swords, LogOut, Users } from 'lucide-react';

const BACKEND_URL = 'https://solmate-production.up.railway.app';

interface MatchmakingProps {
  onCancel: () => void;
}

interface GameRoomProps {
  socket: Socket;
  roomId: string;
  yourColor: 'w' | 'b';
  opponent: any;
  stakeTier: number;
  onExit: () => void;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

const pieceToSvg = (piece: { type: string; color: string } | null): string => {
  if (!piece) return '';
  const color = piece.color === 'w' ? 'w' : 'b';
  const type = piece.type.toUpperCase();
  return `/pieces/${color}${type}.svg`;
};

const squareFromRowCol = (row: number, col: number, flipped: boolean) => {
  const file = FILES[flipped ? 7 - col : col];
  const rank = flipped ? row + 1 : 8 - row;
  return `${file}${rank}`;
};

const STAKE_TIERS = [
  { tier: 0, amount: 0.5, label: '0.5 SOL' },
  { tier: 1, amount: 1.0, label: '1 SOL' },
];

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function MatchmakingQueue({ onCancel }: MatchmakingProps) {
  const [queuePosition, setQueuePosition] = useState(1);
  const [queueSize, setQueueSize] = useState(1);

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card rounded-2xl p-10 max-w-md w-full text-center"
      >
        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full border-2 border-solana-purple/30 animate-ping" />
          </div>
          <div className="relative w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-solana-purple/20 to-solana-green/20 flex items-center justify-center">
            <Users className="h-10 w-10 text-solana-purple" />
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-3">Finding Opponent</h2>
        <p className="text-neutral-400 mb-8">
          Searching for a player at your stake tier
        </p>
        <div className="bg-white/5 rounded-xl p-5 mb-8 border border-white/5">
          <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Queue Position</p>
          <p className="text-4xl font-bold text-gradient">{queuePosition} <span className="text-neutral-600">/</span> {queueSize}</p>
        </div>
        <button
          onClick={onCancel}
          className="w-full bg-white/5 hover:bg-white/10 text-white font-semibold py-3.5 px-6 rounded-xl transition-all border border-white/10 hover:border-white/20"
        >
          Cancel Search
        </button>
      </motion.div>
    </div>
  );
}

function GameRoom({ socket, roomId, yourColor, opponent, stakeTier, onExit }: GameRoomProps) {
  const chessRef = useRef<Chess | null>(null);
  if (!chessRef.current) {
    chessRef.current = new Chess();
  }

  const [fen, setFen] = useState(() => chessRef.current!.fen());
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [whiteTime, setWhiteTime] = useState(600000); // 10 minutes in ms
  const [blackTime, setBlackTime] = useState(600000);
  const [currentTurn, setCurrentTurn] = useState<'w' | 'b'>('w');
  const [gameStatus, setGameStatus] = useState<'active' | 'finished'>('active');
  const [winner, setWinner] = useState<'w' | 'b' | 'draw' | null>(null);
  const [endReason, setEndReason] = useState<string>('');

  const isFlipped = yourColor === 'b';
  const isMyTurn = currentTurn === yourColor;

  useEffect(() => {
    // Listen for opponent moves
    socket.on('game:move', ({ move, timeUpdate }) => {
      const chess = chessRef.current!;
      try {
        chess.move({
          from: move.from,
          to: move.to,
          promotion: move.promotion,
        });
        setFen(chess.fen());
        setWhiteTime(timeUpdate.whiteTimeMs);
        setBlackTime(timeUpdate.blackTimeMs);
        setCurrentTurn(timeUpdate.currentTurn);
      } catch (error) {
        console.error('Invalid move from opponent:', error);
      }
    });

    // Listen for time updates
    socket.on('game:timeUpdate', ({ whiteTimeMs, blackTimeMs, currentTurn }) => {
      setWhiteTime(whiteTimeMs);
      setBlackTime(blackTimeMs);
      setCurrentTurn(currentTurn);
    });

    // Listen for game end
    socket.on('game:end', ({ winner, reason }) => {
      setGameStatus('finished');
      setWinner(winner);
      setEndReason(reason);
    });

    return () => {
      socket.off('game:move');
      socket.off('game:timeUpdate');
      socket.off('game:end');
    };
  }, [socket]);

  const handleSquareClick = (square: string) => {
    if (gameStatus !== 'active' || !isMyTurn) return;

    const chess = chessRef.current!;

    if (selectedSquare) {
      // Try to make a move
      try {
        const move = chess.move({
          from: selectedSquare,
          to: square,
          promotion: 'q', // Always promote to queen for simplicity
        });

        if (move) {
          setFen(chess.fen());
          setSelectedSquare(null);

          // Send move to server
          socket.emit('game:makeMove', {
            roomId,
            move: {
              from: move.from,
              to: move.to,
              promotion: move.promotion,
              fen: chess.fen(),
              san: move.san,
            },
          });

          // Check for game end
          if (chess.isCheckmate()) {
            socket.emit('game:end', {
              roomId,
              winner: chess.turn() === 'w' ? 'b' : 'w',
              reason: 'checkmate',
            });
          } else if (chess.isDraw()) {
            socket.emit('game:end', {
              roomId,
              winner: 'draw',
              reason: 'draw',
            });
          }
        }
      } catch (error) {
        // Invalid move, try selecting the clicked square instead
        const piece = chess.get(square as any);
        if (piece && piece.color === yourColor) {
          setSelectedSquare(square);
        } else {
          setSelectedSquare(null);
        }
      }
    } else {
      // Select piece
      const piece = chess.get(square as any);
      if (piece && piece.color === yourColor) {
        setSelectedSquare(square);
      }
    }
  };

  const handleResign = () => {
    if (window.confirm('Are you sure you want to resign?')) {
      socket.emit('game:resign', { roomId });
    }
  };

  const board = chessRef.current!.board();
  const stakeTierInfo = STAKE_TIERS[stakeTier];

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-6xl mx-auto">
      {/* Chess Board */}
      <div className="flex-1 flex flex-col items-center">
        <div className="w-full max-w-[600px]">
          {/* Opponent Info */}
          <div className="glass-card rounded-xl p-4 mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Opponent</p>
              <p className="font-semibold truncate">{opponent.walletAddress.slice(0, 8)}...</p>
              <p className="text-xs text-solana-green">{opponent.rank}</p>
            </div>
            <div className={`flex items-center gap-2 text-2xl font-mono px-4 py-2 rounded-lg ${
              (!isFlipped && currentTurn === 'b') || (isFlipped && currentTurn === 'w')
                ? 'bg-solana-purple/20 text-white'
                : 'bg-white/5 text-neutral-400'
            }`}>
              <Clock className="h-5 w-5" />
              {formatTime(isFlipped ? whiteTime : blackTime)}
            </div>
          </div>

          {/* Chess Board */}
          <div className="aspect-square w-full rounded-2xl overflow-hidden shadow-glow border-4 border-white/10">
            {board.map((row, rowIndex) => (
              <div key={rowIndex} className="flex h-[12.5%]">
                {row.map((piece, colIndex) => {
                  const square = squareFromRowCol(rowIndex, colIndex, isFlipped);
                  const isLight = (rowIndex + colIndex) % 2 === 0;
                  const isSelected = selectedSquare === square;

                  return (
                    <button
                      key={square}
                      onClick={() => handleSquareClick(square)}
                      className={`relative flex-1 flex items-center justify-center transition-all ${
                        isLight ? 'bg-neutral-200' : 'bg-neutral-600'
                      } ${isSelected ? 'ring-4 ring-solana-green ring-inset bg-solana-green/20' : ''} ${
                        isMyTurn && gameStatus === 'active' ? 'cursor-pointer hover:brightness-110' : 'cursor-default'
                      }`}
                      disabled={!isMyTurn || gameStatus !== 'active'}
                    >
                      {piece && (
                        <img
                          src={pieceToSvg(piece)}
                          alt={`${piece.color}${piece.type}`}
                          className="w-[80%] h-[80%] object-contain drop-shadow-lg"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Your Info */}
          <div className="glass-card rounded-xl p-4 mt-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">You ({yourColor === 'w' ? 'White' : 'Black'})</p>
              <p className={`text-sm font-medium ${isMyTurn ? 'text-solana-green' : 'text-neutral-400'}`}>
                {isMyTurn ? '● Your Turn' : '○ Waiting...'}
              </p>
            </div>
            <div className={`flex items-center gap-2 text-2xl font-mono px-4 py-2 rounded-lg ${
              (!isFlipped && currentTurn === 'w') || (isFlipped && currentTurn === 'b')
                ? 'bg-solana-purple/20 text-white'
                : 'bg-white/5 text-neutral-400'
            }`}>
              <Clock className="h-5 w-5" />
              {formatTime(isFlipped ? blackTime : whiteTime)}
            </div>
          </div>
        </div>
      </div>

      {/* Game Info Panel */}
      <div className="lg:w-80">
        <div className="glass-card rounded-2xl p-6 sticky top-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-solana-purple/20 to-solana-green/20 flex items-center justify-center">
              <Swords className="h-5 w-5 text-solana-purple" />
            </div>
            <h3 className="text-xl font-bold">Live Match</h3>
          </div>

          <div className="space-y-4 mb-6">
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Stake</p>
              <p className="text-2xl font-bold text-gradient">{stakeTierInfo.label}</p>
            </div>

            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Status</p>
              <p className="text-lg font-semibold flex items-center gap-2">
                {gameStatus === 'active' ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-solana-green animate-pulse" />
                    In Progress
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-neutral-500" />
                    Finished
                  </>
                )}
              </p>
            </div>
          </div>

          {gameStatus === 'active' && (
            <button
              onClick={handleResign}
              className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 font-semibold py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2 border border-red-500/20"
            >
              <LogOut className="h-5 w-5" />
              Resign
            </button>
          )}

          {gameStatus === 'finished' && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
                <Trophy className="h-8 w-8 text-yellow-400" />
              </div>
              <p className="text-2xl font-bold mb-2">
                {winner === 'draw' ? 'Draw!' : winner === yourColor ? 'Victory!' : 'Defeat'}
              </p>
              <p className="text-sm text-neutral-400 mb-6">{endReason}</p>
              <button
                onClick={onExit}
                className="w-full btn-glow font-bold py-3.5 px-6 rounded-xl text-white"
              >
                Exit Game
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function MultiplayerChess() {
  const { publicKey, connected } = useWallet();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<number>(1);
  const [status, setStatus] = useState<'idle' | 'searching' | 'matched' | 'playing'>('idle');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [yourColor, setYourColor] = useState<'w' | 'b'>('w');
  const [opponent, setOpponent] = useState<any>(null);

  useEffect(() => {
    if (!connected || !publicKey) {
      return;
    }

    // Connect to backend
    const newSocket = io(BACKEND_URL);

    newSocket.on('connect', () => {
      console.log('Connected to backend');
      // Register player
      newSocket.emit('player:register', {
        walletAddress: publicKey.toString(),
      });
    });

    newSocket.on('player:registered', (data) => {
      console.log('Player registered:', data);
      setPlayerId(data.playerId);
    });

    newSocket.on('matchmaking:matched', (data) => {
      console.log('Match found:', data);
      setStatus('matched');
      setRoomId(data.roomId);
      
      // Join the game room
      newSocket.emit('game:joinRoom', { roomId: data.roomId });
    });

    newSocket.on('game:joined', (data) => {
      console.log('Joined game:', data);
      setYourColor(data.yourColor);
      setOpponent(data.opponent);
      setStatus('playing');
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
      alert(error.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [connected, publicKey]);

  const handleJoinQueue = (tier: number) => {
    if (!socket || !playerId) {
      alert('Please wait for connection...');
      return;
    }

    setSelectedTier(tier);
    setStatus('searching');
    socket.emit('matchmaking:join', { stakeTier: tier });
  };

  const handleCancelSearch = () => {
    if (socket) {
      socket.emit('matchmaking:leave');
    }
    setStatus('idle');
  };

  const handleExitGame = () => {
    setStatus('idle');
    setRoomId(null);
    setYourColor('w');
    setOpponent(null);
  };

  if (!connected) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-center glass-card rounded-2xl p-10">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center">
            <Users className="w-8 h-8 text-neutral-500" />
          </div>
          <p className="text-xl text-neutral-400 mb-2">Connect Your Wallet</p>
          <p className="text-sm text-neutral-500">to access multiplayer matches</p>
        </div>
      </div>
    );
  }

  if (status === 'searching') {
    return <MatchmakingQueue onCancel={handleCancelSearch} />;
  }

  if (status === 'playing' && socket && roomId && opponent) {
    return (
      <GameRoom
        socket={socket}
        roomId={roomId}
        yourColor={yourColor}
        opponent={opponent}
        stakeTier={selectedTier}
        onExit={handleExitGame}
      />
    );
  }

  // Tier selection
  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl w-full"
      >
        <h2 className="text-3xl font-bold text-center mb-3">
          Select Your <span className="text-gradient">Stake</span>
        </h2>
        <p className="text-center text-neutral-400 mb-10">Choose your stake tier and find an opponent</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STAKE_TIERS.map((tier, index) => (
            <motion.button
              key={tier.tier}
              onClick={() => handleJoinQueue(tier.tier)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              whileHover={{ scale: 1.03, y: -4 }}
              whileTap={{ scale: 0.98 }}
              className="group glass-card glass-card-hover rounded-2xl p-6 text-center transition-all duration-300"
            >
              <p className="text-4xl font-bold text-gradient mb-2">{tier.label}</p>
              <p className="text-sm text-neutral-500 group-hover:text-neutral-400 transition-colors">Stake Amount</p>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
