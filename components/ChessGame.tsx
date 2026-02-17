'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Trophy, RefreshCw, X, CheckCircle2, XCircle, Users, Share2, Clock, MessageCircle, Send, Eye, Loader2, Coins } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

import { Chess, Move } from 'chess.js';
import { EscrowClient, STAKE_TIERS, getStakeTierInfo, lamportsToSol, MatchStatus } from '@/utils/escrow';
import { getUsername, formatDisplayName, getPlayerStats, PlayerStats } from '@/utils/username';
import { shareToX } from '@/utils/shareToX';

type Mode = 'practice' | 'wager';
type PlayerColor = 'w' | 'b' | null;

// Sound effects hook - creates audio lazily to avoid SSR issues
const useChessSounds = () => {
  const soundsRef = useRef<{
    move: HTMLAudioElement | null;
    capture: HTMLAudioElement | null;
    check: HTMLAudioElement | null;
    castle: HTMLAudioElement | null;
  } | null>(null);
  const initializedRef = useRef(false);
  
  // Initialize audio elements lazily (not in useEffect to avoid timing issues)
  const getOrCreateSounds = useCallback(() => {
    if (typeof window === 'undefined') return null;
    
    if (!soundsRef.current && !initializedRef.current) {
      initializedRef.current = true;
      const move = new Audio('/sounds/move.ogg');
      const capture = new Audio('/sounds/capture.ogg');
      const check = new Audio('/sounds/check.ogg');
      const castle = new Audio('/sounds/castle.ogg');
      
      // Preload and set volume
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
      // Clone for overlapping sounds
      const clone = audio.cloneNode() as HTMLAudioElement;
      clone.volume = 0.5;
      clone.play().catch((e) => {
        // Browser may block autoplay until user interaction
        console.log('Audio play blocked:', e.message);
      });
    }
  }, [getOrCreateSounds]);
  
  return { playSound };
};

// Piece display symbols for captured pieces
const PIECE_SYMBOLS: Record<string, string> = {
  P: '♙', N: '♘', B: '♗', R: '♖', Q: '♕',
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛',
};
const PIECE_SORT_ORDER: Record<string, number> = { q: 0, Q: 0, r: 1, R: 1, b: 2, B: 2, n: 3, N: 3, p: 4, P: 4 };

// Captured pieces tracker - returns arrays of SVG paths for display
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
  
  // Convert counts to arrays of SVG paths for display
  const createPieceArray = (capturedBy: 'w' | 'b') => {
    const result: { svg: string; value: number }[] = [];
    const pieceOrder: ('q' | 'r' | 'b' | 'n' | 'p')[] = ['q', 'r', 'b', 'n', 'p'];
    const pieceValues: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
    const victimColor = capturedBy === 'w' ? 'b' : 'w'; // Pieces captured BY white are black pieces
    
    for (const type of pieceOrder) {
      const initial = capturedBy === 'w' ? initialPieces.b[type] : initialPieces.w[type];
      const current = capturedBy === 'w' ? currentPieces.b[type] : currentPieces.w[type];
      const captured = initial - current;
      for (let i = 0; i < captured; i++) {
        result.push({
          svg: `/pieces/${victimColor}${type.toUpperCase()}.svg`,
          value: pieceValues[type]
        });
      }
    }
    return result;
  };
  
  return {
    w: createPieceArray('w'), // pieces captured BY white (black piece SVGs)
    b: createPieceArray('b'), // pieces captured BY black (white piece SVGs)
    wTypes: (() => { // piece type chars captured BY white
      const result: string[] = [];
      const pieceOrder: ('q' | 'r' | 'b' | 'n' | 'p')[] = ['q', 'r', 'b', 'n', 'p'];
      for (const type of pieceOrder) {
        const captured = initialPieces.b[type] - currentPieces.b[type];
        for (let i = 0; i < captured; i++) result.push(type); // lowercase = black pieces
      }
      return result;
    })(),
    bTypes: (() => { // piece type chars captured BY black
      const result: string[] = [];
      const pieceOrder: ('q' | 'r' | 'b' | 'n' | 'p')[] = ['q', 'r', 'b', 'n', 'p'];
      for (const type of pieceOrder) {
        const captured = initialPieces.w[type] - currentPieces.w[type];
        for (let i = 0; i < captured; i++) result.push(type.toUpperCase()); // uppercase = white pieces
      }
      return result;
    })(),
  };
};

const getMaterialAdvantage = (captured: ReturnType<typeof getCapturedPieces>) => {
  const whiteTotal = captured.w.reduce((sum, p) => sum + p.value, 0);
  const blackTotal = captured.b.reduce((sum, p) => sum + p.value, 0);
  return whiteTotal - blackTotal;
};

type ChessGameProps = {
  initialMode?: Mode;
  showModeSelector?: boolean;
  matchPubkey?: string;
  playerRole?: 'host' | 'join';
  matchCode?: string;
  initialStakeTier?: number;
  freePlayJoinCode?: string; // Auto-join free play via shareable link
  autoCreateFreePlay?: boolean; // Auto-create a free play room on mount
  onFreePlayCodeGenerated?: (code: string) => void; // Callback when room code is generated
  onFreePlayGameStarted?: () => void; // Callback when opponent joins and game starts
  onFreePlayOpponentJoined?: () => void; // Callback when opponent enters lobby (before game starts)
  spectateRoomId?: string; // Spectate a wager match by room ID
  forceReconnect?: boolean; // Force socket connection for reconnect (from ActiveGameBanner)
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

// Format time as MM:SS
const formatTime = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const ChessGame: React.FC<ChessGameProps> = ({
  initialMode = 'practice',
  showModeSelector = true,
  matchPubkey,
  playerRole,
  matchCode,
  initialStakeTier = 4,
  freePlayJoinCode,
  autoCreateFreePlay,
  onFreePlayCodeGenerated,
  onFreePlayGameStarted,
  onFreePlayOpponentJoined,
  spectateRoomId,
  forceReconnect,
}) => {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { connected, publicKey } = wallet;
  
  // Chess sounds
  const { playSound } = useChessSounds();
  
  const [mode, setMode] = useState<Mode>(initialMode);
  const [selectedStakeTier, setSelectedStakeTier] = useState(initialStakeTier);
  const [isCreatingMatch, setIsCreatingMatch] = useState(false);
  const [isJoiningMatch, setIsJoiningMatch] = useState(false);
  const [isCancellingMatch, setIsCancellingMatch] = useState(false);
  const [pendingMatchPubkey, setPendingMatchPubkey] = useState<string>('');
  const [matchCreated, setMatchCreated] = useState(!!matchPubkey && initialMode === 'wager');
  const [currentMatchPubkey, setCurrentMatchPubkey] = useState<PublicKey | null>(
    matchPubkey ? new PublicKey(matchPubkey) : null
  );
  const [gameWinner, setGameWinner] = useState<'w' | 'b' | 'draw' | null>(null);
  const [gameEndReason, setGameEndReason] = useState<string | null>(null);
  const [isSubmittingResult, setIsSubmittingResult] = useState(false);
  const [payoutComplete, setPayoutComplete] = useState(false);
  const [txSignature, setTxSignature] = useState<string>('');
  const [canJoinAt, setCanJoinAt] = useState<number>(0);
  const [showResultModal, setShowResultModal] = useState(false);
  
  // Last move tracking for highlighting
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  
  // Multiplayer state
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isMultiplayer, setIsMultiplayer] = useState(!!playerRole);
  const [playerColor, setPlayerColor] = useState<PlayerColor>(playerRole === 'host' ? 'w' : playerRole === 'join' ? 'b' : null);
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [opponentDisconnectCountdown, setOpponentDisconnectCountdown] = useState<number | null>(null);
  const opponentDisconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [gameRoomId, setGameRoomId] = useState<string | null>(null); // This is the backend roomId, not matchCode
  const [dynamicPlayerRole, setDynamicPlayerRole] = useState<'host' | 'join' | undefined>(playerRole);
  const actualPlayerRole = dynamicPlayerRole || playerRole;
  
  // Wager match code (can come from prop or be set dynamically)
  const [wagerMatchCode, setWagerMatchCode] = useState<string>(matchCode || '');
  
  // Free play state (no blockchain, just WebSocket)
  const [isFreePlay, setIsFreePlay] = useState(false);
  const [freePlayCode, setFreePlayCode] = useState<string>('');
  const [joinFreePlayCode, setJoinFreePlayCode] = useState<string>('');
  const [isCreatingFreePlay, setIsCreatingFreePlay] = useState(false);
  const [isJoiningFreePlay, setIsJoiningFreePlay] = useState(false);
  
  // Lobby state for both free play and wager matches (color selection before game starts)
  const [inLobby, setInLobby] = useState(false);
  const [lobbyHostColor, setLobbyHostColor] = useState<'w' | 'b'>('w');
  const [lobbyOpponentName, setLobbyOpponentName] = useState<string>('');
  const [lobbyOpponentWallet, setLobbyOpponentWallet] = useState<string | null>(null);
  const [whiteRequest, setWhiteRequest] = useState(false);
  const [whiteRequestPending, setWhiteRequestPending] = useState(false);
  const [swapRequestWantColor, setSwapRequestWantColor] = useState<'w' | 'b' | null>(null);
  
  // Wager lobby state
  const [inWagerLobby, setInWagerLobby] = useState(false);
  const [wagerLobbyHostColor, setWagerLobbyHostColor] = useState<'w' | 'b'>('w');
  const [wagerOpponentWallet, setWagerOpponentWallet] = useState<string | null>(null);
  
  // Joiner on-chain stake status
  const [hasJoinerStaked, setHasJoinerStaked] = useState(false);
  const [joinerStakeError, setJoinerStakeError] = useState<string | null>(null);
  
  // Spectator mode
  const [isSpectating, setIsSpectating] = useState(!!spectateRoomId);
  const [spectatorWhitePlayer, setSpectatorWhitePlayer] = useState<string>('');
  const [spectatorBlackPlayer, setSpectatorBlackPlayer] = useState<string>('');
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [spectatorStakeTier, setSpectatorStakeTier] = useState<number | null>(null);
  const [spectatorWhiteTime, setSpectatorWhiteTime] = useState<number>(10 * 60 * 1000);
  const [spectatorBlackTime, setSpectatorBlackTime] = useState<number>(10 * 60 * 1000);
  
  // Practice tips - rotates each new game
  const PRACTICE_TIPS = [
    'Control the center early. Knights and bishops are most effective when placed in the center of the board.',
    'Develop your pieces before attacking. Get knights and bishops out before launching an assault.',
    'Castle early to protect your king and connect your rooks.',
    'Avoid moving the same piece twice in the opening unless there\'s a strong reason.',
    'Rooks are strongest on open files. Look for columns with no pawns to place them on.',
    'A knight on the rim is dim. Knights are weakest on the edges of the board.',
    'Trade pieces when you\'re ahead in material to simplify the position.',
    'When behind, complicate the position. Create tactical chaos to give yourself chances.',
    'Passed pawns must be pushed! A pawn with no opposing pawns blocking it is a powerful asset.',
    'In the endgame, activate your king. It becomes a strong piece when fewer threats exist.',
    'Don\'t bring your queen out too early — it can become a target for your opponent\'s developing pieces.',
    'Two bishops (the bishop pair) are usually stronger than two knights in open positions.',
    'Look for forks, pins, and skewers — basic tactics win most games at every level.',
    'Before making a move, ask: "What is my opponent\'s threat?" Always check for danger first.',
    'Connected rooks on an open file or the 7th rank can be devastating.',
  ];
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * 15));

  // AI difficulty with iterative deepening: novice (~800 ELO), club (~1200 ELO), master (~1500 ELO)
  type AIDifficulty = 'novice' | 'club' | 'master';
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('club');
  const AI_SETTINGS: Record<AIDifficulty, { maxDepth: number; timeLimit: number; variance: number }> = {
    novice: { maxDepth: 3, timeLimit: 300, variance: 80 },   // ~800 ELO: shallow search, high randomness
    club:   { maxDepth: 5, timeLimit: 800, variance: 40 },   // ~1200 ELO: moderate search
    master: { maxDepth: 6, timeLimit: 1500, variance: 25 },  // ~1500 ELO: deep search, tight play
  };
  
  // AI player color (default white for player)
  const [aiPlayerColor, setAiPlayerColor] = useState<'w' | 'b'>('w');
  
  // Opponent info for username display
  const [opponentWallet, setOpponentWallet] = useState<string | null>(null);
  const [opponentUsername, setOpponentUsername] = useState<string | null>(null);
  const [opponentStats, setOpponentStats] = useState<PlayerStats | null>(null);
  const [myUsername, setMyUsername] = useState<string | null>(null);
  
  // Emoji reactions state
  const REACTION_EMOJIS = ['👍', '👏', '🔥', '😮', '😂', '😅', '🤔', '💀'];
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [incomingReaction, setIncomingReaction] = useState<string | null>(null);
  const [outgoingReaction, setOutgoingReaction] = useState<string | null>(null);
  
  // Chat state
  type ChatMessage = { message: string; sender: 'me' | 'opponent'; timestamp: number };
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Timer state (10 minutes = 600000ms)
  const [whiteTimeMs, setWhiteTimeMs] = useState(600000);
  const [blackTimeMs, setBlackTimeMs] = useState(600000);
  const lastTickRef = useRef<number>(Date.now());
  
  // Refs to track latest values for socket connect handler
  const isCreatingFreePlayRef = useRef(false);
  const isJoiningFreePlayRef = useRef(false);
  const joinFreePlayCodeRef = useRef('');
  
  // Keep refs in sync
  useEffect(() => {
    isCreatingFreePlayRef.current = isCreatingFreePlay;
    isJoiningFreePlayRef.current = isJoiningFreePlay;
    joinFreePlayCodeRef.current = joinFreePlayCode;
  }, [isCreatingFreePlay, isJoiningFreePlay, joinFreePlayCode]);

  // Fetch my username when wallet is connected
  useEffect(() => {
    if (publicKey) {
      getUsername(publicKey.toBase58()).then(setMyUsername);
    } else {
      setMyUsername(null);
    }
  }, [publicKey]);

  const chessRef = useRef<Chess | null>(null);
  if (!chessRef.current) {
    chessRef.current = new Chess();
  }

  const [fen, setFen] = useState(() => chessRef.current!.fen());
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  
  // Track if AI game has started (for timer)
  const [aiGameStarted, setAiGameStarted] = useState(false);

  // Live timer countdown - works for free play, AI matches, and wager/multiplayer matches
  useEffect(() => {
    // For free play: need opponent connected
    // For AI: need game to have started (first move made)
    // For wager/multiplayer: need opponent connected
    const isWagerGame = isMultiplayer && opponentConnected;
    const shouldRunTimer = (isFreePlay && opponentConnected) || (mode === 'practice' && !isFreePlay && aiGameStarted) || isWagerGame;
    if (!shouldRunTimer) return;
    
    const chess = chessRef.current;
    if (!chess || chess.isGameOver()) return;
    
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastTickRef.current;
      lastTickRef.current = now;
      
      // Decrement the active player's time
      if (chess.turn() === 'w') {
        setWhiteTimeMs(prev => Math.max(0, prev - elapsed));
      } else {
        setBlackTimeMs(prev => Math.max(0, prev - elapsed));
      }
    }, 100); // Update every 100ms for smooth countdown
    
    return () => clearInterval(interval);
  }, [opponentConnected, isFreePlay, fen, mode, aiGameStarted, isMultiplayer]); // fen changes on each move

  // Check for timeout - end game when timer hits 0 (AI, free play, and wager matches)
  useEffect(() => {
    // Determine if game is active and should check timeout
    const isAiGame = mode === 'practice' && !isFreePlay && aiGameStarted;
    const isFreePlayGame = isFreePlay && opponentConnected;
    const isWagerGame = isMultiplayer && opponentConnected;
    
    if (!isAiGame && !isFreePlayGame && !isWagerGame) return;
    
    const chess = chessRef.current;
    if (!chess || chess.isGameOver() || gameWinner) return;
    
    // Check if either player ran out of time
    if (whiteTimeMs === 0) {
      // White ran out of time, black wins
      console.log('White ran out of time! Black wins.');
      setGameWinner('b');
      setShowResultModal(true);
      
      // Notify server for multiplayer games
      if ((isFreePlayGame || isWagerGame) && socket) {
        socket.emit('game:timeout', { loser: 'w' });
      }
    } else if (blackTimeMs === 0) {
      // Black ran out of time, white wins
      console.log('Black ran out of time! White wins.');
      setGameWinner('w');
      setShowResultModal(true);
      
      // Notify server for multiplayer games
      if ((isFreePlayGame || isWagerGame) && socket) {
        socket.emit('game:timeout', { loser: 'b' });
      }
    }
  }, [whiteTimeMs, blackTimeMs, mode, isFreePlay, aiGameStarted, gameWinner, opponentConnected, isMultiplayer, socket]);

  // Helper: start opponent disconnect countdown
  const startDisconnectCountdown = useCallback((deadlineMs: number) => {
    if (opponentDisconnectTimerRef.current) clearInterval(opponentDisconnectTimerRef.current);
    const endTime = Date.now() + deadlineMs;
    setOpponentDisconnectCountdown(Math.ceil(deadlineMs / 1000));
    opponentDisconnectTimerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setOpponentDisconnectCountdown(remaining);
      if (remaining <= 0 && opponentDisconnectTimerRef.current) {
        clearInterval(opponentDisconnectTimerRef.current);
      }
    }, 1000);
  }, []);

  const clearDisconnectCountdown = useCallback(() => {
    if (opponentDisconnectTimerRef.current) {
      clearInterval(opponentDisconnectTimerRef.current);
      opponentDisconnectTimerRef.current = null;
    }
    setOpponentDisconnectCountdown(null);
  }, []);

  // WebSocket connection for multiplayer
  useEffect(() => {
    if (!isMultiplayer || !publicKey) return;
    // If reconnecting, let the forceReconnect useEffect handle the socket
    if (forceReconnect) return;
    
    // For host, we need matchPubkey; for joiner, we need matchCode
    if (actualPlayerRole === 'host' && !currentMatchPubkey) {
      console.log('Host waiting for matchPubkey...');
      return;
    }
    if (actualPlayerRole === 'join' && !matchCode) {
      console.log('Joiner waiting for matchCode...');
      return;
    }
    
    // For wager matches, joiner must have staked on-chain first
    if (actualPlayerRole === 'join' && mode === 'wager' && !hasJoinerStaked) {
      console.log('Joiner waiting for on-chain stake...');
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
      setWagerMatchCode(code);
      // Host waits for opponent to join
    });
    
    // Host receives notification when guest joins (enters lobby)
    newSocket.on('match:playerJoined', ({ matchCode: code, guestWallet, hostColor }) => {
      console.log('Opponent joined lobby! Guest:', guestWallet, 'Host color:', hostColor);
      setInWagerLobby(true);
      setWagerLobbyHostColor(hostColor || 'w');
      setWagerOpponentWallet(guestWallet);
      if (guestWallet) {
        getUsername(guestWallet).then(name => {
          if (name) setLobbyOpponentName(name);
          else setLobbyOpponentName(guestWallet.slice(0, 4) + '...' + guestWallet.slice(-4));
        });
      }
    });
    
    // Guest receives lobby join confirmation
    newSocket.on('match:joinedLobby', ({ matchCode: code, hostWallet, yourColor, stakeTier, matchPubkey }) => {
      console.log('Joined wager lobby! Host:', hostWallet, 'My color:', yourColor);
      setWagerMatchCode(code);
      setInWagerLobby(true);
      setWagerLobbyHostColor(yourColor === 'w' ? 'b' : 'w'); // hostColor is opposite of my color
      setPlayerColor(yourColor);
      setWagerOpponentWallet(hostWallet);
      if (hostWallet) {
        getUsername(hostWallet).then(name => {
          if (name) setLobbyOpponentName(name);
          else setLobbyOpponentName(hostWallet.slice(0, 4) + '...' + hostWallet.slice(-4));
        });
      }
    });
    
    // Colors updated in wager lobby
    newSocket.on('match:colorsUpdated', ({ matchCode: code, hostColor }) => {
      console.log('Wager match colors updated. Host is now:', hostColor);
      setWagerLobbyHostColor(hostColor);
      // Update my color based on my role
      if (actualPlayerRole === 'host') {
        setPlayerColor(hostColor);
      } else {
        setPlayerColor(hostColor === 'w' ? 'b' : 'w');
      }
    });
    
    // Game started (both host and guest receive this)
    newSocket.on('match:started', ({ matchCode: code, roomId, yourColor, opponent, stakeTier, matchPubkey, whiteTimeMs: wTime, blackTimeMs: bTime }) => {
      console.log('Wager match started! Room:', roomId, 'Color:', yourColor, 'Opponent:', opponent);
      setGameRoomId(roomId);
      setPlayerColor(yourColor);
      setOpponentConnected(true);
      setInWagerLobby(false);
      
      // Store opponent wallet for username lookup
      if (opponent?.walletAddress) {
        setOpponentWallet(opponent.walletAddress);
        getUsername(opponent.walletAddress).then(setOpponentUsername);
        getPlayerStats(opponent.walletAddress).then(setOpponentStats);
      }
      
      // Reset timer when game starts
      setWhiteTimeMs(wTime || 600000);
      setBlackTimeMs(bTime || 600000);
      lastTickRef.current = Date.now();
    });
    
    // Join error
    newSocket.on('match:joinError', ({ error }) => {
      console.error('Failed to join match:', error);
      alert(`Failed to join match: ${error}`);
    });
    
    // Start error
    newSocket.on('match:startError', ({ error }) => {
      console.error('Failed to start match:', error);
      alert(`Failed to start match: ${error}`);
    });
    
    // Receive opponent's move
    newSocket.on('game:move', ({ move, timeUpdate }) => {
      console.log('Received move from opponent:', move);
      const chess = chessRef.current!;
      try {
        const result = chess.move({ from: move.from, to: move.to, promotion: move.promotion });
        setFen(chess.fen());
        setLastMove({ from: move.from, to: move.to });
        // Play sound
        if (chess.isCheck()) {
          playSound('check');
        } else if (result?.flags?.includes('c') || result?.flags?.includes('e')) {
          playSound('capture');
        } else if (result?.flags?.includes('k') || result?.flags?.includes('q')) {
          playSound('castle');
        } else {
          playSound('move');
        }
      } catch (e) {
        console.error('Invalid move received:', e);
      }
    });
    
    // Game end notification
    newSocket.on('game:end', ({ winner, reason, yourColor }) => {
      console.log('Game over:', winner, reason, 'My color:', yourColor);
      if (yourColor) setPlayerColor(yourColor);
      setGameWinner(winner);
      setGameEndReason(reason);
      setShowResultModal(true);
    });

    // Receive emoji reaction from opponent
    newSocket.on('game:reaction', ({ emoji }) => {
      console.log('Received reaction:', emoji);
      setIncomingReaction(emoji);
      // Auto-clear after 2 seconds
      setTimeout(() => setIncomingReaction(null), 2000);
    });
    
    // Receive chat message from opponent
    newSocket.on('game:chat', ({ message, timestamp }) => {
      console.log('Received chat:', message);
      setChatMessages(prev => [...prev, { message, sender: 'opponent', timestamp }]);
      setUnreadCount(prev => prev + 1);
    });
    
    // Reconnect: server sends full game state if we have an active game
    newSocket.on('game:reconnect', (gameState: {
      roomId: string;
      fen: string;
      moves: string[];
      yourColor: 'w' | 'b';
      currentTurn: 'w' | 'b';
      whiteTimeMs: number;
      blackTimeMs: number;
      matchPubkey?: string;
      matchCode?: string;
      stakeTier?: number;
      opponentWallet?: string;
    }) => {
      console.log('Reconnecting to active game:', gameState.roomId, 'Color:', gameState.yourColor);

      // Restore full game state
      const chess = chessRef.current!;
      chess.load(gameState.fen);
      setFen(gameState.fen);
      setGameRoomId(gameState.roomId);
      setPlayerColor(gameState.yourColor);
      setOpponentConnected(true);
      setInWagerLobby(false);
      setWhiteTimeMs(gameState.whiteTimeMs);
      setBlackTimeMs(gameState.blackTimeMs);
      lastTickRef.current = Date.now();

      if (gameState.matchCode) setWagerMatchCode(gameState.matchCode);
      if (gameState.matchPubkey) {
        setCurrentMatchPubkey(new PublicKey(gameState.matchPubkey));
      }
      if (gameState.opponentWallet) {
        setOpponentWallet(gameState.opponentWallet);
        getUsername(gameState.opponentWallet).then(setOpponentUsername);
        getPlayerStats(gameState.opponentWallet).then(setOpponentStats);
      }
    });

    // Opponent disconnected — show countdown
    newSocket.on('game:opponentDisconnected', ({ reconnectDeadlineMs, lockedIn }: { reconnectDeadlineMs: number; lockedIn: boolean }) => {
      console.log(`Opponent disconnected. Reconnect window: ${reconnectDeadlineMs / 1000}s. Locked in: ${lockedIn}`);
      setOpponentConnected(false);
      startDisconnectCountdown(reconnectDeadlineMs);
    });

    // Opponent reconnected — clear warning
    newSocket.on('game:opponentReconnected', () => {
      console.log('Opponent reconnected!');
      setOpponentConnected(true);
      clearDisconnectCountdown();
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
  }, [isMultiplayer, publicKey, matchCode, actualPlayerRole, currentMatchPubkey, selectedStakeTier, hasJoinerStaked]);

  // Forced reconnect: when navigating from ActiveGameBanner in practice/freeplay mode
  // Creates a socket, registers, and waits for game:reconnect from server
  useEffect(() => {
    if (!forceReconnect || !publicKey || isFreePlay) return;
    // Don't reconnect if we already have a socket
    if (socket) return;

    console.log('Force reconnect: connecting to restore active game...');
    const newSocket = io(BACKEND_URL, { transports: ['websocket', 'polling'] });

    newSocket.on('connect', () => {
      console.log('Force reconnect: connected, registering...');
      newSocket.emit('player:register', { walletAddress: publicKey.toString() });
    });

    newSocket.on('game:reconnect', (gameState: {
      roomId: string;
      fen: string;
      moves: string[];
      yourColor: 'w' | 'b';
      currentTurn: 'w' | 'b';
      whiteTimeMs: number;
      blackTimeMs: number;
      matchPubkey?: string;
      matchCode?: string;
      stakeTier?: number;
      opponentWallet?: string;
    }) => {
      console.log('Force reconnect: restoring game state', gameState.roomId);
      const chess = chessRef.current!;
      chess.load(gameState.fen);
      setFen(gameState.fen);
      setGameRoomId(gameState.roomId);
      setPlayerColor(gameState.yourColor);
      setOpponentConnected(true);
      setWhiteTimeMs(gameState.whiteTimeMs);
      setBlackTimeMs(gameState.blackTimeMs);
      lastTickRef.current = Date.now();

      // Set player role based on color (white = host, black = joiner)
      // This is critical for correct winner determination in claim flow
      setDynamicPlayerRole(gameState.yourColor === 'w' ? 'host' : 'join');

      // Detect if this is a freeplay or wager game and set mode accordingly
      if (gameState.stakeTier !== undefined && gameState.stakeTier >= 0) {
        setMode('wager');
        setIsMultiplayer(true);
        if (gameState.matchCode) setWagerMatchCode(gameState.matchCode);
        if (gameState.matchPubkey) setCurrentMatchPubkey(new PublicKey(gameState.matchPubkey));
        if (gameState.stakeTier !== undefined) setSelectedStakeTier(gameState.stakeTier);
      } else {
        // Free play game
        setIsFreePlay(true);
      }
      setInWagerLobby(false);

      if (gameState.opponentWallet) {
        setOpponentWallet(gameState.opponentWallet);
        getUsername(gameState.opponentWallet).then(setOpponentUsername);
        getPlayerStats(gameState.opponentWallet).then(setOpponentStats);
      }
    });

    newSocket.on('game:move', ({ move, timeUpdate }: any) => {
      const chess = chessRef.current!;
      try {
        chess.move(move);
        setFen(chess.fen());
        if (timeUpdate) {
          setWhiteTimeMs(timeUpdate.whiteTimeMs);
          setBlackTimeMs(timeUpdate.blackTimeMs);
          lastTickRef.current = Date.now();
        }
      } catch (e) {
        console.error('Force reconnect: invalid move received', e);
      }
    });

    newSocket.on('game:end', ({ winner, reason, yourColor }: any) => {
      console.log('Force reconnect: game ended', winner, reason, 'My color:', yourColor);
      if (yourColor) setPlayerColor(yourColor);
      setGameWinner(winner);
      setGameEndReason(reason);
      setShowResultModal(true);
    });

    newSocket.on('game:opponentDisconnected', ({ reconnectDeadlineMs, lockedIn }: { reconnectDeadlineMs: number; lockedIn: boolean }) => {
      console.log(`Opponent disconnected (reconnect). Window: ${reconnectDeadlineMs / 1000}s. Locked in: ${lockedIn}`);
      setOpponentConnected(false);
      startDisconnectCountdown(reconnectDeadlineMs);
    });

    newSocket.on('game:opponentReconnected', () => {
      console.log('Opponent reconnected!');
      setOpponentConnected(true);
      clearDisconnectCountdown();
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [forceReconnect, publicKey, isMultiplayer, isFreePlay]);

  // WebSocket connection for FREE PLAY mode (no blockchain)
  useEffect(() => {
    if (!isFreePlay) return;
    
    console.log('Connecting to game server for FREE PLAY...');
    
    const newSocket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
    });
    
    newSocket.on('connect', () => {
      console.log('Connected for free play, socket id:', newSocket.id);
      
      // Register player first (needed for move handling)
      const walletAddr = publicKey?.toString() || `guest_${Math.random().toString(36).slice(2, 8)}`;
      console.log('Registering player with address:', walletAddr);
      newSocket.emit('player:register', { walletAddress: walletAddr });
    });
    
    // Handle registration errors
    newSocket.on('error', ({ message }) => {
      console.error('Socket error:', message);
    });
    
    // After registration, emit host/join
    newSocket.on('player:registered', () => {
      console.log('Player registered for free play');
      // Use refs to get latest values (closures may be stale)
      if (isCreatingFreePlayRef.current) {
        console.log('Emitting freeplay:host');
        newSocket.emit('freeplay:host', { walletAddress: publicKey?.toString() || 'anonymous' });
      } else if (isJoiningFreePlayRef.current && joinFreePlayCodeRef.current) {
        console.log('Emitting freeplay:join with code:', joinFreePlayCodeRef.current);
        newSocket.emit('freeplay:join', { 
          code: joinFreePlayCodeRef.current.toUpperCase(),
          walletAddress: publicKey?.toString() || 'anonymous' 
        });
      }
    });
    
    // Free play hosted confirmation
    newSocket.on('freeplay:hosted', ({ code }) => {
      console.log('Free play room created with code:', code);
      setFreePlayCode(code);
      setIsCreatingFreePlay(false);
    });
    
    // Guest joined the lobby (host receives this)
    newSocket.on('freeplay:guestJoined', ({ code, guestWallet, guest, hostColor }) => {
      console.log('Guest joined lobby:', guest, 'Host color:', hostColor);
      setInLobby(true);
      setLobbyHostColor(hostColor);
      setLobbyOpponentName(guest);
      setLobbyOpponentWallet(guestWallet);
      if (guestWallet) {
        getUsername(guestWallet).then(name => {
          if (name) setLobbyOpponentName(name);
        });
      }
      
      // Notify parent to dismiss WaitingOverlay — lobby UI takes over
      if (onFreePlayOpponentJoined) onFreePlayOpponentJoined();
    });
    
    // Joined lobby as guest
    newSocket.on('freeplay:joinedLobby', ({ code, hostWallet, host, yourColor }) => {
      console.log('Joined lobby as guest. Host:', host, 'My color:', yourColor);
      setInLobby(true);
      setFreePlayCode(code);
      setLobbyHostColor(yourColor === 'w' ? 'b' : 'w'); // hostColor is opposite of my color
      setLobbyOpponentName(host);
      setLobbyOpponentWallet(hostWallet);
      setPlayerColor(yourColor);
      setIsJoiningFreePlay(false);
      if (hostWallet) {
        getUsername(hostWallet).then(name => {
          if (name) setLobbyOpponentName(name);
        });
      }
      
      // Notify parent to dismiss WaitingOverlay — lobby UI takes over
      if (onFreePlayOpponentJoined) onFreePlayOpponentJoined();
    });
    
    // Colors updated
    newSocket.on('freeplay:colorsUpdated', ({ hostColor }) => {
      console.log('Colors updated. Host is now:', hostColor);
      setLobbyHostColor(hostColor);
      // Update my color based on my role
      if (dynamicPlayerRole === 'host' || isCreatingFreePlayRef.current) {
        setPlayerColor(hostColor);
      } else {
        setPlayerColor(hostColor === 'w' ? 'b' : 'w');
      }
    });
    
    // Swap request from guest (host receives this)
    newSocket.on('freeplay:swapRequest', ({ code, wantColor }) => {
      console.log('Guest is requesting to play as', wantColor === 'w' ? 'white' : 'black');
      setWhiteRequest(true);
      setSwapRequestWantColor(wantColor);
    });
    
    // Legacy: White request from guest (host receives this)
    newSocket.on('freeplay:whiteRequest', ({ code }) => {
      console.log('Guest is requesting white (legacy event)');
      setWhiteRequest(true);
      setSwapRequestWantColor('w');
    });
    
    // Response to swap request (guest receives this)
    newSocket.on('freeplay:swapRequestResponse', ({ accepted }) => {
      console.log('Swap request response:', accepted);
      setWhiteRequestPending(false);
      if (!accepted) {
        // Could show a toast/notification that request was declined
      }
    });
    
    // Legacy: Response to white request (guest receives this)
    newSocket.on('freeplay:whiteRequestResponse', ({ accepted }) => {
      console.log('White request response (legacy):', accepted);
      setWhiteRequestPending(false);
      if (!accepted) {
        // Could show a toast/notification that request was declined
      }
    });
    
    // Free play started (both host and guest)
    newSocket.on('freeplay:started', ({ roomId, yourColor, opponent, opponentWallet: oppWallet }) => {
      console.log('Free play started! Room:', roomId, 'Color:', yourColor, 'Opponent:', opponent, 'OpponentWallet:', oppWallet);
      setGameRoomId(roomId);
      setPlayerColor(yourColor);
      setOpponentConnected(true);
      setIsJoiningFreePlay(false);
      
      // Clear lobby state
      setInLobby(false);
      setWhiteRequest(false);
      setWhiteRequestPending(false);
      
      // Notify parent that game has started (dismiss waiting overlay)
      if (onFreePlayGameStarted) onFreePlayGameStarted();
      
      // Store opponent wallet for username lookup
      if (oppWallet) {
        setOpponentWallet(oppWallet);
        // Fetch opponent's username and stats
        getUsername(oppWallet).then(setOpponentUsername);
        getPlayerStats(oppWallet).then(setOpponentStats);
      }
      
      // Reset timer when game starts
      setWhiteTimeMs(600000);
      setBlackTimeMs(600000);
      lastTickRef.current = Date.now();
    });
    
    // Free play error
    newSocket.on('freeplay:error', ({ error }) => {
      console.error('Free play error:', error);
      alert(`Free play error: ${error}`);
      setIsJoiningFreePlay(false);
    });
    
    // Host left the lobby (guest receives this)
    newSocket.on('freeplay:hostLeft', ({ code }) => {
      console.log('Host left the lobby');
      alert('The host has left the game.');
      setInLobby(false);
      setFreePlayCode('');
      setLobbyOpponentName('');
      setLobbyOpponentWallet(null);
      setPlayerColor(null);
      setDynamicPlayerRole(undefined);
    });
    
    // Guest left the lobby (host receives this)
    newSocket.on('freeplay:guestLeft', ({ code }) => {
      console.log('Guest left the lobby');
      setInLobby(true); // Stay in lobby, waiting for new guest
      setLobbyOpponentName('');
      setLobbyOpponentWallet(null);
      setWhiteRequest(false);
    });
    
    // Spectating mode - joined game in progress
    newSocket.on('freeplay:spectating', ({ code, fen, hostColor, whitePlayer, blackPlayer }) => {
      console.log('Spectating game:', code, 'FEN:', fen);
      setIsSpectating(true);
      setIsFreePlay(true);
      setFreePlayCode(code);
      setSpectatorWhitePlayer(whitePlayer);
      setSpectatorBlackPlayer(blackPlayer);
      // Load the current position
      chessRef.current = new Chess(fen);
      setFen(fen);
      setIsJoiningFreePlay(false);
    });
    
    // Spectator receives move
    newSocket.on('spectator:move', ({ move, fen }) => {
      console.log('Spectator received move:', move);
      chessRef.current = new Chess(fen);
      setFen(fen);
      setLastMove({ from: move.from, to: move.to });
      // Play sound
      if (chessRef.current.isCheck()) {
        playSound('check');
      } else {
        playSound('move');
      }
    });
    
    // Spectator receives game end
    newSocket.on('spectator:gameEnd', ({ winner, reason }) => {
      console.log('Spectator - game ended:', winner, reason);
      // Could show a toast/notification
    });
    
    // Receive spectator count updates (for players)
    newSocket.on('freeplay:spectatorCount', ({ count }) => {
      console.log('!!! Spectator count received:', count);
      setSpectatorCount(count);
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
        const result = chess.move({ from: move.from, to: move.to, promotion: move.promotion });
        setFen(chess.fen());
        setLastMove({ from: move.from, to: move.to });
        // Play sound
        if (chess.isCheck()) {
          playSound('check');
        } else if (result?.flags?.includes('c') || result?.flags?.includes('e')) {
          playSound('capture');
        } else if (result?.flags?.includes('k') || result?.flags?.includes('q')) {
          playSound('castle');
        } else {
          playSound('move');
        }
      } catch (e) {
        console.error('Invalid move received:', e);
      }
    });

    // Game end notification
    newSocket.on('game:end', ({ winner, reason, yourColor }) => {
      console.log('Game over (freeplay):', winner, reason, 'My color:', yourColor);
      if (yourColor) setPlayerColor(yourColor);
      setGameWinner(winner);
      setGameEndReason(reason);
      setShowResultModal(true);
      clearDisconnectCountdown();
    });

    // Opponent disconnected during active freeplay game — show 2-min countdown
    newSocket.on('game:opponentDisconnected', ({ reconnectDeadlineMs, lockedIn }: { reconnectDeadlineMs: number; lockedIn: boolean }) => {
      console.log(`Opponent disconnected (freeplay). Window: ${reconnectDeadlineMs / 1000}s. Locked in: ${lockedIn}`);
      setOpponentConnected(false);
      startDisconnectCountdown(reconnectDeadlineMs);
    });

    // Opponent reconnected — clear countdown
    newSocket.on('game:opponentReconnected', () => {
      console.log('Opponent reconnected (freeplay)!');
      setOpponentConnected(true);
      clearDisconnectCountdown();
    });

    // Receive emoji reaction from opponent
    newSocket.on('game:reaction', ({ emoji }) => {
      console.log('Received reaction:', emoji);
      setIncomingReaction(emoji);
      // Auto-clear after 2 seconds
      setTimeout(() => setIncomingReaction(null), 2000);
    });
    
    // Receive chat message from opponent
    newSocket.on('game:chat', ({ message, timestamp }) => {
      console.log('Received chat:', message);
      setChatMessages(prev => [...prev, { message, sender: 'opponent', timestamp }]);
      setUnreadCount(prev => prev + 1);
    });
    
    newSocket.on('disconnect', () => {
      console.log('Disconnected from free play server');
    });
    
    setSocket(newSocket);
    
    return () => {
      newSocket.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFreePlay]); // Only depend on isFreePlay - playSound is accessed via ref pattern inside
  
  // WebSocket connection for WAGER SPECTATING mode
  useEffect(() => {
    if (!spectateRoomId) return;
    
    console.log('Connecting to game server to spectate wager match:', spectateRoomId);
    
    const newSocket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
    });
    
    newSocket.on('connect', () => {
      console.log('Connected for wager spectating, socket id:', newSocket.id);
      
      // Join as spectator immediately
      newSocket.emit('spectator:joinWager', { roomId: spectateRoomId });
    });
    
    // Spectator successfully joined
    newSocket.on('spectator:joined', ({ roomId, fen, whitePlayer, blackPlayer, whiteTimeMs, blackTimeMs, currentTurn, stakeTier, moves }) => {
      console.log('Joined as spectator:', roomId, 'FEN:', fen, 'Stake tier:', stakeTier);
      setIsSpectating(true);
      setGameRoomId(roomId);
      setSpectatorWhitePlayer(whitePlayer);
      setSpectatorBlackPlayer(blackPlayer);
      setSpectatorStakeTier(stakeTier);
      setSpectatorWhiteTime(whiteTimeMs);
      setSpectatorBlackTime(blackTimeMs);
      // Load the current position
      chessRef.current = new Chess(fen);
      setFen(fen);
      // If there are moves, show the last one
      if (moves && moves.length > 0) {
        const lastMove = moves[moves.length - 1];
        setLastMove({ from: lastMove.from, to: lastMove.to });
      }
    });
    
    // Spectator error
    newSocket.on('spectator:error', ({ error }) => {
      console.error('Spectator error:', error);
      alert(`Unable to spectate: ${error}`);
    });
    
    // Spectator receives move
    newSocket.on('spectator:move', ({ move, fen, timeUpdate, whiteTimeMs, blackTimeMs }) => {
      console.log('Spectator received move:', move);
      chessRef.current = new Chess(fen);
      setFen(fen);
      setLastMove({ from: move.from, to: move.to });
      // Update time from either direct props or timeUpdate object
      if (timeUpdate) {
        setSpectatorWhiteTime(timeUpdate.whiteTimeMs);
        setSpectatorBlackTime(timeUpdate.blackTimeMs);
      } else if (whiteTimeMs !== undefined) {
        setSpectatorWhiteTime(whiteTimeMs);
        if (blackTimeMs !== undefined) setSpectatorBlackTime(blackTimeMs);
      }
      // Play sound
      if (chessRef.current.isCheck()) {
        playSound('check');
      } else {
        playSound('move');
      }
    });
    
    // Spectator receives time updates
    newSocket.on('spectator:timeUpdate', ({ whiteTimeMs, blackTimeMs }) => {
      setSpectatorWhiteTime(whiteTimeMs);
      setSpectatorBlackTime(blackTimeMs);
    });
    
    // Spectator receives game end
    newSocket.on('spectator:gameEnd', ({ winner, reason }) => {
      console.log('Spectator - wager game ended:', winner, reason);
      setGameWinner(winner);
      setShowResultModal(true);
    });
    
    // Receive spectator count updates
    newSocket.on('game:spectatorCount', ({ count }) => {
      console.log('Wager spectator count:', count);
      setSpectatorCount(count);
    });
    
    newSocket.on('disconnect', () => {
      console.log('Disconnected from wager spectating');
    });
    
    setSocket(newSocket);
    
    return () => {
      newSocket.emit('spectator:leaveWager', { roomId: spectateRoomId });
      newSocket.disconnect();
    };
  }, [spectateRoomId, playSound]);
  
  // Send move to opponent
  const sendMove = useCallback((from: string, to: string, san: string, fen: string, promotion?: string) => {
    if (!isMultiplayer && !isFreePlay) {
      console.log('Not multiplayer/freeplay, not sending move');
      return;
    }
    if (!socket) {
      console.error('ERROR: Socket not connected, cannot send move!');
      return;
    }
    if (!gameRoomId) {
      console.error('ERROR: gameRoomId not set, cannot send move! Current state:', { isMultiplayer, isFreePlay, opponentConnected });
      return;
    }
    console.log('Sending move to server:', { roomId: gameRoomId, from, to, san, fen, promotion });
    socket.emit('game:makeMove', { 
      roomId: gameRoomId,
      move: { from, to, san, fen, promotion }
    });
  }, [socket, isMultiplayer, isFreePlay, gameRoomId, opponentConnected]);
  
  // Send emoji reaction
  const sendReaction = useCallback((emoji: string) => {
    // Show our own reaction too
    setOutgoingReaction(emoji);
    setTimeout(() => setOutgoingReaction(null), 2000);
    
    // For AI matches, AI responds with a random reaction
    if (mode === 'practice' && !isFreePlay) {
      const aiResponses = ['🤔', '👍', '😮', '🔥'];
      setTimeout(() => {
        setIncomingReaction(aiResponses[Math.floor(Math.random() * aiResponses.length)]);
        setTimeout(() => setIncomingReaction(null), 2000);
      }, 800 + Math.random() * 1200);
      return;
    }
    
    // For multiplayer, send via socket
    if (socket && gameRoomId) {
      socket.emit('game:reaction', { roomId: gameRoomId, emoji });
    }
    setShowEmojiPicker(false);
  }, [socket, gameRoomId, mode, isFreePlay]);
  
  // Send chat message
  const sendChat = useCallback(() => {
    if (!chatInput.trim()) return;
    
    const message = chatInput.trim().slice(0, 200);
    const timestamp = Date.now();
    
    // Add to our own messages
    setChatMessages(prev => [...prev, { message, sender: 'me', timestamp }]);
    setChatInput('');
    
    // For AI matches, AI responds with a random message
    if (mode === 'practice' && !isFreePlay) {
      const aiResponses = [
        'Good move!', 'Interesting...', 'Hmm, let me think...', 
        'Nice!', '🤔', 'Well played!', 'I see what you did there'
      ];
      setTimeout(() => {
        setChatMessages(prev => [...prev, { 
          message: aiResponses[Math.floor(Math.random() * aiResponses.length)], 
          sender: 'opponent', 
          timestamp: Date.now() 
        }]);
      }, 1000 + Math.random() * 2000);
      return;
    }
    
    // For multiplayer, send via socket
    if (socket && gameRoomId) {
      socket.emit('game:chat', { roomId: gameRoomId, message });
    }
  }, [chatInput, socket, gameRoomId, mode, isFreePlay]);
  
  // Clear unread count when chat is opened
  useEffect(() => {
    if (showChat) {
      setUnreadCount(0);
    }
  }, [showChat]);
  
  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);
  
  // Auto-join free play if code is provided via URL
  useEffect(() => {
    if (freePlayJoinCode && freePlayJoinCode.length === 4 && !isFreePlay) {
      console.log('Auto-joining free play room:', freePlayJoinCode);
      const code = freePlayJoinCode.toUpperCase();
      setJoinFreePlayCode(code);
      setIsFreePlay(true);
      setIsJoiningFreePlay(true);
      setPlayerColor('b');
      setDynamicPlayerRole('join'); // Important: set role for lobby UI
      // Also update refs immediately to avoid race condition with socket
      joinFreePlayCodeRef.current = code;
      isJoiningFreePlayRef.current = true;
    }
  }, [freePlayJoinCode]);

  // Auto-create free play room if prop is set
  useEffect(() => {
    if (autoCreateFreePlay && !isFreePlay && !freePlayJoinCode) {
      console.log('Auto-creating free play room');
      handleCreateFreePlay();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCreateFreePlay]);

  // Notify parent when free play code is generated
  useEffect(() => {
    if (freePlayCode && onFreePlayCodeGenerated) {
      onFreePlayCodeGenerated(freePlayCode);
    }
  }, [freePlayCode, onFreePlayCodeGenerated]);

  // Free play handlers
  const handleCreateFreePlay = () => {
    // Set refs immediately to avoid race condition with socket useEffect
    isCreatingFreePlayRef.current = true;
    isJoiningFreePlayRef.current = false;
    
    setIsFreePlay(true);
    setIsCreatingFreePlay(true);
    setPlayerColor('w');
    setDynamicPlayerRole('host');
    setLobbyHostColor('w');
    // Socket connection will be established by the useEffect
    // Emit happens in socket connect handler using refs
  };
  
  const handleJoinFreePlay = () => {
    if (!joinFreePlayCode || joinFreePlayCode.length !== 4) {
      alert('Please enter a 4-character room code');
      return;
    }
    // Set refs immediately to avoid race condition with socket useEffect
    isCreatingFreePlayRef.current = false;
    isJoiningFreePlayRef.current = true;
    joinFreePlayCodeRef.current = joinFreePlayCode;
    
    setIsFreePlay(true);
    setIsJoiningFreePlay(true);
    setPlayerColor('b');
    setDynamicPlayerRole('join');
    // Socket connection will be established by the useEffect
    // Emit happens in socket connect handler using refs
  };
  
  const handleCancelFreePlay = () => {
    // If game is in progress (opponent connected), resign/abandon
    if (socket && gameRoomId && opponentConnected) {
      console.log('Leaving active game - emitting resignation');
      socket.emit('game:resign', { roomId: gameRoomId });
    } else if (socket && freePlayCode) {
      // Just cancelling a room before opponent joined
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
    setSpectatorCount(0);
    // Reset chess board
    chessRef.current = new Chess();
    setFen(chessRef.current.fen());
    setLastMove(null);
  };

  // Host starts the free play game from lobby
  const handleStartFreePlayGame = () => {
    if (!socket || !freePlayCode || !inLobby) return;
    console.log('Host starting free play game:', freePlayCode);
    socket.emit('freeplay:startGame', { code: freePlayCode });
  };

  // Host flips colors in the free play lobby
  const handleFlipFreePlayColors = () => {
    if (!socket || !freePlayCode || !inLobby) return;
    console.log('Flipping colors for room:', freePlayCode);
    socket.emit('freeplay:swapColors', { code: freePlayCode });
  };

  // Host starts the wager game from lobby
  const handleStartWagerGame = () => {
    if (!socket || !wagerMatchCode) return;
    console.log('Host starting wager game:', wagerMatchCode);
    socket.emit('match:startGame', { matchCode: wagerMatchCode });
  };

  // Host flips colors in the wager lobby
  const handleFlipWagerColors = () => {
    if (!socket || !wagerMatchCode) return;
    const newColor = wagerLobbyHostColor === 'w' ? 'b' : 'w';
    console.log('Flipping wager colors, new host color:', newColor);
    socket.emit('match:setColor', { matchCode: wagerMatchCode, color: newColor });
    setWagerLobbyHostColor(newColor);
  };

  const board = useMemo(() => {
    return chessRef.current!.board();
  }, [fen]);

  const legalDestinations = useMemo(() => {
    if (!selectedSquare) return new Set<string>();
    const moves = chessRef.current!.moves({ square: selectedSquare as any, verbose: true }) as Array<any>;
    return new Set(moves.map((m) => m.to));
  }, [selectedSquare, fen]);

  // Find king position for check indicator
  const kingInCheck = useMemo(() => {
    const chess = chessRef.current!;
    if (!chess.isCheck()) return null;
    const turn = chess.turn();
    const boardState = chess.board();
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = boardState[row][col];
        if (piece && piece.type === 'k' && piece.color === turn) {
          return squareFromRowCol(row, col);
        }
      }
    }
    return null;
  }, [fen]);

  // Captured pieces calculation
  const capturedPieces = useMemo(() => getCapturedPieces(chessRef.current!), [fen]);
  const materialAdvantage = useMemo(() => getMaterialAdvantage(capturedPieces), [capturedPieces]);

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
    setGameEndReason(null);
    setShowResultModal(false);
    setLastMove(null);
    setFen(chessRef.current.fen());
    // Reset timer for AI games
    setWhiteTimeMs(600000);
    setBlackTimeMs(600000);
    setAiGameStarted(false);
    lastTickRef.current = Date.now();
    setTipIndex(prev => (prev + 1) % PRACTICE_TIPS.length);
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
      
      // Check balance first
      const balance = await connection.getBalance(publicKey);
      const stakeInfo = getStakeTierInfo(selectedStakeTier);
      const requiredLamports = stakeInfo.lamports + 10000000; // stake + ~0.01 SOL for fees and rent
      console.log('Balance:', balance / 1e9, 'SOL, Required:', requiredLamports / 1e9, 'SOL');
      
      if (balance < requiredLamports) {
        throw new Error(`Insufficient balance. You have ${(balance / 1e9).toFixed(4)} SOL but need at least ${(requiredLamports / 1e9).toFixed(4)} SOL (stake + fees).`);
      }
      
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
      console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      
      // Check for specific error types and provide helpful messages
      const errorMsg = error.message || String(error);
      
      if (errorMsg.includes('User rejected') || errorMsg.includes('rejected')) {
        alert('Transaction was cancelled');
      } else if (errorMsg.toLowerCase().includes('missing signature')) {
        // This typically means the wallet's active account doesn't match what's expected
        alert(`Signature mismatch error. Your wallet might be using a different account than expected.\n\nPlease:\n1. Check which account is active in your wallet\n2. Try disconnecting and reconnecting your wallet\n3. Try refreshing the page`);
      } else if (errorMsg.includes('signed by wrong wallet')) {
        alert(errorMsg + '\n\nPlease check your wallet\'s active account and try again.');
      } else if (errorMsg.includes('Insufficient') || errorMsg.includes('debit')) {
        alert(`Insufficient SOL balance. Please add more SOL to your wallet to cover the stake and transaction fees.`);
      } else if (errorMsg.includes('blockhash') || errorMsg.includes('expired')) {
        alert('Transaction expired. Please try again - your internet connection may be slow.');
      } else if (errorMsg.includes('simulation failed') || errorMsg.includes('Simulation failed')) {
        alert('Transaction simulation failed. This might be a temporary network issue. Please try again.');
      } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
        alert('Network error. Please check your internet connection and try again.');
      } else {
        alert(`Failed to create match: ${errorMsg}`);
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

  // Handle on-chain join for wager match (required for share link joiners)
  const handleJoinOnChain = async () => {
    if (!connected || !publicKey) {
      setJoinerStakeError('Please connect your wallet first');
      return;
    }

    if (!currentMatchPubkey) {
      setJoinerStakeError('No match to join');
      return;
    }

    setIsJoiningMatch(true);
    setJoinerStakeError(null);
    try {
      const client = new EscrowClient(connection, wallet);
      
      // First check if we're already joined (playerB matches our wallet)
      const matchData = await client.fetchMatch(currentMatchPubkey);
      if (matchData?.playerB?.equals(publicKey)) {
        console.log('Already joined on-chain!');
        setHasJoinerStaked(true);
        return;
      }

      // Check if match is still open
      if (matchData?.status !== MatchStatus.Open) {
        setJoinerStakeError('Match is no longer available to join');
        return;
      }

      console.log('Joining match on-chain...', currentMatchPubkey.toBase58());
      const signature = await client.joinMatch(currentMatchPubkey);
      
      console.log('Successfully joined match on-chain! Signature:', signature);
      setTxSignature(signature);
      setHasJoinerStaked(true);
    } catch (error: any) {
      console.error('Error joining match on-chain:', error);
      if (error.message?.includes('User rejected') || error.message?.includes('rejected')) {
        setJoinerStakeError('Transaction was cancelled');
      } else {
        setJoinerStakeError(`Failed to stake: ${error.message || error}`);
      }
    } finally {
      setIsJoiningMatch(false);
    }
  };

  // Check on-chain status when joining a wager match via share link
  useEffect(() => {
    const checkJoinerStatus = async () => {
      if (actualPlayerRole !== 'join' || mode !== 'wager' || !currentMatchPubkey || !publicKey) {
        return;
      }

      try {
        const client = new EscrowClient(connection, wallet);
        const matchData = await client.fetchMatch(currentMatchPubkey);
        
        if (matchData?.playerB?.equals(publicKey)) {
          console.log('Already staked on-chain as Player B');
          setHasJoinerStaked(true);
        } else {
          console.log('Not yet staked on-chain - need to join');
          setHasJoinerStaked(false);
        }
      } catch (error) {
        console.error('Error checking join status:', error);
        setHasJoinerStaked(false);
      }
    };

    checkJoinerStatus();
  }, [actualPlayerRole, mode, currentMatchPubkey, publicKey]);

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

    // Double-check: only winner should submit
    if (playerColor !== gameWinner) {
      console.log('Skipping result submission - you are not the winner');
      return;
    }

    setIsSubmittingResult(true);
    try {
      const client = new EscrowClient(connection, wallet);
      
      const matchData = await client.fetchMatch(currentMatchPubkey);
      if (!matchData) {
        // Match account doesn't exist - either already closed or error
        // This is expected if payout already happened
        console.log('Match account not found - payout may have already been processed');
        setPayoutComplete(true);
        return;
      }

      // Check match status before submitting
      console.log('Match status:', matchData.status);
      console.log('Match playerA:', matchData.playerA.toBase58());
      console.log('Match playerB:', matchData.playerB?.toBase58() || 'None');
      
      if (matchData.status !== MatchStatus.Active) {
        // Match already finished - payout already happened
        console.log(`Match already in ${matchData.status} status - payout already processed`);
        setPayoutComplete(true);
        return;
      }

      // IMPORTANT: The winner is the current player (we only call this if playerColor === gameWinner)
      // playerA = host (match creator), playerB = guest (joiner)
      // Determine which on-chain account we are by comparing wallet pubkeys
      // (actualPlayerRole can be wrong after reconnect since banner always uses mode=join)
      const myPubkeyStr = publicKey.toBase58();
      const isHost = matchData.playerA.toBase58() === myPubkeyStr;
      const winnerPubkey = isHost ? matchData.playerA : matchData.playerB!;
      
      // STEP 1: Submit result first - this records the winner on-chain
      // Even if payout fails later, the winner is locked in and loser can't abandon
      console.log('Submitting result... Winner:', winnerPubkey.toBase58(), 'isHost:', isHost, 'playerColor:', playerColor, 'gameWinner:', gameWinner);
      const resultSignature = await client.submitResult(currentMatchPubkey, winnerPubkey);
      console.log('Result submitted:', resultSignature);
      setTxSignature(resultSignature);
      
      // Wait a moment for chain state to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // STEP 2: Confirm payout - separate try/catch so submit_result success is preserved
      try {
        console.log('Confirming payout...');
        await handleConfirmPayout(winnerPubkey, matchData.playerA);
      } catch (payoutError: any) {
        console.error('Payout failed but winner is recorded:', payoutError);
        alert(`Winner recorded on-chain! Payout failed - claim your winnings from the Refund page.`);
      }
    } catch (error: any) {
      console.error('Error submitting result:', error);
      
      // Check if the error is because the account is already closed (payout already done)
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('AccountNotInitialized') || errorMessage.includes('not found')) {
        console.log('Match account already closed - payout was already processed');
        setPayoutComplete(true);
        return;
      }
      
      alert(`Failed to submit result. You may need to use the Refund page to recover funds. Error: ${error}`);
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
      
      alert(`🎉 Payout complete! Winner received the pot. TX: ${signature.slice(0, 8)}...`);
    } catch (error) {
      console.error('Error confirming payout:', error);
      // Don't mark as complete if payout failed
      alert(`Payout failed. You can claim your funds from the Refund page. Error: ${error}`);
    }
  };

  // Handle early draw refund — calls abandon_match on-chain to refund both players
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundComplete, setRefundComplete] = useState(false);

  const handleDrawRefund = async () => {
    if (!connected || !publicKey || !currentMatchPubkey) {
      return;
    }
    setIsRefunding(true);
    try {
      const client = new EscrowClient(connection, wallet);
      const matchData = await client.fetchMatch(currentMatchPubkey);
      if (!matchData) {
        console.log('Match account not found — already refunded or closed');
        setRefundComplete(true);
        return;
      }
      if (matchData.status !== MatchStatus.Active) {
        console.log(`Match already in ${matchData.status} status`);
        setRefundComplete(true);
        return;
      }
      const playerA = matchData.playerA;
      const playerB = matchData.playerB!;
      const signature = await client.abandonMatch(currentMatchPubkey, playerA, playerB);
      console.log('Draw refund complete:', signature);
      setTxSignature(signature);
      setRefundComplete(true);
    } catch (error: any) {
      console.error('Refund failed:', error);
      const msg = error?.message || String(error);
      if (msg.includes('AccountNotInitialized') || msg.includes('not found')) {
        setRefundComplete(true);
        return;
      }
      if (msg.includes('MatchLockedIn') || msg.includes('MatchNotActive')) {
        // If abandon_match fails due to time gate or match already finished, try force_refund
        try {
          const client = new EscrowClient(connection, wallet);
          const matchData = await client.fetchMatch(currentMatchPubkey);
          if (matchData) {
            const signature = await client.forceRefund(currentMatchPubkey, matchData.playerA, matchData.playerB!);
            console.log('Force refund complete:', signature);
            setTxSignature(signature);
            setRefundComplete(true);
            return;
          }
        } catch (forceErr: any) {
          console.error('Force refund also failed:', forceErr);
        }
      }
      alert(`Refund failed. You can use the Refund page to recover funds. Error: ${msg}`);
    } finally {
      setIsRefunding(false);
    }
  };

  // NOTE: Auto-submit removed - user must click "Claim Winnings" button in modal
  // This prevents mobile wallet popups from being auto-rejected when user taps screen
  useEffect(() => {
    if (mode === 'wager' && gameWinner && currentMatchPubkey) {
      const isWinner = playerColor === gameWinner;
      if (isWinner) {
        console.log('You won! Click "Claim Winnings" to submit result and get your payout.');
      } else {
        console.log('You lost. The winner will claim the payout.');
      }
    }
  }, [gameWinner, mode, currentMatchPubkey, playerColor]);

  const isPromotionMove = (from: string, to: string): boolean => {
    const chess = chessRef.current!;
    const piece = chess.get(from as any) as any;
    if (!piece || piece.type !== 'p') return false;
    const toRank = Number(to[1]);
    return (piece.color === 'w' && toRank === 8) || (piece.color === 'b' && toRank === 1);
  };

  const executeMove = (from: string, to: string, promotion?: string) => {
    const chess = chessRef.current!;
    const moveOptions: any = { from, to };
    if (promotion) moveOptions.promotion = promotion;

    try {
      const move = chess.move(moveOptions);
      if (!move) return;
      setSelectedSquare(null);
      setPendingPromotion(null);
      setFen(chess.fen());
      setLastMove({ from, to });

      if (mode === 'practice' && !isFreePlay && !aiGameStarted) {
        setAiGameStarted(true);
        lastTickRef.current = Date.now();
      }

      if (chess.isCheck()) {
        playSound('check');
      } else if (move.flags?.includes('c') || move.flags?.includes('e')) {
        playSound('capture');
      } else if (move.flags?.includes('k') || move.flags?.includes('q')) {
        playSound('castle');
      } else {
        playSound('move');
      }

      if (isMultiplayer || isFreePlay) {
        sendMove(from, to, move.san, chess.fen(), promotion);
      }
    } catch (error) {
      setSelectedSquare(null);
      setPendingPromotion(null);
    }
  };

  const handlePromotionSelect = (piece: string) => {
    if (!pendingPromotion) return;
    executeMove(pendingPromotion.from, pendingPromotion.to, piece);
  };

  // --- Enhanced AI Engine with iterative deepening, quiescence search, and non-deterministic play ---
  const practiceSearchRef = useRef({ startTime: 0, timedOut: false });

  const getPieceVal = (piece: string): number => {
    const v: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    return v[piece] || 0;
  };

  const evaluateBoard = (chess: Chess): number => {
    if (chess.isCheckmate()) return chess.turn() === 'w' ? -10000 : 10000;
    if (chess.isDraw()) return 0;

    const pieceValues: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

    const pawnTable = [
      0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10,
      5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5,
      5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0
    ];
    const knightTable = [
      -50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40,
      -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30,
      -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30,
      -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50
    ];
    const bishopTable = [
      -20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10,
      -10,0,10,10,10,10,0,-10, -10,5,10,15,15,10,5,-10,
      -10,0,15,15,15,15,0,-10, -10,10,10,10,10,10,10,-10,
      -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20
    ];
    const rookTable = [
      0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5,
      -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
      -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
      -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0
    ];
    const queenTable = [
      -20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10,
      -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5,
      0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10,
      -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20
    ];
    const kingMiddleTable = [
      -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
      -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10,
      20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20
    ];
    const kingEndgameTable = [
      -50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30,
      -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30,
      -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30,
      -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50
    ];

    const tables: Record<string, number[]> = {
      p: pawnTable, n: knightTable, b: bishopTable, r: rookTable, q: queenTable, k: kingMiddleTable,
    };

    let score = 0;
    const board = chess.board();
    let totalMaterial = 0;
    let wBishops = 0, bBishops = 0;
    const wPawnCols: number[][] = [[], [], [], [], [], [], [], []];
    const bPawnCols: number[][] = [[], [], [], [], [], [], [], []];

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece) {
          if (piece.type !== 'k' && piece.type !== 'p') totalMaterial += pieceValues[piece.type] || 0;
          if (piece.type === 'b') { if (piece.color === 'w') wBishops++; else bBishops++; }
          if (piece.type === 'p') { if (piece.color === 'w') wPawnCols[col].push(row); else bPawnCols[col].push(row); }
        }
      }
    }

    const isEndgame = totalMaterial < 2600;
    if (isEndgame) tables['k'] = kingEndgameTable;

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece) {
          const value = pieceValues[piece.type] || 0;
          const table = tables[piece.type];
          let posBonus = 0;
          if (table) posBonus = piece.color === 'w' ? table[row * 8 + col] : table[(7 - row) * 8 + col];
          score += piece.color === 'w' ? value + posBonus : -(value + posBonus);
        }
      }
    }

    // Bishop pair
    if (wBishops >= 2) score += 30;
    if (bBishops >= 2) score -= 30;

    // Pawn structure
    for (let col = 0; col < 8; col++) {
      if (wPawnCols[col].length > 1) score -= 20 * (wPawnCols[col].length - 1);
      if (bPawnCols[col].length > 1) score += 20 * (bPawnCols[col].length - 1);
      if (wPawnCols[col].length > 0) {
        const hasN = (col > 0 && wPawnCols[col-1].length > 0) || (col < 7 && wPawnCols[col+1].length > 0);
        if (!hasN) score -= 15;
      }
      if (bPawnCols[col].length > 0) {
        const hasN = (col > 0 && bPawnCols[col-1].length > 0) || (col < 7 && bPawnCols[col+1].length > 0);
        if (!hasN) score += 15;
      }
      for (const row of wPawnCols[col]) {
        let passed = true;
        for (let r = row - 1; r >= 0 && passed; r--) for (let c = Math.max(0, col-1); c <= Math.min(7, col+1); c++) if (bPawnCols[c].includes(r)) passed = false;
        if (passed) score += 20 + (7 - row) * 10;
      }
      for (const row of bPawnCols[col]) {
        let passed = true;
        for (let r = row + 1; r <= 7 && passed; r++) for (let c = Math.max(0, col-1); c <= Math.min(7, col+1); c++) if (wPawnCols[c].includes(r)) passed = false;
        if (passed) score -= 20 + row * 10;
      }
    }

    // Rook on open file
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.type === 'r') {
          const own = piece.color === 'w' ? wPawnCols[col] : bPawnCols[col];
          const opp = piece.color === 'w' ? bPawnCols[col] : wPawnCols[col];
          if (own.length === 0 && opp.length === 0) score += piece.color === 'w' ? 25 : -25;
          else if (own.length === 0) score += piece.color === 'w' ? 15 : -15;
        }
      }
    }

    // King safety in middlegame
    if (!isEndgame) {
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const piece = board[row][col];
          if (piece && piece.type === 'k') {
            let shield = 0;
            if (piece.color === 'w' && row >= 6) {
              for (let c = Math.max(0, col-1); c <= Math.min(7, col+1); c++) {
                if (board[row-1]?.[c]?.type === 'p' && board[row-1]?.[c]?.color === 'w') shield += 15;
                if (board[row-2]?.[c]?.type === 'p' && board[row-2]?.[c]?.color === 'w') shield += 5;
              }
              score += shield;
            } else if (piece.color === 'b' && row <= 1) {
              for (let c = Math.max(0, col-1); c <= Math.min(7, col+1); c++) {
                if (board[row+1]?.[c]?.type === 'p' && board[row+1]?.[c]?.color === 'b') shield += 15;
                if (board[row+2]?.[c]?.type === 'p' && board[row+2]?.[c]?.color === 'b') shield += 5;
              }
              score -= shield;
            }
          }
        }
      }
    }

    score += chess.moves().length * 3 * (chess.turn() === 'w' ? 1 : -1);
    return score;
  };

  const orderMovesTree = (moves: Move[]): Move[] => {
    return moves.sort((a, b) => {
      let sa = 0, sb = 0;
      if (a.captured) sa += 1000 + getPieceVal(a.captured) * 100 - getPieceVal(a.piece) * 10;
      if (b.captured) sb += 1000 + getPieceVal(b.captured) * 100 - getPieceVal(b.piece) * 10;
      if (a.promotion) sa += 900;
      if (b.promotion) sb += 900;
      if (['d4','d5','e4','e5'].includes(a.to)) sa += 20;
      if (['d4','d5','e4','e5'].includes(b.to)) sb += 20;
      return sb - sa;
    });
  };

  const practiceQuiescence = (chess: Chess, alpha: number, beta: number, maximizing: boolean, qDepth: number): number => {
    const sr = practiceSearchRef.current;
    if (sr.timedOut || Date.now() - sr.startTime > AI_SETTINGS[aiDifficulty].timeLimit) {
      sr.timedOut = true;
      return evaluateBoard(chess);
    }
    const standPat = evaluateBoard(chess);
    if (qDepth <= 0) return standPat;
    if (chess.isGameOver()) {
      if (chess.isCheckmate()) return chess.turn() === 'w' ? -10000 : 10000;
      return 0;
    }
    if (maximizing) {
      if (standPat >= beta) return beta;
      let a = Math.max(alpha, standPat);
      const caps = chess.moves({ verbose: true }).filter(m => m.captured || m.promotion)
        .sort((x, y) => ((y.captured ? getPieceVal(y.captured) * 100 : 0) + (y.promotion ? 800 : 0)) - ((x.captured ? getPieceVal(x.captured) * 100 : 0) + (x.promotion ? 800 : 0)));
      for (const move of caps) {
        if (move.captured && standPat + getPieceVal(move.captured) * 100 + 200 < a) continue;
        chess.move(move);
        const s = practiceQuiescence(chess, a, beta, false, qDepth - 1);
        chess.undo();
        if (sr.timedOut) return s;
        if (s > a) a = s;
        if (a >= beta) return beta;
      }
      return a;
    } else {
      if (standPat <= alpha) return alpha;
      let b = Math.min(beta, standPat);
      const caps = chess.moves({ verbose: true }).filter(m => m.captured || m.promotion)
        .sort((x, y) => ((y.captured ? getPieceVal(y.captured) * 100 : 0) + (y.promotion ? 800 : 0)) - ((x.captured ? getPieceVal(x.captured) * 100 : 0) + (x.promotion ? 800 : 0)));
      for (const move of caps) {
        if (move.captured && standPat - getPieceVal(move.captured) * 100 - 200 > b) continue;
        chess.move(move);
        const s = practiceQuiescence(chess, alpha, b, true, qDepth - 1);
        chess.undo();
        if (sr.timedOut) return s;
        if (s < b) b = s;
        if (alpha >= b) return alpha;
      }
      return b;
    }
  };

  const minimax = (chess: Chess, depth: number, alpha: number, beta: number, maximizing: boolean): number => {
    const sr = practiceSearchRef.current;
    if (Date.now() - sr.startTime > AI_SETTINGS[aiDifficulty].timeLimit) {
      sr.timedOut = true;
      return evaluateBoard(chess);
    }
    if (chess.isGameOver()) {
      if (chess.isCheckmate()) return chess.turn() === 'w' ? -10000 - depth : 10000 + depth;
      return 0;
    }
    if (depth <= 0) return practiceQuiescence(chess, alpha, beta, maximizing, 6);

    const moves = orderMovesTree(chess.moves({ verbose: true }));
    if (maximizing) {
      let maxEval = -Infinity;
      for (const move of moves) {
        chess.move(move);
        const ev = minimax(chess, depth - 1, alpha, beta, false);
        chess.undo();
        if (sr.timedOut) return ev;
        maxEval = Math.max(maxEval, ev);
        alpha = Math.max(alpha, ev);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        chess.move(move);
        const ev = minimax(chess, depth - 1, alpha, beta, true);
        chess.undo();
        if (sr.timedOut) return ev;
        minEval = Math.min(minEval, ev);
        beta = Math.min(beta, ev);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  };

  const playComputerMove = React.useCallback(() => {
    const chess = chessRef.current!;
    if (chess.isGameOver()) return;
    
    // Don't make AI moves if game ended due to timeout
    if (gameWinner) return;
    
    // AI plays the opposite color of the player
    const aiColor = aiPlayerColor === 'w' ? 'b' : 'w';
    if (chess.turn() !== aiColor) return;

    const moves = chess.moves({ verbose: true }) as Array<any>;
    if (moves.length === 0) return;
    if (moves.length === 1) { /* only one legal move */ }

    // Iterative deepening with difficulty-based depth & time limits
    const settings = AI_SETTINGS[aiDifficulty];
    const sr = practiceSearchRef.current;
    sr.startTime = Date.now();
    sr.timedOut = false;

    let bestMove = moves[0];
    let candidates: { move: any; score: number }[] = [];
    const isMax = aiColor === 'w';

    // Order root moves: captures/promotions first, then center moves
    const rootOrder = (ms: any[], pvMove: any | null) => {
      return [...ms].sort((a, b) => {
        let sa = 0, sb = 0;
        if (pvMove && a.from === pvMove.from && a.to === pvMove.to) sa += 10000;
        if (pvMove && b.from === pvMove.from && b.to === pvMove.to) sb += 10000;
        if (a.captured) sa += 1000 + getPieceVal(a.captured) * 100;
        if (b.captured) sb += 1000 + getPieceVal(b.captured) * 100;
        if (a.promotion) sa += 900;
        if (b.promotion) sb += 900;
        if (a.san?.includes('+') || a.san?.includes('#')) sa += 500;
        if (b.san?.includes('+') || b.san?.includes('#')) sb += 500;
        if (['d4','d5','e4','e5'].includes(a.to)) sa += 20;
        if (['d4','d5','e4','e5'].includes(b.to)) sb += 20;
        return sb - sa;
      });
    };

    for (let depth = 1; depth <= settings.maxDepth; depth++) {
      if (Date.now() - sr.startTime > settings.timeLimit) break;
      const depthCandidates: { move: any; score: number }[] = [];
      const ordered = rootOrder(moves, bestMove);

      for (const move of ordered) {
        if (sr.timedOut) break;
        chess.move(move);
        const score = minimax(chess, depth - 1, -Infinity, Infinity, !isMax);
        chess.undo();
        if (sr.timedOut) break;
        depthCandidates.push({ move, score });
      }

      if (!sr.timedOut && depthCandidates.length > 0) {
        candidates = depthCandidates;
        candidates.sort((a, b) => isMax ? b.score - a.score : a.score - b.score);
        bestMove = candidates[0].move;
        if (Math.abs(candidates[0].score) > 9000) break;
      } else if (depthCandidates.length > 0 && candidates.length === 0) {
        candidates = depthCandidates;
        candidates.sort((a, b) => isMax ? b.score - a.score : a.score - b.score);
        bestMove = candidates[0].move;
      }
    }

    // Non-deterministic: pick randomly among moves within variance of best
    if (candidates.length > 1 && Math.abs(candidates[0].score) < 9000) {
      const best = candidates[0].score;
      const eligible = candidates.filter(c => Math.abs(c.score - best) <= settings.variance);
      if (eligible.length > 1) {
        bestMove = eligible[Math.floor(Math.random() * eligible.length)].move;
      }
    }

    const result = chess.move(bestMove);
    setFen(chess.fen());
    setLastMove({ from: bestMove.from, to: bestMove.to });
    
    // Start AI game timer on first AI move (when player is black)
    if (!aiGameStarted) {
      setAiGameStarted(true);
      lastTickRef.current = Date.now();
    }
    
    // Play sound for AI move
    if (chess.isCheck()) {
      playSound('check');
    } else if (result?.flags?.includes('c') || result?.flags?.includes('e')) {
      playSound('capture');
    } else if (result?.flags?.includes('k') || result?.flags?.includes('q')) {
      playSound('castle');
    } else {
      playSound('move');
    }
  }, [playSound, aiDifficulty, aiPlayerColor, gameWinner]);

  const onSquareClick = (square: string) => {
    const chess = chessRef.current!;

    if (chess.isGameOver()) return;
    
    // Don't allow moves if game ended due to timeout
    if (gameWinner) return;
    
    // Spectators cannot make moves
    if (isSpectating) return;

    // In multiplayer or free play, don't allow moves until opponent connects
    if ((isMultiplayer || isFreePlay) && !opponentConnected) {
      console.log('Waiting for opponent to connect...');
      return;
    }

    // In multiplayer or free play, only allow moves on your turn with your color
    if ((isMultiplayer || isFreePlay) && playerColor) {
      if (chess.turn() !== playerColor) {
        console.log('Not your turn! You are', playerColor, 'but it is', chess.turn(), 'to move');
        return;
      }
    }

    if (mode === 'practice' && !isFreePlay) {
      if (chess.turn() !== aiPlayerColor) return;
    }

    if (!selectedSquare) {
      const piece = chess.get(square as any) as any;
      if (!piece) return;
      
      // In multiplayer or free play, only select your own pieces
      if ((isMultiplayer || isFreePlay) && playerColor && piece.color !== playerColor) return;
      
      if (mode === 'practice' && !isFreePlay && piece.color !== aiPlayerColor) return;
      if (mode === 'wager' && !isMultiplayer && !isFreePlay && piece.color !== chess.turn()) return;
      setSelectedSquare(square);
      return;
    }

    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }

    // Check if this is a promotion move
    if (isPromotionMove(selectedSquare, square)) {
      // Validate move is legal first (try with queen promotion)
      const chess2 = new Chess(chess.fen());
      try {
        chess2.move({ from: selectedSquare, to: square, promotion: 'q' });
        setPendingPromotion({ from: selectedSquare, to: square });
      } catch {
        setSelectedSquare(null);
      }
      return;
    }

    executeMove(selectedSquare, square);
  };

  useEffect(() => {
    if (mode !== 'practice') return;
    if (isFreePlay) return; // Don't run AI during free play
    const chess = chessRef.current!;
    
    // AI plays the opposite color of the player
    const aiColor = aiPlayerColor === 'w' ? 'b' : 'w';
    if (chess.turn() !== aiColor) return;
    if (chess.isGameOver()) return;

    const t = setTimeout(() => {
      playComputerMove();
    }, 100);

    return () => clearTimeout(t);
  }, [fen, mode, isFreePlay, playComputerMove, aiPlayerColor]);

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
      <style>{`
        .chess-grid { display: grid; grid-template-columns: 620px 1fr; gap: 28px; align-items: start; }
        @media (max-width: 960px) { .chess-grid { grid-template-columns: 1fr; } .chess-board-col { max-width: 100% !important; overflow-x: hidden; } }
        @media (max-width: 640px) {
          .chess-board-wrap {
            background: transparent !important;
            border: none !important;
            backdrop-filter: none !important;
            padding: 0 !important;
            border-radius: 4px !important;
          }
          .chess-board-wrap .chess-board-inner {
            border-radius: 4px !important;
            border: none !important;
          }
        }
      `}</style>
      <div className="chess-grid">
        {/* Left Column - Board */}
        <div className="chess-board-col flex flex-col" style={{ width: '100%', maxWidth: 620, margin: '0 auto' }}>
          {/* Match Header */}
          {mode === 'wager' && matchInfo && (
            <div style={{
              width: '100%',
              maxWidth: 'min(576px, calc(100vw - 12px))',
              borderRadius: 20,
              overflow: 'hidden',
              marginBottom: 16,
              background: 'linear-gradient(180deg, rgba(20,20,40,0.95) 0%, rgba(12,12,26,0.98) 100%)',
              border: '1px solid rgba(153,69,255,0.15)',
              boxShadow: '0 0 40px rgba(153,69,255,0.06), 0 8px 24px rgba(0,0,0,0.3)',
            }}>
              {/* Top accent bar */}
              <div style={{
                height: 2,
                background: 'linear-gradient(90deg, transparent, #9945ff, #00ffa3, transparent)',
              }} />

              <div style={{ padding: '16px 20px' }}>
                {/* Stake & Pot Row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Swords style={{ width: 16, height: 16, color: '#9945ff' }} />
                    <span style={{
                      fontSize: 14,
                      fontWeight: 700,
                      fontFamily: "'Outfit', sans-serif",
                      color: '#e8e8f0',
                    }}>
                      Staked Match
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        display: 'block',
                        fontSize: 9,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: '#6b6b80',
                        fontFamily: "'Space Mono', monospace",
                        marginBottom: 2,
                      }}>Stake</span>
                      <span style={{
                        fontSize: 14,
                        fontWeight: 800,
                        fontFamily: "'Space Mono', monospace",
                        color: '#e8e8f0',
                      }}>{matchInfo.stake}</span>
                    </div>
                    <div style={{
                      width: 1,
                      height: 24,
                      background: 'rgba(153,69,255,0.2)',
                    }} />
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        display: 'block',
                        fontSize: 9,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: '#6b6b80',
                        fontFamily: "'Space Mono', monospace",
                        marginBottom: 2,
                      }}>Pot</span>
                      <span style={{
                        fontSize: 14,
                        fontWeight: 800,
                        fontFamily: "'Space Mono', monospace",
                        background: 'linear-gradient(135deg, #00ffa3, #9945ff)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}>{matchInfo.pot}</span>
                    </div>
                  </div>
                </div>

                {/* Multiplayer Status */}
                {isMultiplayer && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: 14,
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    marginBottom: 12,
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 10,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {socket?.connected ? (
                          <div style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: '#00ffa3',
                            boxShadow: '0 0 8px rgba(0,255,163,0.5)',
                          }} />
                        ) : (
                          <div style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: '#ef4444',
                            boxShadow: '0 0 8px rgba(239,68,68,0.5)',
                          }} />
                        )}
                        <span style={{
                          fontSize: 12,
                          fontWeight: 600,
                          fontFamily: "'Space Mono', monospace",
                          color: socket?.connected ? '#00ffa3' : '#ef4444',
                        }}>
                          {socket?.connected ? 'Connected' : 'Connecting...'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Users style={{
                          width: 14,
                          height: 14,
                          color: opponentConnected ? '#00ffa3' : '#f59e0b',
                        }} />
                        <span style={{
                          fontSize: 12,
                          fontWeight: 600,
                          fontFamily: "'Space Mono', monospace",
                          color: opponentConnected ? '#00ffa3' : '#f59e0b',
                        }}>
                          {opponentConnected ? 'Opponent ready' : opponentDisconnectCountdown !== null ? `Opponent disconnected (${Math.floor(opponentDisconnectCountdown / 60)}:${String(opponentDisconnectCountdown % 60).padStart(2, '0')})` : 'Waiting for opponent...'}
                        </span>
                      </div>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      <div style={{
                        width: 12,
                        height: 12,
                        borderRadius: 4,
                        background: playerColor === 'w'
                          ? 'linear-gradient(135deg, #e8e8f0, #c8c8d4)'
                          : 'linear-gradient(135deg, #2a2a40, #1a1a2e)',
                        border: '1px solid rgba(255,255,255,0.15)',
                      }} />
                      <span style={{
                        fontSize: 11,
                        fontWeight: 500,
                        fontFamily: "'Outfit', sans-serif",
                        color: '#6b6b80',
                      }}>
                        Playing as <span style={{ color: '#e8e8f0', fontWeight: 700 }}>{playerColor === 'w' ? 'White' : 'Black'}</span>
                      </span>
                    </div>
                  </div>
                )}

                {/* Lobby Code & Spectate Link */}
                {currentMatchPubkey && (
                  <div style={{
                    padding: '14px 16px',
                    borderRadius: 14,
                    background: 'rgba(153,69,255,0.04)',
                    border: '1px solid rgba(153,69,255,0.12)',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 10,
                    }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: '#6b6b80',
                        fontFamily: "'Space Mono', monospace",
                      }}>
                        Lobby Code
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 18,
                          fontWeight: 800,
                          fontFamily: "'Space Mono', monospace",
                          letterSpacing: '0.15em',
                          background: 'linear-gradient(135deg, #00ffa3, #9945ff)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                        }}>
                          {currentMatchPubkey.toBase58().slice(0, 4).toUpperCase()}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(currentMatchPubkey.toBase58().slice(0, 4).toUpperCase());
                          }}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 8,
                            background: 'rgba(153,69,255,0.1)',
                            border: '1px solid rgba(153,69,255,0.2)',
                            color: '#9945ff',
                            fontSize: 11,
                            fontWeight: 600,
                            fontFamily: "'Space Mono', monospace",
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <p style={{
                      fontSize: 11,
                      color: '#6b6b80',
                      fontFamily: "'Outfit', sans-serif",
                      marginBottom: 12,
                    }}>
                      Share this code with your opponent to join
                    </p>
                    {/* Only show cancel button before game starts (no moves made) */}
                    {!opponentConnected && (chessRef.current?.history()?.length || 0) === 0 && (
                    <button
                      onClick={handleCancelMatch}
                      disabled={isCancellingMatch}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        borderRadius: 12,
                        background: 'rgba(239,68,68,0.06)',
                        border: '1px solid rgba(239,68,68,0.15)',
                        color: '#ef4444',
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: "'Outfit', sans-serif",
                        cursor: isCancellingMatch ? 'not-allowed' : 'pointer',
                        opacity: isCancellingMatch ? 0.5 : 1,
                        transition: 'all 0.2s',
                      }}
                    >
                      {isCancellingMatch ? 'Cancelling...' : 'Cancel Match & Refund SOL'}
                    </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="w-full space-y-3 sm:space-y-4">
            <div className="chess-board-wrap rounded-lg sm:rounded-2xl p-0 sm:p-3" style={{ background: 'rgba(14,14,30,0.7)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
              {/* Opponent disconnect countdown banner */}
              {opponentDisconnectCountdown !== null && !opponentConnected && (
                <div style={{
                  background: 'linear-gradient(90deg, rgba(239,68,68,0.15), rgba(234,179,8,0.1))',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 8,
                  padding: '10px 16px',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                }}>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#ef4444',
                    animation: 'pulse 1.5s infinite',
                  }} />
                  <span style={{
                    color: '#fbbf24',
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: "'Outfit', sans-serif",
                  }}>
                    Opponent disconnected — reconnect window: {Math.floor(opponentDisconnectCountdown / 60)}:{String(opponentDisconnectCountdown % 60).padStart(2, '0')}
                  </span>
                </div>
              )}
              {/* Opponent info bar for multiplayer/free play (shown at top) */}
              {(isFreePlay || isMultiplayer) && opponentConnected && (() => {
                const opponentColor = playerColor === 'w' ? 'b' : 'w';
                const isOpponentTurn = (playerColor === 'w' && chessRef.current?.turn() === 'b') || (playerColor === 'b' && chessRef.current?.turn() === 'w');
                const opponentName = opponentUsername || (opponentWallet ? `${opponentWallet.slice(0, 4)}...${opponentWallet.slice(-4)}` : 'Opponent');
                // Opponent's captured pieces (pieces opponent took from player)
                const oppCapturedTypes = opponentColor === 'w' ? capturedPieces.wTypes : capturedPieces.bTypes;
                const oppCapturedValue = oppCapturedTypes.reduce((s, p) => s + ({ p: 1, n: 3, b: 3, r: 5, q: 9, P: 1, N: 3, B: 3, R: 5, Q: 9 }[p] || 0), 0);
                const playerCapturedValue = (opponentColor === 'w' ? capturedPieces.bTypes : capturedPieces.wTypes).reduce((s, p) => s + ({ p: 1, n: 3, b: 3, r: 5, q: 9, P: 1, N: 3, B: 3, R: 5, Q: 9 }[p] || 0), 0);
                const oppAdvantage = Math.max(0, oppCapturedValue - playerCapturedValue);
                // Group pieces for display
                const sorted = [...oppCapturedTypes].sort((a, b) => (PIECE_SORT_ORDER[a] ?? 5) - (PIECE_SORT_ORDER[b] ?? 5));
                const groups: { piece: string; count: number }[] = [];
                sorted.forEach(p => { const last = groups[groups.length - 1]; if (last && last.piece === p) last.count++; else groups.push({ piece: p, count: 1 }); });
                const pieceColor = opponentColor === 'b' ? '#b388ff' : '#e8e8f0';
                return (
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: 0,
                    padding: '12px 20px',
                    background: isOpponentTurn ? 'rgba(0,255,163,0.06)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isOpponentTurn ? 'rgba(0,255,163,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 14, transition: 'all 0.3s', marginBottom: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: isOpponentTurn ? '#00ffa3' : '#333', boxShadow: isOpponentTurn ? '0 0 12px rgba(0,255,163,0.5)' : 'none', transition: 'all 0.3s' }} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: isOpponentTurn ? '#e8e8f0' : '#6b6b80', fontFamily: "'Outfit', sans-serif", maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opponentName}</span>
                        <div style={{ width: 14, height: 14, borderRadius: 4, background: opponentColor === 'w' ? '#e8e8f0' : '#1a1a2e', border: '1px solid rgba(255,255,255,0.15)' }} />
                        {/* Opponent W-L record */}
                        {opponentStats && (
                          <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "'Space Mono', monospace", color: '#6b6b80', padding: '2px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            {opponentStats.gamesWon}W-{opponentStats.gamesLost}L
                          </span>
                        )}
                        {/* Spectator count */}
                        {isFreePlay && spectatorCount > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(153,69,255,0.15)', padding: '2px 8px', borderRadius: 99, border: '1px solid rgba(153,69,255,0.2)' }}>
                            <Eye className="h-3.5 w-3.5" style={{ color: '#9945ff' }} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#9945ff', fontFamily: "'Space Mono', monospace" }}>{spectatorCount}</span>
                          </div>
                        )}
                        {/* Opponent's reaction bubble */}
                        <AnimatePresence>
                          {incomingReaction && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.5, x: -10 }}
                              animate={{ opacity: 1, scale: 1, x: 0 }}
                              exit={{ opacity: 0, scale: 0.5, x: -10 }}
                            >
                              <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 99, padding: '2px 8px', border: '1px solid rgba(255,255,255,0.2)' }}>
                                <span style={{ fontSize: 18 }}>{incomingReaction}</span>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: isOpponentTurn ? '#00ffa3' : '#6b6b80', letterSpacing: '0.05em', transition: 'color 0.3s' }}>
                        {formatTime(playerColor === 'w' ? blackTimeMs : whiteTimeMs)}
                      </span>
                    </div>
                    {oppCapturedTypes.length > 0 && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', minHeight: 24 }}>
                        {groups.map((g, i) => (
                          <div key={`${g.piece}-${i}`} style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                            {Array.from({ length: g.count }).map((_, j) => (
                              <span key={j} style={{ fontSize: 18, lineHeight: 1, color: pieceColor, filter: opponentColor === 'b' ? 'drop-shadow(0 1px 4px rgba(153,69,255,0.4))' : 'drop-shadow(0 1px 4px rgba(255,255,255,0.2))', marginLeft: j > 0 ? -6 : 0, position: 'relative', zIndex: g.count - j, opacity: 0.9, userSelect: 'none' }}>
                                {PIECE_SYMBOLS[g.piece]}
                              </span>
                            ))}
                          </div>
                        ))}
                        {oppAdvantage > 0 && (
                          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: '#00ffa3', marginLeft: 6, padding: '2px 6px', borderRadius: 6, background: 'rgba(0,255,163,0.1)', border: '1px solid rgba(0,255,163,0.15)' }}>+{oppAdvantage}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
              
              {/* AI timer bar for practice mode (shown above board) */}
              {mode === 'practice' && !isFreePlay && (() => {
                const aiColor = aiPlayerColor === 'w' ? 'b' : 'w';
                const isAiTurn = chessRef.current?.turn() === (aiPlayerColor === 'w' ? 'b' : 'w') && aiGameStarted;
                const aiName = '🤖 ' + (aiDifficulty === 'novice' ? 'Novice Bot' : aiDifficulty === 'club' ? 'Club Bot' : 'Master Bot');
                // AI's captured pieces (pieces AI took from player)
                const aiCapturedTypes = aiColor === 'w' ? capturedPieces.wTypes : capturedPieces.bTypes;
                const aiCapturedValue = aiCapturedTypes.reduce((s, p) => s + ({ p: 1, n: 3, b: 3, r: 5, q: 9, P: 1, N: 3, B: 3, R: 5, Q: 9 }[p] || 0), 0);
                const playerCapturedValue = (aiColor === 'w' ? capturedPieces.bTypes : capturedPieces.wTypes).reduce((s, p) => s + ({ p: 1, n: 3, b: 3, r: 5, q: 9, P: 1, N: 3, B: 3, R: 5, Q: 9 }[p] || 0), 0);
                const aiAdvantage = Math.max(0, aiCapturedValue - playerCapturedValue);
                // Group pieces for display
                const sorted = [...aiCapturedTypes].sort((a, b) => (PIECE_SORT_ORDER[a] ?? 5) - (PIECE_SORT_ORDER[b] ?? 5));
                const groups: { piece: string; count: number }[] = [];
                sorted.forEach(p => { const last = groups[groups.length - 1]; if (last && last.piece === p) last.count++; else groups.push({ piece: p, count: 1 }); });
                const pieceColor = aiColor === 'b' ? '#b388ff' : '#e8e8f0';
                return (
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: 0,
                    padding: '12px 20px',
                    background: isAiTurn ? 'rgba(0,255,163,0.06)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isAiTurn ? 'rgba(0,255,163,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 14, transition: 'all 0.3s', marginBottom: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: isAiTurn ? '#00ffa3' : '#333', boxShadow: isAiTurn ? '0 0 12px rgba(0,255,163,0.5)' : 'none' }} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: isAiTurn ? '#e8e8f0' : '#6b6b80', fontFamily: "'Outfit', sans-serif" }}>{aiName}</span>
                        <div style={{ width: 14, height: 14, borderRadius: 4, background: aiColor === 'w' ? '#e8e8f0' : '#1a1a2e', border: '1px solid rgba(255,255,255,0.15)' }} />
                      </div>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: isAiTurn ? '#00ffa3' : '#6b6b80', letterSpacing: '0.05em' }}>
                        {formatTime(aiPlayerColor === 'w' ? blackTimeMs : whiteTimeMs)}
                      </span>
                    </div>
                    {aiCapturedTypes.length > 0 && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', minHeight: 24 }}>
                        {groups.map((g, i) => (
                          <div key={`${g.piece}-${i}`} style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                            {Array.from({ length: g.count }).map((_, j) => (
                              <span key={j} style={{ fontSize: 18, lineHeight: 1, color: pieceColor, filter: aiColor === 'b' ? 'drop-shadow(0 1px 4px rgba(153,69,255,0.4))' : 'drop-shadow(0 1px 4px rgba(255,255,255,0.2))', marginLeft: j > 0 ? -6 : 0, position: 'relative', zIndex: g.count - j, opacity: 0.9, userSelect: 'none' }}>
                                {PIECE_SYMBOLS[g.piece]}
                              </span>
                            ))}
                          </div>
                        ))}
                        {aiAdvantage > 0 && (
                          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: '#00ffa3', marginLeft: 6, padding: '2px 6px', borderRadius: 6, background: 'rgba(0,255,163,0.1)', border: '1px solid rgba(0,255,163,0.15)' }}>+{aiAdvantage}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
              
              {/* Chess Board with Coordinates */}
              <div className="relative" style={{ marginBottom: 8 }}>
              <div className="chess-board-inner aspect-square w-full rounded-xl sm:rounded-2xl" style={{ border: '2px solid rgba(255,255,255,0.15)', boxShadow: '0 0 40px rgba(153,69,255,0.08)', overflow: 'hidden' }}>
                <div className="grid h-full w-full grid-cols-8 grid-rows-8">
              {Array.from({ length: 64 }).map((_, i) => {
                // Flip board for black player - their pieces should be at bottom
                // For AI practice mode, use aiPlayerColor; for multiplayer use playerColor
                const effectivePlayerColor = (mode === 'practice' && !isFreePlay) ? aiPlayerColor : playerColor;
                const flipped = effectivePlayerColor === 'b';
                const row = flipped ? 7 - Math.floor(i / 8) : Math.floor(i / 8);
                const col = flipped ? 7 - (i % 8) : i % 8;
                const visualRow = Math.floor(i / 8); // For light/dark square coloring
                const visualCol = i % 8;
                const isLight = (visualRow + visualCol) % 2 === 0;
                const square = squareFromRowCol(row, col);
                const piece = board[row]?.[col] ?? null;
                const svgPath = pieceToSvg(piece as any);

                const isSelected = selectedSquare === square;
                const isLegal = legalDestinations.has(square);
                const isLastMove = lastMove !== null && (lastMove.from === square || lastMove.to === square);
                const isKingInCheck = kingInCheck === square;
                
                // Coordinate labels
                const showRank = visualCol === 0; // Left edge - show rank numbers
                const showFile = visualRow === 7; // Bottom edge - show file letters
                const rank = flipped ? visualRow + 1 : 8 - visualRow;
                const file = flipped ? FILES[7 - visualCol] : FILES[visualCol];

                // Determine background color with priority: check > selected > lastMove > default
                let bgStyle: React.CSSProperties = {
                  backgroundColor: isLight ? '#e8e0f0' : '#12122a',
                  borderRadius: '2px',
                };
                
                if (isLastMove && !isSelected && !isKingInCheck) {
                  bgStyle.backgroundColor = isLight ? 'rgba(153,69,255,0.22)' : 'rgba(153,69,255,0.28)';
                }
                if (isSelected) {
                  bgStyle.backgroundColor = 'rgba(0,255,163,0.25)';
                  bgStyle.boxShadow = 'inset 0 0 0 3px rgba(0,255,163,0.5)';
                }
                if (isKingInCheck) {
                  bgStyle.backgroundColor = 'rgba(239,68,68,0.4)';
                  bgStyle.boxShadow = 'inset 0 0 0 3px rgba(239,68,68,0.7)';
                }

                return (
                  <motion.button
                    type="button"
                    key={i}
                    onClick={() => onSquareClick(square)}
                    whileHover={piece ? { scale: 1.05 } : {}}
                    whileTap={{ scale: 0.95 }}
                    className="relative flex items-center justify-center select-none transition-all"
                    style={bgStyle}
                    aria-label={square}
                  >
                    {/* Piece image */}
                    {piece && svgPath && (
                      <motion.div
                        initial={false}
                        animate={{ scale: isSelected ? 1.1 : 1 }}
                        className="relative w-[92%] h-[92%] sm:w-[82%] sm:h-[82%]"
                        style={{ zIndex: 1 }}
                      >
                        <img
                          src={svgPath}
                          alt=""
                          className="w-full h-full object-contain pointer-events-none"
                          style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }}
                          draggable={false}
                        />
                      </motion.div>
                    )}
                    {/* Legal move dot (empty square) */}
                    {isLegal && !piece && (
                      <div 
                        style={{
                          position: 'absolute',
                          width: '30%',
                          height: '30%',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(0,255,163,0.3)',
                          zIndex: 10,
                          pointerEvents: 'none',
                        }}
                      />
                    )}
                    {/* Legal capture indicator (square with piece) */}
                    {isLegal && piece && (
                      <div 
                        style={{
                          position: 'absolute',
                          inset: '4px',
                          borderRadius: '50%',
                          border: '4px solid rgba(0,255,163,0.35)',
                          zIndex: 10,
                          pointerEvents: 'none',
                        }}
                      />
                    )}
                    {/* Rank numbers on left edge - top left corner */}
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
                          fontFamily: "'Space Mono', monospace",
                          color: isLight ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)',
                          zIndex: 5,
                        }}
                      >
                        {rank}
                      </span>
                    )}
                    {/* File letters on bottom edge - bottom right corner */}
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
                          fontFamily: "'Space Mono', monospace",
                          color: isLight ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)',
                          zIndex: 5,
                        }}
                      >
                        {file}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Pawn Promotion Picker */}
          <AnimatePresence>
            {pendingPromotion && (() => {
              const chess = chessRef.current!;
              const piece = chess.get(pendingPromotion.from as any) as any;
              const color = piece?.color || 'w';
              const effectivePlayerColor = (mode === 'practice' && !isFreePlay) ? aiPlayerColor : playerColor;
              const flipped = effectivePlayerColor === 'b';
              const toCol = pendingPromotion.to.charCodeAt(0) - 97; // a=0, h=7
              const displayCol = flipped ? 7 - toCol : toCol;
              const isWhitePromotion = color === 'w';
              const fromTop = (flipped ? isWhitePromotion : !isWhitePromotion);
              const pieces = ['q', 'r', 'b', 'n'] as const;

              return (
                <motion.div
                  key="promotion-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => { setPendingPromotion(null); setSelectedSquare(null); }}
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
                      left: `${displayCol * 12.5}%`,
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
                        whileHover={{ scale: 1.1, backgroundColor: 'rgba(153,69,255,0.4)' }}
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
          </AnimatePresence>

          </div> {/* End of board with coordinates wrapper */}
          
              {/* Free Play Lobby Overlay - shown when opponent joined but game hasn't started */}
              {isFreePlay && inLobby && !opponentConnected && (
                <div style={{
                  marginTop: 12,
                  background: 'linear-gradient(135deg, rgba(153,69,255,0.08), rgba(0,255,163,0.06))',
                  border: '1px solid rgba(153,69,255,0.2)',
                  borderRadius: 16,
                  padding: '24px 28px',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  {/* Top accent line */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                    background: 'linear-gradient(90deg, transparent, #9945ff, #00ffa3, transparent)',
                  }} />
                  
                  <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>⚔️</div>
                    <h3 style={{
                      fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em',
                      color: '#e8e8f0', fontFamily: "'Outfit', sans-serif", margin: '0 0 4px',
                    }}>
                      {dynamicPlayerRole === 'host' ? 'Opponent Joined!' : 'Joined Game!'}
                    </h3>
                    <p style={{ fontSize: 13, color: '#6b6b80', margin: 0, fontFamily: "'Outfit', sans-serif" }}>
                      {dynamicPlayerRole === 'host' ? 'Choose colors and start when ready' : 'Waiting for host to start the game'}
                    </p>
                  </div>

                  {/* Color Assignment */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
                    marginBottom: 20, padding: '16px 20px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 12,
                  }}>
                    {/* White side */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: '#e8e8f0', border: '2px solid rgba(255,255,255,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 16px rgba(255,255,255,0.1)',
                      }}>
                        <img src="/pieces/wK.svg" alt="White King" style={{ width: 32, height: 32 }} draggable={false} />
                      </div>
                      <span style={{
                        fontSize: 12, fontWeight: 700, fontFamily: "'Space Mono', monospace",
                        color: lobbyHostColor === 'w'
                          ? (dynamicPlayerRole === 'host' ? '#00ffa3' : '#a0a0b8')
                          : (dynamicPlayerRole === 'host' ? '#a0a0b8' : '#00ffa3'),
                      }}>
                        {lobbyHostColor === 'w'
                          ? (dynamicPlayerRole === 'host' ? 'You' : lobbyOpponentName || 'Host')
                          : (dynamicPlayerRole === 'host' ? lobbyOpponentName || 'Guest' : 'You')}
                      </span>
                    </div>

                    {/* VS */}
                    <div style={{
                      fontSize: 14, fontWeight: 800, color: '#9945ff',
                      fontFamily: "'Space Mono', monospace",
                    }}>VS</div>

                    {/* Black side */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: '#1a1a2e', border: '2px solid rgba(255,255,255,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                      }}>
                        <img src="/pieces/bK.svg" alt="Black King" style={{ width: 32, height: 32 }} draggable={false} />
                      </div>
                      <span style={{
                        fontSize: 12, fontWeight: 700, fontFamily: "'Space Mono', monospace",
                        color: lobbyHostColor === 'b'
                          ? (dynamicPlayerRole === 'host' ? '#00ffa3' : '#a0a0b8')
                          : (dynamicPlayerRole === 'host' ? '#a0a0b8' : '#00ffa3'),
                      }}>
                        {lobbyHostColor === 'b'
                          ? (dynamicPlayerRole === 'host' ? 'You' : lobbyOpponentName || 'Host')
                          : (dynamicPlayerRole === 'host' ? lobbyOpponentName || 'Guest' : 'You')}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    {/* Flip Board button - host only */}
                    {dynamicPlayerRole === 'host' && (
                      <button
                        onClick={handleFlipFreePlayColors}
                        style={{
                          flex: 1, padding: '12px 20px', borderRadius: 12,
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: '#a0a0b8', fontSize: 14, fontWeight: 600,
                          cursor: 'pointer', transition: 'all 0.2s',
                          fontFamily: "'Outfit', sans-serif",
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#e8e8f0'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#a0a0b8'; }}
                      >
                        ⟳ Flip Colors
                      </button>
                    )}

                    {/* Start Game button - host only */}
                    {dynamicPlayerRole === 'host' ? (
                      <button
                        onClick={handleStartFreePlayGame}
                        style={{
                          flex: 2, padding: '14px 28px', borderRadius: 12,
                          background: 'linear-gradient(135deg, #00ffa3 0%, #00d4ff 50%, #9945ff 100%)',
                          border: 'none', color: '#07070e', fontSize: 15, fontWeight: 700,
                          cursor: 'pointer', transition: 'all 0.3s',
                          fontFamily: "'Outfit', sans-serif",
                          boxShadow: '0 4px 20px rgba(0,255,163,0.3)',
                        }}
                      >
                        Start Game →
                      </button>
                    ) : (
                      <div style={{
                        flex: 1, padding: '14px 28px', borderRadius: 12,
                        background: 'rgba(153,69,255,0.08)',
                        border: '1px solid rgba(153,69,255,0.2)',
                        color: '#9945ff', fontSize: 14, fontWeight: 600,
                        fontFamily: "'Outfit', sans-serif",
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      }}>
                        <div style={{
                          width: 16, height: 16,
                          border: '2px solid rgba(153,69,255,0.3)', borderTopColor: '#9945ff',
                          borderRadius: '50%', animation: 'freeplay-lobby-spin 0.8s linear infinite',
                        }} />
                        <style>{`@keyframes freeplay-lobby-spin { to { transform: rotate(360deg); } }`}</style>
                        Waiting for host...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Joiner Staking Overlay - shown when joiner arrives via share link but hasn't staked yet */}
              {isMultiplayer && actualPlayerRole === 'join' && mode === 'wager' && !hasJoinerStaked && (
                <div style={{
                  marginTop: 12,
                  background: 'linear-gradient(135deg, rgba(153,69,255,0.10), rgba(0,255,163,0.06))',
                  border: '1px solid rgba(153,69,255,0.25)',
                  borderRadius: 16,
                  padding: '28px 28px',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  {/* Top accent line */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                    background: 'linear-gradient(90deg, transparent, #9945ff, #00ffa3, transparent)',
                  }} />

                  <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>⚔️</div>
                    <h3 style={{
                      fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em',
                      color: '#e8e8f0', fontFamily: "'Outfit', sans-serif", margin: '0 0 6px',
                    }}>
                      Stake to Join Match
                    </h3>
                    <p style={{ fontSize: 13, color: '#6b6b80', margin: 0, fontFamily: "'Outfit', sans-serif" }}>
                      You must stake SOL on-chain to enter this wager match
                    </p>
                  </div>

                  {/* Match Details */}
                  <div style={{
                    display: 'flex', justifyContent: 'center', gap: 16,
                    marginBottom: 20, padding: '14px 20px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 12,
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                        letterSpacing: '0.1em', color: '#6b6b80', marginBottom: 4,
                        fontFamily: "'Space Mono', monospace",
                      }}>Stake Required</div>
                      <div style={{
                        fontSize: 18, fontWeight: 800, color: '#e8e8f0',
                        fontFamily: "'Space Mono', monospace",
                      }}>{getStakeTierInfo(selectedStakeTier).label}</div>
                    </div>
                    <div style={{ width: 1, background: 'rgba(153,69,255,0.2)' }} />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                        letterSpacing: '0.1em', color: '#6b6b80', marginBottom: 4,
                        fontFamily: "'Space Mono', monospace",
                      }}>Winner Pot</div>
                      <div style={{
                        fontSize: 18, fontWeight: 800,
                        fontFamily: "'Space Mono', monospace",
                        background: 'linear-gradient(135deg, #00ffa3, #9945ff)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}>{(getStakeTierInfo(selectedStakeTier).stake * 2 * 0.9).toFixed(2)} SOL</div>
                    </div>
                  </div>

                  {/* Error Message */}
                  {joinerStakeError && (
                    <div style={{
                      marginBottom: 14, padding: '12px 16px', borderRadius: 12,
                      fontSize: 13, color: '#ff5050',
                      background: 'rgba(255,80,80,0.06)',
                      border: '1px solid rgba(255,80,80,0.15)',
                      fontFamily: "'Space Mono', monospace",
                      textAlign: 'center',
                    }}>
                      {joinerStakeError}
                    </div>
                  )}

                  {/* Wallet Not Connected Warning */}
                  {!connected && (
                    <div style={{
                      marginBottom: 14, padding: '12px 16px', borderRadius: 12,
                      fontSize: 13, color: '#ffb432',
                      background: 'rgba(255,180,50,0.06)',
                      border: '1px solid rgba(255,180,50,0.15)',
                      fontFamily: "'Space Mono', monospace",
                      textAlign: 'center',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}>
                      <span style={{ fontSize: 16 }}>⚠️</span>
                      Connect your wallet to stake and join
                    </div>
                  )}

                  {/* Stake Button */}
                  <button
                    onClick={handleJoinOnChain}
                    disabled={!connected || isJoiningMatch}
                    style={{
                      width: '100%', padding: '16px 32px', borderRadius: 14,
                      background: connected && !isJoiningMatch
                        ? 'linear-gradient(135deg, #00ffa3 0%, #00d4ff 50%, #9945ff 100%)'
                        : 'rgba(255,255,255,0.04)',
                      color: connected && !isJoiningMatch ? '#07070e' : '#444',
                      fontSize: 16, fontWeight: 700, border: 'none',
                      fontFamily: "'Outfit', sans-serif",
                      cursor: connected && !isJoiningMatch ? 'pointer' : 'not-allowed',
                      boxShadow: connected && !isJoiningMatch ? '0 6px 30px rgba(0,255,163,0.2)' : 'none',
                      transition: 'all 0.25s',
                      opacity: isJoiningMatch ? 0.6 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  >
                    {isJoiningMatch ? (
                      <>
                        <div style={{
                          width: 16, height: 16,
                          border: '2px solid #07070e', borderTopColor: 'transparent',
                          borderRadius: '50%', animation: 'joiner-stake-spin 0.8s linear infinite',
                          display: 'inline-block',
                        }} />
                        <style>{`@keyframes joiner-stake-spin { to { transform: rotate(360deg); } }`}</style>
                        Staking...
                      </>
                    ) : connected ? (
                      <>
                        <Coins style={{ width: 18, height: 18 }} />
                        Stake {getStakeTierInfo(selectedStakeTier).label} &amp; Join Match
                      </>
                    ) : (
                      'Connect Wallet to Join'
                    )}
                  </button>
                </div>
              )}

              {/* Wager Match Lobby Overlay - shown when opponent joined but game hasn't started */}
              {isMultiplayer && inWagerLobby && !opponentConnected && (
                <div style={{
                  marginTop: 12,
                  background: 'linear-gradient(135deg, rgba(153,69,255,0.08), rgba(0,255,163,0.06))',
                  border: '1px solid rgba(153,69,255,0.2)',
                  borderRadius: 16,
                  padding: '24px 28px',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  {/* Top accent line */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                    background: 'linear-gradient(90deg, transparent, #9945ff, #00ffa3, transparent)',
                  }} />
                  
                  <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>⚔️</div>
                    <h3 style={{
                      fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em',
                      color: '#e8e8f0', fontFamily: "'Outfit', sans-serif", margin: '0 0 4px',
                    }}>
                      {dynamicPlayerRole === 'host' ? 'Opponent Joined!' : 'Joined Match!'}
                    </h3>
                    <p style={{ fontSize: 13, color: '#6b6b80', margin: 0, fontFamily: "'Outfit', sans-serif" }}>
                      {dynamicPlayerRole === 'host' ? 'Choose colors and start when ready' : 'Waiting for host to start the game'}
                    </p>
                  </div>

                  {/* Color Assignment */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
                    marginBottom: 20, padding: '16px 20px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 12,
                  }}>
                    {/* White side */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: '#e8e8f0', border: '2px solid rgba(255,255,255,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 16px rgba(255,255,255,0.1)',
                      }}>
                        <img src="/pieces/wK.svg" alt="White King" style={{ width: 32, height: 32 }} draggable={false} />
                      </div>
                      <span style={{
                        fontSize: 12, fontWeight: 700, fontFamily: "'Space Mono', monospace",
                        color: wagerLobbyHostColor === 'w'
                          ? (dynamicPlayerRole === 'host' ? '#00ffa3' : '#a0a0b8')
                          : (dynamicPlayerRole === 'host' ? '#a0a0b8' : '#00ffa3'),
                      }}>
                        {wagerLobbyHostColor === 'w'
                          ? (dynamicPlayerRole === 'host' ? 'You' : lobbyOpponentName || 'Host')
                          : (dynamicPlayerRole === 'host' ? lobbyOpponentName || 'Guest' : 'You')}
                      </span>
                    </div>

                    {/* VS */}
                    <div style={{
                      fontSize: 14, fontWeight: 800, color: '#9945ff',
                      fontFamily: "'Space Mono', monospace",
                    }}>VS</div>

                    {/* Black side */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: '#1a1a2e', border: '2px solid rgba(255,255,255,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                      }}>
                        <img src="/pieces/bK.svg" alt="Black King" style={{ width: 32, height: 32 }} draggable={false} />
                      </div>
                      <span style={{
                        fontSize: 12, fontWeight: 700, fontFamily: "'Space Mono', monospace",
                        color: wagerLobbyHostColor === 'b'
                          ? (dynamicPlayerRole === 'host' ? '#00ffa3' : '#a0a0b8')
                          : (dynamicPlayerRole === 'host' ? '#a0a0b8' : '#00ffa3'),
                      }}>
                        {wagerLobbyHostColor === 'b'
                          ? (dynamicPlayerRole === 'host' ? 'You' : lobbyOpponentName || 'Host')
                          : (dynamicPlayerRole === 'host' ? lobbyOpponentName || 'Guest' : 'You')}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    {/* Flip Colors button - host only */}
                    {dynamicPlayerRole === 'host' && (
                      <button
                        onClick={handleFlipWagerColors}
                        style={{
                          flex: 1, padding: '12px 20px', borderRadius: 12,
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: '#a0a0b8', fontSize: 14, fontWeight: 600,
                          cursor: 'pointer', transition: 'all 0.2s',
                          fontFamily: "'Outfit', sans-serif",
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#e8e8f0'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#a0a0b8'; }}
                      >
                        ⟳ Flip Colors
                      </button>
                    )}

                    {/* Start Game button - host only */}
                    {dynamicPlayerRole === 'host' ? (
                      <button
                        onClick={handleStartWagerGame}
                        style={{
                          flex: 2, padding: '14px 28px', borderRadius: 12,
                          background: 'linear-gradient(135deg, #00ffa3 0%, #00d4ff 50%, #9945ff 100%)',
                          border: 'none', color: '#07070e', fontSize: 15, fontWeight: 700,
                          cursor: 'pointer', transition: 'all 0.3s',
                          fontFamily: "'Outfit', sans-serif",
                          boxShadow: '0 4px 20px rgba(0,255,163,0.3)',
                        }}
                      >
                        Start Game →
                      </button>
                    ) : (
                      <div style={{
                        flex: 1, padding: '14px 28px', borderRadius: 12,
                        background: 'rgba(153,69,255,0.08)',
                        border: '1px solid rgba(153,69,255,0.2)',
                        color: '#9945ff', fontSize: 14, fontWeight: 600,
                        fontFamily: "'Outfit', sans-serif",
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      }}>
                        <div style={{
                          width: 16, height: 16,
                          border: '2px solid rgba(153,69,255,0.3)', borderTopColor: '#9945ff',
                          borderRadius: '50%', animation: 'wager-lobby-spin 0.8s linear infinite',
                        }} />
                        <style>{`@keyframes wager-lobby-spin { to { transform: rotate(360deg); } }`}</style>
                        Waiting for host...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Emoji Picker & Chat Buttons - Only for multiplayer modes with real opponents */}
              {((isFreePlay || isMultiplayer) && opponentConnected) ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  {/* React Button - Premium Themed */}
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowChat(false); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', borderRadius: 12,
                        background: showEmojiPicker ? 'rgba(153,69,255,0.15)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${showEmojiPicker ? 'rgba(153,69,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
                        color: showEmojiPicker ? '#e8e8f0' : '#a0a0b8',
                        fontSize: 13, fontWeight: 600,
                        fontFamily: "'Outfit', sans-serif",
                        cursor: 'pointer', transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(153,69,255,0.12)'; e.currentTarget.style.color = '#e8e8f0'; e.currentTarget.style.borderColor = 'rgba(153,69,255,0.25)'; }}
                      onMouseLeave={(e) => { if (!showEmojiPicker) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#a0a0b8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; } }}
                    >
                      <span style={{ fontSize: 16 }}>😊</span>
                      <span>React</span>
                    </button>
                    
                    <AnimatePresence>
                      {showEmojiPicker && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: 10 }}
                          transition={{ duration: 0.15 }}
                          style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 8, zIndex: 40 }}
                        >
                          <div style={{
                            display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 220,
                            padding: 12, borderRadius: 16,
                            background: 'rgba(14,14,30,0.95)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            backdropFilter: 'blur(20px)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(153,69,255,0.08)',
                          }}>
                            {REACTION_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => sendReaction(emoji)}
                                style={{
                                  fontSize: 22, padding: 8, borderRadius: 10,
                                  background: 'transparent', border: 'none',
                                  cursor: 'pointer', transition: 'all 0.15s',
                                  touchAction: 'manipulation',
                                  WebkitTapHighlightColor: 'rgba(153, 69, 255, 0.3)',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'scale(1.2)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'scale(1)'; }}
                                aria-label={`React with ${emoji}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  {/* Chat Button - Premium Themed */}
                  <button
                    onClick={() => { setShowChat(!showChat); setShowEmojiPicker(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 14px', borderRadius: 12,
                      background: showChat ? 'rgba(153,69,255,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${showChat ? 'rgba(153,69,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      color: showChat ? '#e8e8f0' : '#a0a0b8',
                      fontSize: 13, fontWeight: 600,
                      fontFamily: "'Outfit', sans-serif",
                      cursor: 'pointer', transition: 'all 0.2s',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(153,69,255,0.12)'; e.currentTarget.style.color = '#e8e8f0'; e.currentTarget.style.borderColor = 'rgba(153,69,255,0.25)'; }}
                    onMouseLeave={(e) => { if (!showChat) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#a0a0b8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; } }}
                  >
                    <MessageCircle style={{ width: 16, height: 16 }} />
                    <span>Chat</span>
                    {unreadCount > 0 && !showChat && (
                      <motion.span 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        style={{
                          position: 'absolute', top: -4, right: -4,
                          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                          color: '#fff', fontSize: 10, fontWeight: 700,
                          borderRadius: 99, width: 18, height: 18,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: '0 2px 8px rgba(239,68,68,0.4), 0 0 0 2px rgba(239,68,68,0.2)',
                          fontFamily: "'Space Mono', monospace",
                        }}
                      >
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </motion.span>
                    )}
                  </button>
                </div>
              ) : null}
              
              {/* Chat Popup - Premium Styled */}
              <AnimatePresence>
                {showChat && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="fixed z-[10000]"
                    style={{ 
                      bottom: '16px',
                      right: '16px',
                      width: 'calc(100vw - 32px)',
                      maxWidth: '380px'
                    }}
                  >
                    <div 
                      className="glass-card rounded-2xl border border-white/20 shadow-2xl overflow-hidden flex flex-col"
                      style={{ 
                        backgroundColor: 'rgba(23, 23, 23, 0.98)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        maxHeight: 'min(400px, calc(100vh - 120px))'
                      }}
                    >
                      {/* Chat Header - Premium */}
                      <div 
                        className="flex items-center justify-between px-4 py-3 border-b border-white/10"
                        style={{ 
                          backgroundColor: 'rgba(31, 31, 31, 0.8)',
                          backdropFilter: 'blur(10px)'
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <MessageCircle className="w-4 h-4 text-solana-purple" />
                          <span className="font-semibold text-sm text-white">Chat</span>
                        </div>
                        <button
                          onClick={() => setShowChat(false)}
                          className="btn-ghost p-1.5 rounded-xl text-neutral-400 hover:text-white transition-all hover:bg-white/10"
                          aria-label="Close chat"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* Chat Messages - Premium Styled */}
                      <div 
                        className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[150px] max-h-[250px] chat-container"
                        style={{ 
                          backgroundColor: 'rgba(23, 23, 23, 0.5)',
                          WebkitOverflowScrolling: 'touch'
                        }}
                      >
                        {chatMessages.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            <MessageCircle className="w-12 h-12 text-neutral-600 mb-3" />
                            <p className="text-neutral-500 text-sm">
                              No messages yet. Say hi! 👋
                            </p>
                          </div>
                        ) : (
                          chatMessages.map((msg, idx) => (
                            <motion.div
                              key={idx}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.2 }}
                              className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[75%] sm:max-w-[80%] px-4 py-2.5 rounded-2xl text-sm text-white shadow-lg ${
                                  msg.sender === 'me' 
                                    ? 'bg-gradient-to-r from-solana-purple to-solana-green rounded-br-sm' 
                                    : 'glass-card border border-white/10 rounded-bl-sm'
                                }`}
                                style={{
                                  backgroundColor: msg.sender === 'me' 
                                    ? 'linear-gradient(135deg, #9945FF 0%, #14F195 100%)' 
                                    : 'rgba(63, 63, 70, 0.6)',
                                  wordBreak: 'break-word'
                                }}
                              >
                                {msg.message}
                              </div>
                            </motion.div>
                          ))
                        )}
                        <div ref={chatEndRef} />
                      </div>
                      
                      {/* Chat Input - Premium Styled */}
                      <div 
                        className="p-3 border-t border-white/10"
                        style={{ 
                          backgroundColor: 'rgba(31, 31, 31, 0.9)',
                          backdropFilter: 'blur(10px)'
                        }}
                      >
                        <form
                          onSubmit={(e) => { 
                            e.preventDefault(); 
                            e.stopPropagation();
                            sendChat(); 
                          }}
                          className="flex gap-2"
                        >
                          <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Type a message..."
                            maxLength={200}
                            className="flex-1 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-solana-purple/50 transition-all"
                            style={{ 
                              backgroundColor: 'rgba(38, 38, 38, 0.8)', 
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              backdropFilter: 'blur(10px)'
                            }}
                            autoFocus
                          />
                          <button
                            type="submit"
                            disabled={!chatInput.trim()}
                            className="btn-glow disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2.5 transition-all min-w-[48px] min-h-[44px] flex items-center justify-center touch-manipulation"
                            style={{
                              touchAction: 'manipulation',
                              WebkitTapHighlightColor: 'rgba(153, 69, 255, 0.3)',
                              minHeight: '44px'
                            }}
                            aria-label="Send message"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </form>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Player info bar for multiplayer/free play (shown at bottom) */}
              {(isFreePlay || isMultiplayer) && opponentConnected && (() => {
                const isMyTurn = (playerColor === 'w' && chessRef.current?.turn() === 'w') || (playerColor === 'b' && chessRef.current?.turn() === 'b');
                const myName = myUsername || (publicKey ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` : 'You');
                // Player's captured pieces (pieces player took from opponent)
                const myCapturedTypes = playerColor === 'w' ? capturedPieces.wTypes : capturedPieces.bTypes;
                const myCapturedValue = myCapturedTypes.reduce((s, p) => s + ({ p: 1, n: 3, b: 3, r: 5, q: 9, P: 1, N: 3, B: 3, R: 5, Q: 9 }[p] || 0), 0);
                const opponentCapturedValue = (playerColor === 'w' ? capturedPieces.bTypes : capturedPieces.wTypes).reduce((s, p) => s + ({ p: 1, n: 3, b: 3, r: 5, q: 9, P: 1, N: 3, B: 3, R: 5, Q: 9 }[p] || 0), 0);
                const myAdvantage = Math.max(0, myCapturedValue - opponentCapturedValue);
                // Group pieces for display
                const sorted = [...myCapturedTypes].sort((a, b) => (PIECE_SORT_ORDER[a] ?? 5) - (PIECE_SORT_ORDER[b] ?? 5));
                const groups: { piece: string; count: number }[] = [];
                sorted.forEach(p => { const last = groups[groups.length - 1]; if (last && last.piece === p) last.count++; else groups.push({ piece: p, count: 1 }); });
                // Player captures opponent pieces, so show opponent's piece color
                const pieceColor = playerColor === 'w' ? '#b388ff' : '#e8e8f0';
                return (
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: 0,
                    padding: '12px 20px',
                    background: isMyTurn ? 'rgba(0,255,163,0.06)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isMyTurn ? 'rgba(0,255,163,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 14, transition: 'all 0.3s', marginTop: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: isMyTurn ? '#00ffa3' : '#333', boxShadow: isMyTurn ? '0 0 12px rgba(0,255,163,0.5)' : 'none', transition: 'all 0.3s' }} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: isMyTurn ? '#e8e8f0' : '#6b6b80', fontFamily: "'Outfit', sans-serif", maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{myName}</span>
                        <div style={{ width: 14, height: 14, borderRadius: 4, background: playerColor === 'w' ? '#e8e8f0' : '#1a1a2e', border: '1px solid rgba(255,255,255,0.15)' }} />
                        {/* Your reaction bubble */}
                        <AnimatePresence>
                          {outgoingReaction && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.5, x: -10 }}
                              animate={{ opacity: 1, scale: 1, x: 0 }}
                              exit={{ opacity: 0, scale: 0.5, x: -10 }}
                            >
                              <div style={{ background: 'rgba(153,69,255,0.25)', borderRadius: 99, padding: '2px 8px', border: '1px solid rgba(153,69,255,0.35)' }}>
                                <span style={{ fontSize: 18 }}>{outgoingReaction}</span>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: isMyTurn ? '#00ffa3' : '#6b6b80', letterSpacing: '0.05em', transition: 'color 0.3s' }}>
                        {formatTime(playerColor === 'w' ? whiteTimeMs : blackTimeMs)}
                      </span>
                    </div>
                    {myCapturedTypes.length > 0 && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', minHeight: 24 }}>
                        {groups.map((g, i) => (
                          <div key={`${g.piece}-${i}`} style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                            {Array.from({ length: g.count }).map((_, j) => (
                              <span key={j} style={{ fontSize: 18, lineHeight: 1, color: pieceColor, filter: playerColor === 'w' ? 'drop-shadow(0 1px 4px rgba(153,69,255,0.4))' : 'drop-shadow(0 1px 4px rgba(255,255,255,0.2))', marginLeft: j > 0 ? -6 : 0, position: 'relative', zIndex: g.count - j, opacity: 0.9, userSelect: 'none' }}>
                                {PIECE_SYMBOLS[g.piece]}
                              </span>
                            ))}
                          </div>
                        ))}
                        {myAdvantage > 0 && (
                          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: '#00ffa3', marginLeft: 6, padding: '2px 6px', borderRadius: 6, background: 'rgba(0,255,163,0.1)', border: '1px solid rgba(0,255,163,0.15)' }}>+{myAdvantage}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
              
              {/* Player timer bar for AI practice mode (shown below board) */}
              {mode === 'practice' && !isFreePlay && (() => {
                const isMyTurn = chessRef.current?.turn() === aiPlayerColor && aiGameStarted;
                const myName = myUsername || (publicKey ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` : 'You');
                // Player's captured pieces (pieces player took from AI)
                const myCapturedTypes = aiPlayerColor === 'w' ? capturedPieces.wTypes : capturedPieces.bTypes;
                const myCapturedValue = myCapturedTypes.reduce((s, p) => s + ({ p: 1, n: 3, b: 3, r: 5, q: 9, P: 1, N: 3, B: 3, R: 5, Q: 9 }[p] || 0), 0);
                const opponentCapturedValue = (aiPlayerColor === 'w' ? capturedPieces.bTypes : capturedPieces.wTypes).reduce((s, p) => s + ({ p: 1, n: 3, b: 3, r: 5, q: 9, P: 1, N: 3, B: 3, R: 5, Q: 9 }[p] || 0), 0);
                const myAdvantage = Math.max(0, myCapturedValue - opponentCapturedValue);
                // Group pieces for display
                const sorted = [...myCapturedTypes].sort((a, b) => (PIECE_SORT_ORDER[a] ?? 5) - (PIECE_SORT_ORDER[b] ?? 5));
                const groups: { piece: string; count: number }[] = [];
                sorted.forEach(p => { const last = groups[groups.length - 1]; if (last && last.piece === p) last.count++; else groups.push({ piece: p, count: 1 }); });
                // Player captures opponent pieces, so show opponent's piece color
                const pieceColor = aiPlayerColor === 'w' ? '#b388ff' : '#e8e8f0';
                return (
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: 0,
                    padding: '12px 20px',
                    background: isMyTurn ? 'rgba(0,255,163,0.06)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isMyTurn ? 'rgba(0,255,163,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 14, transition: 'all 0.3s', marginTop: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: isMyTurn ? '#00ffa3' : '#333', boxShadow: isMyTurn ? '0 0 12px rgba(0,255,163,0.5)' : 'none' }} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: isMyTurn ? '#e8e8f0' : '#6b6b80', fontFamily: "'Outfit', sans-serif" }}>{myName}</span>
                        <div style={{ width: 14, height: 14, borderRadius: 4, background: aiPlayerColor === 'w' ? '#e8e8f0' : '#1a1a2e', border: '1px solid rgba(255,255,255,0.15)' }} />
                      </div>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: isMyTurn ? '#00ffa3' : '#6b6b80', letterSpacing: '0.05em' }}>
                        {formatTime(aiPlayerColor === 'w' ? whiteTimeMs : blackTimeMs)}
                      </span>
                    </div>
                    {myCapturedTypes.length > 0 && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', minHeight: 24 }}>
                        {groups.map((g, i) => (
                          <div key={`${g.piece}-${i}`} style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                            {Array.from({ length: g.count }).map((_, j) => (
                              <span key={j} style={{ fontSize: 18, lineHeight: 1, color: pieceColor, filter: aiPlayerColor === 'w' ? 'drop-shadow(0 1px 4px rgba(153,69,255,0.4))' : 'drop-shadow(0 1px 4px rgba(255,255,255,0.2))', marginLeft: j > 0 ? -6 : 0, position: 'relative', zIndex: g.count - j, opacity: 0.9, userSelect: 'none' }}>
                                {PIECE_SYMBOLS[g.piece]}
                              </span>
                            ))}
                          </div>
                        ))}
                        {myAdvantage > 0 && (
                          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: '#00ffa3', marginLeft: 6, padding: '2px 6px', borderRadius: 6, background: 'rgba(0,255,163,0.1)', border: '1px solid rgba(0,255,163,0.15)' }}>+{myAdvantage}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
        </div>
        
        <div className="text-center py-3">
          <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: "'Space Mono', monospace" }}>
            {statusText}
          </p>
        </div>
      </div> {/* End w-full space-y-3 */}
      </div> {/* End left column */}

      {/* Right Column - Side Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 280 }}>

        {/* Card 1 - Game Status */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 24px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b6b80', marginBottom: 14, fontFamily: "'Space Mono', monospace" }}>Game Status</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#6b6b80' }}>Mode</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#00ffa3', fontFamily: "'Space Mono', monospace" }}>
                {mode === 'practice' && !isFreePlay ? 'Practice' : isFreePlay ? 'Free Play' : 'Wager'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#6b6b80' }}>Opponent</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f0' }}>
                {mode === 'practice' && !isFreePlay
                  ? `🤖 ${aiDifficulty === 'novice' ? 'Novice Bot' : aiDifficulty === 'club' ? 'Club Bot' : 'Master Bot'}`
                  : opponentUsername || (opponentWallet ? `${opponentWallet.slice(0, 4)}...${opponentWallet.slice(-4)}` : 'Waiting...')}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#6b6b80' }}>Stakes</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f0' }}>
                {mode === 'practice' || isFreePlay ? 'None' : `${getStakeTierInfo(selectedStakeTier).stake} SOL`}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#6b6b80' }}>Your Color</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 14, height: 14, borderRadius: 4,
                  background: ((mode === 'practice' && !isFreePlay) ? aiPlayerColor : playerColor) === 'w' ? '#e8e8f0' : '#1a1a2e',
                  border: '1px solid rgba(255,255,255,0.15)',
                }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f0' }}>
                  {((mode === 'practice' && !isFreePlay) ? aiPlayerColor : playerColor) === 'w' ? 'White' : 'Black'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2 - Move History */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 24px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b6b80', marginBottom: 14, fontFamily: "'Space Mono', monospace" }}>Move History</div>
          <div style={{ maxHeight: 200, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
            {(() => {
              const history = chessRef.current?.history() || [];
              if (history.length === 0) {
                return <p style={{ fontSize: 13, textAlign: 'center', padding: '16px 0', color: '#6b6b80' }}>No moves yet</p>;
              }
              const pairs: { num: number; white: string; black?: string }[] = [];
              for (let i = 0; i < history.length; i += 2) {
                pairs.push({ num: Math.floor(i / 2) + 1, white: history[i], black: history[i + 1] });
              }
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr', gap: '2px 8px' }}>
                  {/* Header */}
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#444', paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>#</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#444', paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>White</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#444', paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Black</span>
                  {pairs.map((pair, idx) => {
                    const isLatest = idx === pairs.length - 1;
                    const rowBg = isLatest ? 'rgba(0,255,163,0.08)' : 'transparent';
                    return (
                      <React.Fragment key={pair.num}>
                        <span style={{ fontSize: 12, fontFamily: "'Space Mono', monospace", color: '#444', padding: '4px 0', background: rowBg, borderRadius: isLatest ? '6px 0 0 6px' : 0 }}>{pair.num}.</span>
                        <span style={{ fontSize: 13, fontFamily: "'Space Mono', monospace", color: '#e8e8f0', padding: '4px 0', background: rowBg }}>{pair.white}</span>
                        <span style={{ fontSize: 13, fontFamily: "'Space Mono', monospace", color: '#e8e8f0', padding: '4px 0', background: rowBg, borderRadius: isLatest ? '0 6px 6px 0' : 0 }}>{pair.black || ''}</span>
                      </React.Fragment>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Card 3 - Actions */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 24px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b6b80', marginBottom: 14, fontFamily: "'Space Mono', monospace" }}>Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Difficulty Selector - only for practice mode */}
            {mode === 'practice' && !isFreePlay && !isMultiplayer && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b6b80', marginBottom: 8, fontFamily: "'Space Mono', monospace" }}>Difficulty</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {([['novice', '🟢', '~800'], ['club', '🟡', '~1200'], ['master', '🔴', '~1500']] as const).map(([key, icon, elo]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { setAiDifficulty(key as AIDifficulty); resetPractice(); }}
                      style={{
                        flex: 1, padding: '8px 6px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                        fontFamily: "'Outfit', sans-serif", cursor: 'pointer',
                        background: aiDifficulty === key ? 'rgba(153,69,255,0.15)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${aiDifficulty === key ? 'rgba(153,69,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        color: aiDifficulty === key ? '#c4a0ff' : '#a0a0b8',
                        transition: 'all 0.2s', textAlign: 'center',
                        boxShadow: aiDifficulty === key ? '0 0 12px rgba(153,69,255,0.15)' : 'none',
                      }}
                      onMouseEnter={(e) => { if (aiDifficulty !== key) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#e8e8f0'; } }}
                      onMouseLeave={(e) => { if (aiDifficulty !== key) { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#a0a0b8'; } }}
                    >
                      <div>{icon} {key.charAt(0).toUpperCase() + key.slice(1)}</div>
                      <div style={{ fontSize: 9, color: aiDifficulty === key ? '#9945ff' : '#6b6b80', marginTop: 2, fontFamily: "'Space Mono', monospace" }}>{elo} ELO</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* New Game - only show for practice mode (not multiplayer/wager) */}
            {mode === 'practice' && !isFreePlay && !isMultiplayer && (
            <button
              type="button"
              onClick={() => {
                if (mode === 'practice' && !isFreePlay) resetPractice();
              }}
              style={{
                padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                fontFamily: "'Outfit', sans-serif", cursor: 'pointer',
                background: 'rgba(0,255,163,0.08)', border: '1px solid rgba(0,255,163,0.2)', color: '#00ffa3',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,255,163,0.15)'; e.currentTarget.style.borderColor = 'rgba(0,255,163,0.35)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,255,163,0.08)'; e.currentTarget.style.borderColor = 'rgba(0,255,163,0.2)'; }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              New Game
            </button>
            )}
            {/* Flip Board + Undo side by side - only show for practice mode (not multiplayer/wager) */}
            {mode === 'practice' && !isFreePlay && !isMultiplayer && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  if (mode === 'practice' && !isFreePlay) {
                    setAiPlayerColor(prev => prev === 'w' ? 'b' : 'w');
                  }
                }}
                style={{
                  flex: 1, padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  fontFamily: "'Outfit', sans-serif", cursor: 'pointer',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#a0a0b8',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#e8e8f0'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#a0a0b8'; }}
              >
                ⟳ Flip Board
              </button>
              <button
                type="button"
                onClick={() => {
                  if (mode === 'practice' && !isFreePlay && !chessRef.current?.isGameOver()) {
                    chessRef.current?.undo();
                    chessRef.current?.undo();
                    setFen(chessRef.current!.fen());
                    setSelectedSquare(null);
                    setLastMove(null);
                  }
                }}
                style={{
                  flex: 1, padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  fontFamily: "'Outfit', sans-serif", cursor: 'pointer',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#a0a0b8',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#e8e8f0'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#a0a0b8'; }}
              >
                ↩ Undo
              </button>
            </div>
            )}
            {/* Resign - full width */}
            <button
                type="button"
                onClick={() => {
                  if ((isMultiplayer || isFreePlay) && socket && gameRoomId && !chessRef.current?.isGameOver() && !gameWinner) {
                    // Multiplayer/free play resign: notify server with roomId
                    // Server will call handleResignation which determines winner from player ID
                    // and emits game:end to both players
                    socket.emit('game:resign', { roomId: gameRoomId });
                    // Set local state immediately for responsive UI
                    // (server will also send game:end but we show modal right away)
                    const loser = playerColor || 'w';
                    const winner = loser === 'w' ? 'b' : 'w';
                    setGameWinner(winner);
                    setShowResultModal(true);
                  } else if (mode === 'practice' && !isFreePlay && !chessRef.current?.isGameOver()) {
                    setGameWinner(chessRef.current?.turn() === 'w' ? 'b' : 'w');
                    setShowResultModal(true);
                  }
                }}
                style={{
                  padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  fontFamily: "'Outfit', sans-serif", cursor: 'pointer',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#a0a0b8',
                  transition: 'all 0.2s', width: '100%',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)'; e.currentTarget.style.color = '#ef4444'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#a0a0b8'; }}
              >
                ⚑ Resign
              </button>
          </div>
        </div>

        {/* Card 4 - Tip (practice mode only) */}
        {mode === 'practice' && !isFreePlay && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(0,255,163,0.03), rgba(153,69,255,0.03))',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 24px',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9945ff', marginBottom: 10, fontFamily: "'Space Mono', monospace" }}>💡 TIP</div>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: '#6b6b80' }}>
              {PRACTICE_TIPS[tipIndex]}
            </p>
          </div>
        )}
      </div>
    </div>
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
            backgroundColor: 'rgba(7, 7, 14, 0.85)',
            backdropFilter: 'blur(12px)',
          }}
          onClick={() => setShowResultModal(false)}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            style={{
              width: 380,
              maxWidth: 'calc(100vw - 32px)',
              borderRadius: 24,
              overflow: 'hidden',
              position: 'relative',
              background: 'linear-gradient(180deg, rgba(20,20,40,0.98) 0%, rgba(12,12,26,0.99) 100%)',
              border: '1px solid rgba(153,69,255,0.2)',
              boxShadow: '0 0 80px rgba(153,69,255,0.12), 0 24px 48px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const isDraw = gameWinner === 'draw';
              const myColor = (mode === 'practice' && !isFreePlay) ? aiPlayerColor : (playerColor || 'w');
              const isWinner = !isDraw && gameWinner === myColor;
              const winnerColor = isDraw ? 'w' : (gameWinner || 'w');
              const loserColor = gameWinner === 'w' ? 'b' : 'w';
              const isEarlyEnd = gameEndReason === 'early_abandonment' || gameEndReason === 'early_resignation';

              // Early draw — show refund UI for wager matches
              if (isDraw && mode === 'wager' && currentMatchPubkey) {
                return (
                  <>
                    <div style={{
                      height: 3,
                      background: 'linear-gradient(90deg, transparent, #fbbf24, #9945ff, transparent)',
                    }} />
                    <div style={{ padding: '32px 28px 28px' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 10,
                          padding: '10px 24px', borderRadius: 100,
                          background: 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(153,69,255,0.08))',
                          border: '1px solid rgba(251,191,36,0.25)',
                          boxShadow: '0 0 24px rgba(251,191,36,0.1)',
                        }}>
                          <span style={{ fontSize: 20 }}>🤝</span>
                          <span style={{
                            fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em',
                            fontFamily: "'Outfit', sans-serif", color: '#fbbf24',
                          }}>
                            Draw
                          </span>
                        </div>
                      </div>

                      <p style={{
                        textAlign: 'center', fontSize: 14, color: '#6b6b80',
                        fontFamily: "'Outfit', sans-serif", marginBottom: 20, lineHeight: 1.6,
                      }}>
                        {isEarlyEnd
                          ? 'Game ended before 2 full moves — both players receive a full refund.'
                          : 'The game ended in a draw.'}
                      </p>

                      <div style={{
                        padding: '16px 20px', borderRadius: 14,
                        background: 'linear-gradient(135deg, rgba(251,191,36,0.06), rgba(153,69,255,0.04))',
                        border: '1px solid rgba(251,191,36,0.15)',
                        textAlign: 'center', marginBottom: 16,
                      }}>
                        <span style={{
                          display: 'block', fontSize: 10, fontWeight: 600,
                          textTransform: 'uppercase', letterSpacing: '0.1em',
                          color: '#6b6b80', marginBottom: 6,
                          fontFamily: "'Space Mono', monospace",
                        }}>Refund</span>
                        <span style={{
                          display: 'block', fontSize: 28, fontWeight: 800,
                          fontFamily: "'Space Mono', monospace",
                          color: '#fbbf24', letterSpacing: '-0.02em',
                        }}>
                          {getStakeTierInfo(selectedStakeTier).stake} SOL
                        </span>
                      </div>

                      {refundComplete ? (
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          gap: 6, marginTop: 12, padding: '10px 16px', borderRadius: 12,
                          background: 'rgba(0,255,163,0.08)', border: '1px solid rgba(0,255,163,0.15)',
                        }}>
                          <CheckCircle2 style={{ width: 14, height: 14, color: '#00ffa3' }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#00ffa3', fontFamily: "'Space Mono', monospace" }}>
                            Refund complete
                          </span>
                        </div>
                      ) : (
                        <motion.button
                          onClick={() => {
                            setShowResultModal(false);
                            handleDrawRefund();
                          }}
                          disabled={isRefunding}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          style={{
                            width: '100%', marginTop: 12, padding: '14px 24px',
                            borderRadius: 14, border: 'none',
                            cursor: isRefunding ? 'not-allowed' : 'pointer',
                            background: isRefunding
                              ? 'rgba(255,255,255,0.08)'
                              : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                            color: isRefunding ? '#6b6b80' : '#07070e',
                            fontSize: 15, fontWeight: 800,
                            fontFamily: "'Outfit', sans-serif",
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            boxShadow: isRefunding ? 'none' : '0 4px 24px rgba(251,191,36,0.3)',
                            transition: 'all 0.3s',
                          }}
                        >
                          {isRefunding ? (
                            <>
                              <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
                              Refunding...
                            </>
                          ) : (
                            <>
                              <Coins style={{ width: 18, height: 18 }} />
                              Claim Refund
                            </>
                          )}
                        </motion.button>
                      )}

                      <motion.button
                        onClick={() => setShowResultModal(false)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        style={{
                          width: '100%', marginTop: 8, padding: '12px 24px',
                          borderRadius: 14, cursor: 'pointer',
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: '#6b6b80', fontSize: 14, fontWeight: 600,
                          fontFamily: "'Outfit', sans-serif",
                        }}
                      >
                        Close
                      </motion.button>
                    </div>
                  </>
                );
              }

              return (
                <>
                  {/* Top accent gradient bar */}
                  <div style={{
                    height: 3,
                    background: isWinner
                      ? 'linear-gradient(90deg, transparent, #00ffa3, #9945ff, transparent)'
                      : 'linear-gradient(90deg, transparent, #ef4444, #9945ff, transparent)',
                  }} />

                  <div style={{ padding: '32px 28px 28px' }}>

                    {/* Result Badge */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 24px',
                        borderRadius: 100,
                        background: isWinner
                          ? 'linear-gradient(135deg, rgba(0,255,163,0.12), rgba(153,69,255,0.08))'
                          : 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(153,69,255,0.08))',
                        border: `1px solid ${isWinner ? 'rgba(0,255,163,0.25)' : 'rgba(239,68,68,0.25)'}`,
                        boxShadow: isWinner
                          ? '0 0 24px rgba(0,255,163,0.1)'
                          : '0 0 24px rgba(239,68,68,0.1)',
                      }}>
                        {isWinner ? (
                          <CheckCircle2 style={{ width: 20, height: 20, color: '#00ffa3' }} />
                        ) : (
                          <XCircle style={{ width: 20, height: 20, color: '#ef4444' }} />
                        )}
                        <span style={{
                          fontSize: 20,
                          fontWeight: 800,
                          letterSpacing: '-0.02em',
                          fontFamily: "'Outfit', sans-serif",
                          color: isWinner ? '#00ffa3' : '#ef4444',
                        }}>
                          {isWinner ? 'Victory!' : 'Defeat'}
                        </span>
                      </div>
                    </div>

                    {/* Matchup Display */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 20,
                      marginBottom: 20,
                      padding: '20px 24px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 16,
                    }}>
                      {/* Winner side */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 60,
                          height: 60,
                          borderRadius: 16,
                          background: winnerColor === 'w'
                            ? 'linear-gradient(135deg, #e8e8f0, #c8c8d4)'
                            : 'linear-gradient(135deg, #2a2a40, #1a1a2e)',
                          border: `2px solid ${isWinner ? 'rgba(0,255,163,0.5)' : 'rgba(255,255,255,0.15)'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: isWinner
                            ? '0 0 24px rgba(0,255,163,0.2)'
                            : '0 4px 16px rgba(0,0,0,0.3)',
                        }}>
                          <img
                            src={`/pieces/${winnerColor}K.svg`}
                            alt="Winner"
                            style={{ width: 40, height: 40 }}
                            draggable={false}
                          />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{
                            display: 'block',
                            fontSize: 13,
                            fontWeight: 700,
                            color: isWinner ? '#00ffa3' : '#e8e8f0',
                            fontFamily: "'Outfit', sans-serif",
                            marginBottom: 2,
                          }}>
                            {gameWinner === myColor ? (myUsername || 'You') : (opponentUsername || 'Opponent')}
                          </span>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            color: '#00ffa3',
                            fontFamily: "'Space Mono', monospace",
                          }}>
                            Winner
                          </span>
                        </div>
                      </div>

                      {/* VS divider */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                      }}>
                        <div style={{
                          width: 1,
                          height: 20,
                          background: 'linear-gradient(180deg, transparent, rgba(153,69,255,0.3))',
                        }} />
                        <span style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: '#9945ff',
                          fontFamily: "'Space Mono', monospace",
                        }}>
                          VS
                        </span>
                        <div style={{
                          width: 1,
                          height: 20,
                          background: 'linear-gradient(180deg, rgba(153,69,255,0.3), transparent)',
                        }} />
                      </div>

                      {/* Loser side */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 60,
                          height: 60,
                          borderRadius: 16,
                          background: loserColor === 'w'
                            ? 'linear-gradient(135deg, #e8e8f0, #c8c8d4)'
                            : 'linear-gradient(135deg, #2a2a40, #1a1a2e)',
                          border: '2px solid rgba(255,255,255,0.08)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: 0.5,
                          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                        }}>
                          <img
                            src={`/pieces/${loserColor}K.svg`}
                            alt="Loser"
                            style={{ width: 40, height: 40 }}
                            draggable={false}
                          />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{
                            display: 'block',
                            fontSize: 13,
                            fontWeight: 700,
                            color: !isWinner ? '#ef4444' : '#6b6b80',
                            fontFamily: "'Outfit', sans-serif",
                            marginBottom: 2,
                          }}>
                            {gameWinner !== myColor ? (myUsername || 'You') : (opponentUsername || 'Opponent')}
                          </span>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            color: '#ef4444',
                            fontFamily: "'Space Mono', monospace",
                          }}>
                            Defeated
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status line */}
                    <p style={{
                      textAlign: 'center',
                      fontSize: 12,
                      color: '#6b6b80',
                      marginBottom: 20,
                      fontFamily: "'Space Mono', monospace",
                    }}>
                      {statusText}
                    </p>

                    {/* Wager Reward Section — Winner */}
                    {mode === 'wager' && matchCreated && isWinner && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{
                          padding: '16px 20px',
                          borderRadius: 14,
                          background: 'linear-gradient(135deg, rgba(0,255,163,0.06), rgba(153,69,255,0.04))',
                          border: '1px solid rgba(0,255,163,0.15)',
                          textAlign: 'center',
                        }}>
                          <span style={{
                            display: 'block',
                            fontSize: 10,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            color: '#6b6b80',
                            marginBottom: 6,
                            fontFamily: "'Space Mono', monospace",
                          }}>
                            Reward
                          </span>
                          <span style={{
                            display: 'block',
                            fontSize: 28,
                            fontWeight: 800,
                            fontFamily: "'Space Mono', monospace",
                            background: 'linear-gradient(135deg, #00ffa3, #9945ff)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            letterSpacing: '-0.02em',
                          }}>
                            +{(getStakeTierInfo(selectedStakeTier).stake * 1.8).toFixed(2)} SOL
                          </span>
                        </div>

                        {payoutComplete ? (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            marginTop: 12,
                            padding: '10px 16px',
                            borderRadius: 12,
                            background: 'rgba(0,255,163,0.08)',
                            border: '1px solid rgba(0,255,163,0.15)',
                          }}>
                            <CheckCircle2 style={{ width: 14, height: 14, color: '#00ffa3' }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#00ffa3', fontFamily: "'Space Mono', monospace" }}>
                              Claimed successfully
                            </span>
                          </div>
                        ) : (
                          <motion.button
                            onClick={() => {
                              setShowResultModal(false);
                              handleSubmitResult();
                            }}
                            disabled={isSubmittingResult}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            style={{
                              width: '100%',
                              marginTop: 12,
                              padding: '14px 24px',
                              borderRadius: 14,
                              border: 'none',
                              cursor: isSubmittingResult ? 'not-allowed' : 'pointer',
                              background: isSubmittingResult
                                ? 'rgba(255,255,255,0.08)'
                                : 'linear-gradient(135deg, #00ffa3 0%, #00d4ff 50%, #9945ff 100%)',
                              color: isSubmittingResult ? '#6b6b80' : '#07070e',
                              fontSize: 15,
                              fontWeight: 800,
                              fontFamily: "'Outfit', sans-serif",
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 8,
                              boxShadow: isSubmittingResult
                                ? 'none'
                                : '0 4px 24px rgba(0,255,163,0.3)',
                              transition: 'all 0.3s',
                            }}
                          >
                            {isSubmittingResult ? (
                              <>
                                <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
                                Claiming...
                              </>
                            ) : (
                              <>
                                <Coins style={{ width: 18, height: 18 }} />
                                Claim Winnings
                              </>
                            )}
                          </motion.button>
                        )}
                      </div>
                    )}

                    {/* Wager Loss Section — Loser */}
                    {mode === 'wager' && matchCreated && !isWinner && (
                      <div style={{
                        marginBottom: 16,
                        padding: '16px 20px',
                        borderRadius: 14,
                        background: 'rgba(239,68,68,0.06)',
                        border: '1px solid rgba(239,68,68,0.15)',
                        textAlign: 'center',
                      }}>
                        <span style={{
                          display: 'block',
                          fontSize: 10,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.1em',
                          color: '#6b6b80',
                          marginBottom: 6,
                          fontFamily: "'Space Mono', monospace",
                        }}>
                          Lost
                        </span>
                        <span style={{
                          display: 'block',
                          fontSize: 24,
                          fontWeight: 800,
                          fontFamily: "'Space Mono', monospace",
                          color: '#ef4444',
                          letterSpacing: '-0.02em',
                        }}>
                          -{getStakeTierInfo(selectedStakeTier).stake} SOL
                        </span>
                      </div>
                    )}

                    {/* Share to X Button */}
                    <motion.button
                      onClick={() => {
                        const resultText = isWinner ? '🏆 I just won' : '⚔️ I just played';
                        const modeText = mode === 'wager'
                          ? ` a wager match on SolMate Chess!`
                          : ` a game on SolMate Chess!`;
                        const rewardText = mode === 'wager' && isWinner
                          ? ` Won ${(getStakeTierInfo(selectedStakeTier).stake * 1.8).toFixed(2)} SOL 💰`
                          : '';
                        const tweetText = `${resultText}${modeText}${rewardText}\n\nPlay chess on Solana 👉 https://playsolmate.fun`;
                        shareToX(tweetText);
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      style={{
                        width: '100%',
                        marginBottom: 8,
                        padding: '12px 24px',
                        borderRadius: 14,
                        cursor: 'pointer',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#e8e8f0',
                        fontSize: 14,
                        fontWeight: 600,
                        fontFamily: "'Outfit', sans-serif",
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        transition: 'all 0.2s',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      Share to X
                    </motion.button>

                    {/* Dismiss / Play Again Button */}
                    <motion.button
                      onClick={() => {
                        setShowResultModal(false);
                        if (mode === 'practice') resetPractice();
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      style={{
                        width: '100%',
                        padding: '12px 24px',
                        borderRadius: 14,
                        cursor: 'pointer',
                        background: mode === 'practice'
                          ? 'linear-gradient(135deg, rgba(153,69,255,0.15), rgba(153,69,255,0.08))'
                          : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${mode === 'practice' ? 'rgba(153,69,255,0.25)' : 'rgba(255,255,255,0.1)'}`,
                        color: mode === 'practice' ? '#c4a0ff' : '#a0a0b8',
                        fontSize: 14,
                        fontWeight: 600,
                        fontFamily: "'Outfit', sans-serif",
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        transition: 'all 0.2s',
                      }}
                    >
                      {mode === 'practice' ? (
                        <>
                          <RefreshCw style={{ width: 14, height: 14 }} />
                          Play Again
                        </>
                      ) : (
                        'Dismiss'
                      )}
                    </motion.button>
                  </div>
                </>
              );
            })()}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
};
