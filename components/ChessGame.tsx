'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Trophy, RefreshCw, X, CheckCircle2, Wifi, WifiOff, Users } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

import { Chess } from 'chess.js';
import { EscrowClient, STAKE_TIERS, getStakeTierInfo, lamportsToSol } from '@/utils/escrow';

type Mode = 'practice' | 'wager';
type PlayerColor = 'w' | 'b' | null;

type ChessGameProps = {
  initialMode?: Mode;
  showModeSelector?: boolean;
  matchPubkey?: string;
  playerRole?: 'host' | 'join'; // host = white, join = black
  matchCode?: string;
  initialStakeTier?: number;
};

const BACKEND_URL = 'https://solmate-production.up.railway.app';

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
  playerRole,
  matchCode,
  initialStakeTier = 4,
}) => {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { connected, publicKey } = wallet;
  
  const [mode, setMode] = useState<Mode>(initialMode);
  const [selectedStakeTier, setSelectedStakeTier] = useState(initialStakeTier);
  const [isCreatingMatch, setIsCreatingMatch] = useState(false);
  const [isJoiningMatch, setIsJoiningMatch] = useState(false);
  const [isCancellingMatch, setIsCancellingMatch] = useState(false);
  const [pendingMatchPubkey, setPendingMatchPubkey] = useState<string>('');
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
  
  // Multiplayer state
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isMultiplayer, setIsMultiplayer] = useState(!!playerRole);
  const [playerColor, setPlayerColor] = useState<PlayerColor>(playerRole === 'host' ? 'w' : playerRole === 'join' ? 'b' : null);
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [gameRoomId, setGameRoomId] = useState<string | null>(null); // This is the backend roomId, not matchCode
  const [dynamicPlayerRole, setDynamicPlayerRole] = useState<'host' | 'join' | undefined>(playerRole);
  const actualPlayerRole = dynamicPlayerRole || playerRole;
  
  // Free play state (no blockchain, just WebSocket)
  const [isFreePlay, setIsFreePlay] = useState(false);
  const [freePlayCode, setFreePlayCode] = useState<string>('');
  const [joinFreePlayCode, setJoinFreePlayCode] = useState<string>('');
  const [isCreatingFreePlay, setIsCreatingFreePlay] = useState(false);
  const [isJoiningFreePlay, setIsJoiningFreePlay] = useState(false);

  const chessRef = useRef<Chess | null>(null);
  if (!chessRef.current) {
    chessRef.current = new Chess();
  }

  const [fen, setFen] = useState(() => chessRef.current!.fen());
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

  // WebSocket connection for multiplayer
  useEffect(() => {
    if (!isMultiplayer || !publicKey) return;
    
    // For host, we need matchPubkey; for joiner, we need matchCode
    if (actualPlayerRole === 'host' && !currentMatchPubkey) {
      console.log('Host waiting for matchPubkey...');
      return;
    }
    if (actualPlayerRole === 'join' && !matchCode) {
      console.log('Joiner waiting for matchCode...');
      return;
    }
    
    console.log('Connecting to game server:', actualPlayerRole === 'host' ? `pubkey=${currentMatchPubkey?.toBase58()}` : `code=${matchCode}`);
    
    const newSocket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
    });
    
    newSocket.on('connect', () => {
      console.log('Connected to game server, socket id:', newSocket.id);
      
      // Register player first
      newSocket.emit('player:register', { walletAddress: publicKey.toString() });
    });
    
    // After registration, join or host the match
    newSocket.on('player:registered', () => {
      console.log('Player registered');
      
      if (actualPlayerRole === 'host') {
        // Host registers their match with the backend
        console.log('Hosting match with pubkey:', currentMatchPubkey?.toBase58());
        newSocket.emit('match:host', {
          stakeTier: selectedStakeTier,
          matchPubkey: currentMatchPubkey?.toBase58(),
          joinDeadlineMinutes: 30,
        });
      } else {
        // Joiner joins by match code
        console.log('Joining match with code:', matchCode);
        newSocket.emit('match:join', { 
          matchCode: matchCode,
          guestWallet: publicKey.toString(),
        });
      }
    });
    
    // Host receives hosted confirmation
    newSocket.on('match:hosted', ({ matchCode: code }) => {
      console.log('Match hosted with code:', code);
      // Host waits for opponent to join
    });
    
    // Host receives notification when guest joins
    newSocket.on('match:playerJoined', ({ roomId, guestWallet, yourColor }) => {
      console.log('Opponent joined! Room:', roomId, 'My color:', yourColor);
      setGameRoomId(roomId);
      setPlayerColor(yourColor);
      setOpponentConnected(true);
    });
    
    // Guest receives join confirmation
    newSocket.on('match:joined', ({ roomId, yourColor, opponent }) => {
      console.log('Joined match! Room:', roomId, 'My color:', yourColor, 'Opponent:', opponent);
      setGameRoomId(roomId);
      setPlayerColor(yourColor);
      setOpponentConnected(true);
    });
    
    // Join error
    newSocket.on('match:joinError', ({ error }) => {
      console.error('Failed to join match:', error);
      alert(`Failed to join match: ${error}`);
    });
    
    // Game start notification
    newSocket.on('game:start', ({ whiteTimeMs, blackTimeMs }) => {
      console.log('Game started! White time:', whiteTimeMs, 'Black time:', blackTimeMs);
      setOpponentConnected(true);
    });
    
    // Receive opponent's move
    newSocket.on('game:move', ({ move, timeUpdate }) => {
      console.log('Received move from opponent:', move);
      const chess = chessRef.current!;
      try {
        // The move object has { from, to, san, promotion }
        chess.move({ from: move.from, to: move.to, promotion: move.promotion });
        setFen(chess.fen());
      } catch (e) {
        console.error('Invalid move received:', e);
      }
    });
    
    // Game end notification
    newSocket.on('game:end', ({ winner, reason, yourColor }) => {
      console.log('Game over:', winner, reason, 'My color:', yourColor);
      setGameWinner(winner);
      setShowResultModal(true);
    });
    
    newSocket.on('disconnect', () => {
      console.log('Disconnected from game server');
    });
    
    newSocket.on('error', ({ message }) => {
      console.error('Socket error:', message);
    });
    
    setSocket(newSocket);
    
    return () => {
      newSocket.disconnect();
    };
  }, [isMultiplayer, publicKey, matchCode, actualPlayerRole, currentMatchPubkey, selectedStakeTier]);
  
  // WebSocket connection for FREE PLAY mode (no blockchain)
  useEffect(() => {
    if (!isFreePlay) return;
    
    console.log('Connecting to game server for FREE PLAY...');
    
    const newSocket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
    });
    
    newSocket.on('connect', () => {
      console.log('Connected for free play, socket id:', newSocket.id);
    });
    
    // Free play hosted confirmation
    newSocket.on('freeplay:hosted', ({ code }) => {
      console.log('Free play room created with code:', code);
      setFreePlayCode(code);
      setIsCreatingFreePlay(false);
    });
    
    // Free play started (both host and guest)
    newSocket.on('freeplay:started', ({ roomId, yourColor, opponent }) => {
      console.log('Free play started! Room:', roomId, 'Color:', yourColor, 'Opponent:', opponent);
      setGameRoomId(roomId);
      setPlayerColor(yourColor);
      setOpponentConnected(true);
      setIsJoiningFreePlay(false);
    });
    
    // Free play error
    newSocket.on('freeplay:error', ({ error }) => {
      console.error('Free play error:', error);
      alert(`Free play error: ${error}`);
      setIsJoiningFreePlay(false);
    });
    
    // Game start notification
    newSocket.on('game:start', ({ whiteTimeMs, blackTimeMs }) => {
      console.log('Game started! White time:', whiteTimeMs, 'Black time:', blackTimeMs);
      setOpponentConnected(true);
    });
    
    // Receive opponent's move
    newSocket.on('game:move', ({ move, timeUpdate }) => {
      console.log('Received move from opponent:', move);
      const chess = chessRef.current!;
      try {
        chess.move({ from: move.from, to: move.to, promotion: move.promotion });
        setFen(chess.fen());
      } catch (e) {
        console.error('Invalid move received:', e);
      }
    });
    
    // Game end notification
    newSocket.on('game:end', ({ winner, reason }) => {
      console.log('Game over:', winner, reason);
      setGameWinner(winner);
      setShowResultModal(true);
    });
    
    newSocket.on('disconnect', () => {
      console.log('Disconnected from free play server');
    });
    
    setSocket(newSocket);
    
    return () => {
      newSocket.disconnect();
    };
  }, [isFreePlay]);
  
  // Send move to opponent
  const sendMove = useCallback((from: string, to: string, san: string, promotion?: string) => {
    if (!isMultiplayer && !isFreePlay) {
      console.log('Not multiplayer/freeplay, not sending move');
      return;
    }
    if (!socket) {
      console.error('ERROR: Socket not connected, cannot send move!');
      return;
    }
    if (!gameRoomId) {
      console.error('ERROR: gameRoomId not set, cannot send move! Opponent may not have joined yet.');
      return;
    }
    console.log('Sending move to server:', { roomId: gameRoomId, from, to, san, promotion });
    socket.emit('game:makeMove', { 
      roomId: gameRoomId,
      move: { from, to, san, promotion }
    });
  }, [socket, isMultiplayer, isFreePlay, gameRoomId]);
  
  // Free play handlers
  const handleCreateFreePlay = () => {
    setIsFreePlay(true);
    setIsCreatingFreePlay(true);
    setPlayerColor('w');
    // Socket connection will be established by the useEffect
    // Then we emit freeplay:host after connection
  };
  
  // Effect to emit freeplay:host after socket connects
  useEffect(() => {
    if (isFreePlay && isCreatingFreePlay && socket?.connected) {
      console.log('Emitting freeplay:host');
      socket.emit('freeplay:host', { walletAddress: publicKey?.toString() || 'anonymous' });
    }
  }, [isFreePlay, isCreatingFreePlay, socket?.connected, publicKey]);
  
  const handleJoinFreePlay = () => {
    if (!joinFreePlayCode || joinFreePlayCode.length !== 4) {
      alert('Please enter a 4-character room code');
      return;
    }
    setIsFreePlay(true);
    setIsJoiningFreePlay(true);
    setPlayerColor('b');
  };
  
  // Effect to emit freeplay:join after socket connects
  useEffect(() => {
    if (isFreePlay && isJoiningFreePlay && socket?.connected && joinFreePlayCode) {
      console.log('Emitting freeplay:join with code:', joinFreePlayCode);
      socket.emit('freeplay:join', { 
        code: joinFreePlayCode.toUpperCase(),
        walletAddress: publicKey?.toString() || 'anonymous' 
      });
    }
  }, [isFreePlay, isJoiningFreePlay, socket?.connected, joinFreePlayCode, publicKey]);
  
  const handleCancelFreePlay = () => {
    if (socket && freePlayCode) {
      socket.emit('freeplay:cancel', { code: freePlayCode });
    }
    setIsFreePlay(false);
    setFreePlayCode('');
    setJoinFreePlayCode('');
    setIsCreatingFreePlay(false);
    setIsJoiningFreePlay(false);
    setOpponentConnected(false);
    setGameRoomId(null);
    setPlayerColor(null);
    // Reset chess board
    chessRef.current = new Chess();
    setFen(chessRef.current.fen());
  };

  const board = useMemo(() => {
    return chessRef.current!.board();
  }, [fen]);

  const legalDestinations = useMemo(() => {
    if (!selectedSquare) return new Set<string>();
    const moves = chessRef.current!.moves({ square: selectedSquare as any, verbose: true }) as Array<any>;
    return new Set(moves.map((m) => m.to));
  }, [selectedSquare, fen]);

  // Check for game end conditions - using useEffect instead of useMemo to avoid state updates during render
  useEffect(() => {
    const chess = chessRef.current!;
    if (chess.isCheckmate()) {
      const winner = chess.turn() === 'w' ? 'b' : 'w';
      if (gameWinner !== winner) {
        console.log('Checkmate detected! Winner:', winner);
        setGameWinner(winner);
        setShowResultModal(true);
      }
    }
  }, [fen, gameWinner]);

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
      console.log('Creating match with stake tier:', selectedStakeTier);
      
      const { signature, matchPubkey } = await client.createMatch(selectedStakeTier, 30);
      
      console.log('Match created successfully!');
      console.log('Signature:', signature);
      console.log('Match PDA:', matchPubkey.toBase58());
      const lobbyCode = matchPubkey.toBase58().slice(0, 4).toUpperCase();
      console.log('Lobby Code:', lobbyCode);
      
      setTxSignature(signature);
      setCurrentMatchPubkey(matchPubkey);
      setMatchCreated(true);
      setCanJoinAt(Date.now() + 3000);
      
      // Enable multiplayer mode as host
      setIsMultiplayer(true);
      setPlayerColor('w'); // Host is always white
      setDynamicPlayerRole('host');
      
      // Register the match with the WebSocket server for lobby discovery
      try {
        const BACKEND_URL = 'https://solmate-production.up.railway.app';
        const response = await fetch(`${BACKEND_URL}/api/matches`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matchCode: lobbyCode,
            matchPubkey: matchPubkey.toBase58(),
            hostWallet: publicKey.toBase58(),
            stakeTier: selectedStakeTier,
            joinDeadline: Date.now() + 30 * 60 * 1000, // 30 min deadline
          }),
        });
        if (response.ok) {
          console.log('Match registered with lobby server');
        }
      } catch (e) {
        console.log('Could not register match with lobby server (offline mode)');
      }
      
      alert(`Match created!\nLobby Code: ${lobbyCode}\nSignature: ${signature.slice(0, 8)}...`);
    } catch (error: any) {
      console.error('Error creating match:', error);
      // Check for user rejection
      if (error.message?.includes('User rejected') || error.message?.includes('rejected')) {
        alert('Transaction was cancelled');
      } else {
        alert(`Failed to create match: ${error.message || error}`);
      }
    } finally {
      setIsCreatingMatch(false);
    }
  };

  const handleRecoverMatch = async () => {
    if (!connected || !publicKey) {
      alert('Please connect your wallet');
      return;
    }

    if (!pendingMatchPubkey) {
      alert('Please enter a match PDA');
      return;
    }

    try {
      const matchPda = new PublicKey(pendingMatchPubkey);
      const client = new EscrowClient(connection, wallet);
      const matchData = await client.fetchMatch(matchPda);
      
      if (!matchData) {
        alert('Match not found on chain');
        return;
      }

      if (matchData.playerA.toBase58() !== publicKey.toBase58()) {
        alert('You are not the creator of this match');
        return;
      }

      setCurrentMatchPubkey(matchPda);
      setSelectedStakeTier(matchData.stakeTier);
      setMatchCreated(true);
      alert('Match recovered! You can now cancel it to get your SOL back.');
    } catch (error: any) {
      console.error('Error recovering match:', error);
      alert('Invalid match address or error fetching match');
    }
  };

  const handleCancelMatch = async () => {
    if (!connected || !publicKey) {
      alert('Please connect your wallet');
      return;
    }

    if (!currentMatchPubkey) {
      alert('No match to cancel');
      return;
    }

    setIsCancellingMatch(true);
    try {
      const client = new EscrowClient(connection, wallet);
      const signature = await client.cancelMatch(currentMatchPubkey);
      
      console.log('Match cancelled! Signature:', signature);
      setTxSignature(signature);
      setMatchCreated(false);
      setCurrentMatchPubkey(null);
      alert(`Match cancelled! Your SOL has been refunded.\nSignature: ${signature.slice(0, 8)}...`);
    } catch (error: any) {
      console.error('Error cancelling match:', error);
      if (error.message?.includes('User rejected') || error.message?.includes('rejected')) {
        alert('Transaction was cancelled');
      } else {
        alert(`Failed to cancel match: ${error.message || error}`);
      }
    } finally {
      setIsCancellingMatch(false);
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

  // Minimax evaluation function for AI
  const evaluateBoard = (chess: Chess): number => {
    const board = chess.board();
    let score = 0;
    
    const pieceValues: Record<string, number> = {
      p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000
    };
    
    // Position bonuses for better play
    const pawnTable = [
      [0,  0,  0,  0,  0,  0,  0,  0],
      [50, 50, 50, 50, 50, 50, 50, 50],
      [10, 10, 20, 30, 30, 20, 10, 10],
      [5,  5, 10, 25, 25, 10,  5,  5],
      [0,  0,  0, 20, 20,  0,  0,  0],
      [5, -5,-10,  0,  0,-10, -5,  5],
      [5, 10, 10,-20,-20, 10, 10,  5],
      [0,  0,  0,  0,  0,  0,  0,  0]
    ];
    
    const knightTable = [
      [-50,-40,-30,-30,-30,-30,-40,-50],
      [-40,-20,  0,  0,  0,  0,-20,-40],
      [-30,  0, 10, 15, 15, 10,  0,-30],
      [-30,  5, 15, 20, 20, 15,  5,-30],
      [-30,  0, 15, 20, 20, 15,  0,-30],
      [-30,  5, 10, 15, 15, 10,  5,-30],
      [-40,-20,  0,  5,  5,  0,-20,-40],
      [-50,-40,-30,-30,-30,-30,-40,-50]
    ];

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (!piece) continue;
        
        let value = pieceValues[piece.type] || 0;
        
        // Add positional bonuses
        if (piece.type === 'p') {
          value += piece.color === 'w' ? pawnTable[row][col] : pawnTable[7-row][col];
        } else if (piece.type === 'n') {
          value += piece.color === 'w' ? knightTable[row][col] : knightTable[7-row][col];
        }
        
        score += piece.color === 'w' ? value : -value;
      }
    }
    
    // Bonus for checkmate
    if (chess.isCheckmate()) {
      return chess.turn() === 'w' ? -100000 : 100000;
    }
    
    return score;
  };

  // Minimax algorithm with alpha-beta pruning
  const minimax = (chess: Chess, depth: number, alpha: number, beta: number, maximizing: boolean): number => {
    if (depth === 0 || chess.isGameOver()) {
      return evaluateBoard(chess);
    }
    
    const moves = chess.moves({ verbose: true });
    
    if (maximizing) {
      let maxEval = -Infinity;
      for (const move of moves) {
        chess.move(move);
        const evaluation = minimax(chess, depth - 1, alpha, beta, false);
        chess.undo();
        maxEval = Math.max(maxEval, evaluation);
        alpha = Math.max(alpha, evaluation);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        chess.move(move);
        const evaluation = minimax(chess, depth - 1, alpha, beta, true);
        chess.undo();
        minEval = Math.min(minEval, evaluation);
        beta = Math.min(beta, evaluation);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  };

  const playComputerMove = React.useCallback(() => {
    const chess = chessRef.current!;
    if (chess.isGameOver()) return;
    if (chess.turn() !== 'b') return;

    const moves = chess.moves({ verbose: true }) as Array<any>;
    if (moves.length === 0) return;

    // Use minimax with depth 3 for ~1600-1800 ELO
    let bestMove = moves[0];
    let bestValue = Infinity;
    
    for (const move of moves) {
      chess.move(move);
      const value = minimax(chess, 3, -Infinity, Infinity, true);
      chess.undo();
      
      if (value < bestValue) {
        bestValue = value;
        bestMove = move;
      }
    }

    chess.move(bestMove);
    setFen(chess.fen());
  }, []);

  const onSquareClick = (square: string) => {
    const chess = chessRef.current!;

    if (chess.isGameOver()) return;

    // In multiplayer or free play, only allow moves on your turn with your color
    if ((isMultiplayer || isFreePlay) && playerColor) {
      if (chess.turn() !== playerColor) {
        console.log('Not your turn! You are', playerColor, 'but it is', chess.turn(), 'to move');
        return;
      }
    }

    if (mode === 'practice' && !isFreePlay) {
      if (chess.turn() !== 'w') return;
    }

    if (!selectedSquare) {
      const piece = chess.get(square as any) as any;
      if (!piece) return;
      
      // In multiplayer or free play, only select your own pieces
      if ((isMultiplayer || isFreePlay) && playerColor && piece.color !== playerColor) return;
      
      if (mode === 'practice' && !isFreePlay && piece.color !== 'w') return;
      if (mode === 'wager' && !isMultiplayer && !isFreePlay && piece.color !== chess.turn()) return;
      setSelectedSquare(square);
      return;
    }

    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }

    // Try to make the move - chess.js will handle en passant, castling, etc.
    const promotion = maybeAutoPromote(selectedSquare, square);
    
    // Build move object - only include promotion if needed
    const moveOptions: any = {
      from: selectedSquare,
      to: square,
    };
    
    if (promotion) {
      moveOptions.promotion = promotion;
    }

    try {
      const move = chess.move(moveOptions);
      if (!move) return;
      setSelectedSquare(null);
      setFen(chess.fen());
      
      // Send move to opponent in multiplayer or free play
      if (isMultiplayer || isFreePlay) {
        sendMove(selectedSquare, square, move.san, promotion);
      }
    } catch (error) {
      // Invalid move, deselect
      setSelectedSquare(null);
    }
  };

  useEffect(() => {
    if (mode !== 'practice') return;
    if (isFreePlay) return; // Don't run AI during free play
    const chess = chessRef.current!;
    if (chess.turn() !== 'b') return;
    if (chess.isGameOver()) return;

    const t = setTimeout(() => {
      playComputerMove();
    }, 250);

    return () => clearTimeout(t);
  }, [fen, mode, isFreePlay, playComputerMove]);

  const getMatchInfo = () => {
    if (!matchCreated) return null;
    const tier = getStakeTierInfo(selectedStakeTier);
    return {
      stake: tier.label,
      pot: `${(tier.stake * 2 * 0.9).toFixed(2)} SOL`, // 2 players, minus 10% fee
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
              {/* Multiplayer Status */}
              {isMultiplayer && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {socket?.connected ? (
                        <Wifi className="h-3 w-3 text-green-400" />
                      ) : (
                        <WifiOff className="h-3 w-3 text-red-400" />
                      )}
                      <span className={socket?.connected ? 'text-green-400' : 'text-red-400'}>
                        {socket?.connected ? 'Connected' : 'Connecting...'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className={`h-3 w-3 ${opponentConnected ? 'text-green-400' : 'text-yellow-400'}`} />
                      <span className={opponentConnected ? 'text-green-400' : 'text-yellow-400'}>
                        {opponentConnected ? 'Opponent ready' : 'Waiting for opponent...'}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-neutral-500 mt-2">
                    You are playing as <span className="font-bold text-white">{playerColor === 'w' ? 'White' : 'Black'}</span>
                  </p>
                </div>
              )}
              {/* Lobby Code for sharing */}
              {currentMatchPubkey && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-400">Lobby Code:</span>
                    <div className="flex items-center gap-2">
                      <code className="text-lg font-mono font-bold text-solana-green bg-black/30 px-3 py-1 rounded tracking-widest">
                        {currentMatchPubkey.toBase58().slice(0, 4).toUpperCase()}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(currentMatchPubkey.toBase58().slice(0, 4).toUpperCase());
                          alert('Lobby code copied!');
                        }}
                        className="text-xs text-solana-purple hover:text-solana-green transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-neutral-500 mt-1">Share this code with your opponent to join</p>
                  <button
                    onClick={handleCancelMatch}
                    disabled={isCancellingMatch}
                    className="mt-3 w-full py-2 px-4 bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30 hover:text-red-300 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                  >
                    {isCancellingMatch ? 'Cancelling...' : 'Cancel Match & Refund SOL'}
                  </button>
                </div>
              )}
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
                {!isFreePlay ? (
                  <>
                    <p className="text-sm text-neutral-400">
                      Train against AI or play online for free.
                    </p>
                    <motion.button
                      type="button"
                      onClick={resetPractice}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-xl transition-all"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Reset vs AI
                    </motion.button>
                    
                    <div className="border-t border-white/10 pt-4 mt-4">
                      <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-3">
                        Free Online Play
                      </p>
                      <div className="space-y-2">
                        <motion.button
                          type="button"
                          onClick={handleCreateFreePlay}
                          disabled={isCreatingFreePlay}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="w-full flex items-center justify-center gap-2 btn-glow text-white font-semibold py-3 px-6 rounded-xl disabled:opacity-50"
                        >
                          <Users className="h-4 w-4" />
                          {isCreatingFreePlay ? 'Creating...' : 'Create Room'}
                        </motion.button>
                        
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={joinFreePlayCode}
                            onChange={(e) => setJoinFreePlayCode(e.target.value.toUpperCase().slice(0, 4))}
                            placeholder="CODE"
                            maxLength={4}
                            className="flex-1 px-3 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-solana-purple text-white text-center font-mono uppercase"
                          />
                          <motion.button
                            type="button"
                            onClick={handleJoinFreePlay}
                            disabled={isJoiningFreePlay || joinFreePlayCode.length !== 4}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl disabled:opacity-50 transition-all"
                          >
                            {isJoiningFreePlay ? '...' : 'Join'}
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-gradient-to-r from-solana-purple/20 to-solana-green/20 rounded-xl border border-solana-purple/30">
                      <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-1">
                        {opponentConnected ? 'Game In Progress' : 'Room Code'}
                      </p>
                      {!opponentConnected && freePlayCode && (
                        <p className="text-3xl font-bold font-mono text-white">{freePlayCode}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Users className={`h-4 w-4 ${opponentConnected ? 'text-green-400' : 'text-yellow-400'}`} />
                        <span className={`text-sm ${opponentConnected ? 'text-green-400' : 'text-yellow-400'}`}>
                          {opponentConnected ? `Playing as ${playerColor === 'w' ? 'White' : 'Black'}` : 'Waiting for opponent...'}
                        </span>
                      </div>
                    </div>
                    <motion.button
                      type="button"
                      onClick={handleCancelFreePlay}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold py-3 px-6 rounded-xl border border-red-500/30 transition-all"
                    >
                      <X className="h-4 w-4" />
                      {opponentConnected ? 'Leave Game' : 'Cancel'}
                    </motion.button>
                  </div>
                )}
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

                        {/* Recover Match Section */}
                        <div className="mt-4 pt-4 border-t border-white/10">
                          <p className="text-xs text-neutral-500 mb-2">Have an existing match?</p>
                          <input
                            type="text"
                            value={pendingMatchPubkey}
                            onChange={(e) => setPendingMatchPubkey(e.target.value)}
                            placeholder="Enter Match PDA"
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-solana-purple"
                          />
                          <button
                            onClick={handleRecoverMatch}
                            disabled={!pendingMatchPubkey}
                            className="mt-2 w-full py-2 px-4 bg-yellow-600/20 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-600/30 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                          >
                            Recover Match
                          </button>
                        </div>
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
