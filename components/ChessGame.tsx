'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Trophy, RefreshCw, X, CheckCircle2, XCircle, Wifi, WifiOff, Users, Share2, Clock, MessageCircle, Send, Eye } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

import { Chess } from 'chess.js';
import { EscrowClient, STAKE_TIERS, getStakeTierInfo, lamportsToSol, MatchStatus } from '@/utils/escrow';
import { getUsername, formatDisplayName } from '@/utils/username';

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
  
  // Last move tracking for highlighting
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  
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
  
  // Free play lobby state (color selection before game starts)
  const [inLobby, setInLobby] = useState(false);
  const [lobbyHostColor, setLobbyHostColor] = useState<'w' | 'b'>('w');
  const [lobbyOpponentName, setLobbyOpponentName] = useState<string>('');
  const [lobbyOpponentWallet, setLobbyOpponentWallet] = useState<string | null>(null);
  const [whiteRequest, setWhiteRequest] = useState(false);
  const [whiteRequestPending, setWhiteRequestPending] = useState(false);
  const [swapRequestWantColor, setSwapRequestWantColor] = useState<'w' | 'b' | null>(null);
  
  // Spectator mode
  const [isSpectating, setIsSpectating] = useState(false);
  const [spectatorWhitePlayer, setSpectatorWhitePlayer] = useState<string>('');
  const [spectatorBlackPlayer, setSpectatorBlackPlayer] = useState<string>('');
  
  // AI difficulty: 'novice' (depth 1), 'club' (depth 2), 'master' (depth 3)
  type AIDifficulty = 'novice' | 'club' | 'master';
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('club');
  
  // AI player color (default white for player)
  const [aiPlayerColor, setAiPlayerColor] = useState<'w' | 'b'>('w');
  
  // Opponent info for username display
  const [opponentWallet, setOpponentWallet] = useState<string | null>(null);
  const [opponentUsername, setOpponentUsername] = useState<string | null>(null);
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
  
  // Track if AI game has started (for timer)
  const [aiGameStarted, setAiGameStarted] = useState(false);

  // Live timer countdown - works for both free play and AI matches
  useEffect(() => {
    // For free play: need opponent connected
    // For AI: need game to have started (first move made)
    const shouldRunTimer = (isFreePlay && opponentConnected) || (mode === 'practice' && !isFreePlay && aiGameStarted);
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
  }, [opponentConnected, isFreePlay, fen, mode, aiGameStarted]); // fen changes on each move

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
      setGameWinner(winner);
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
      
      // Register player first (needed for move handling)
      const walletAddr = publicKey?.toString() || `guest_${Math.random().toString(36).slice(2, 8)}`;
      newSocket.emit('player:register', { walletAddress: walletAddr });
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
      
      // Store opponent wallet for username lookup
      if (oppWallet) {
        setOpponentWallet(oppWallet);
        // Fetch opponent's username
        getUsername(oppWallet).then(setOpponentUsername);
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
    newSocket.on('game:end', ({ winner, reason }) => {
      console.log('Game over:', winner, reason);
      setGameWinner(winner);
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
    
    newSocket.on('disconnect', () => {
      console.log('Disconnected from free play server');
    });
    
    setSocket(newSocket);
    
    return () => {
      newSocket.disconnect();
    };
  }, [isFreePlay, playSound]);
  
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
      console.error('ERROR: gameRoomId not set, cannot send move! Current state:', { isMultiplayer, isFreePlay, opponentConnected });
      return;
    }
    console.log('Sending move to server:', { roomId: gameRoomId, from, to, san, promotion });
    socket.emit('game:makeMove', { 
      roomId: gameRoomId,
      move: { from, to, san, promotion }
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

  // Free play handlers
  const handleCreateFreePlay = () => {
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
    // Reset chess board
    chessRef.current = new Chess();
    setFen(chessRef.current.fen());
    setLastMove(null);
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
    setShowResultModal(false);
    setLastMove(null);
    setFen(chessRef.current.fen());
    // Reset timer for AI games
    setWhiteTimeMs(600000);
    setBlackTimeMs(600000);
    setAiGameStarted(false);
    lastTickRef.current = Date.now();
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

      // Check match status before submitting
      console.log('Match status:', matchData.status);
      console.log('Match playerA:', matchData.playerA.toBase58());
      console.log('Match playerB:', matchData.playerB?.toBase58() || 'None');
      
      if (matchData.status !== MatchStatus.Active) {
        alert(`Cannot submit result: Match is in ${matchData.status} status. Expected: Active`);
        return;
      }

      const winnerPubkey = gameWinner === 'w' ? matchData.playerA : matchData.playerB!;
      
      console.log('Submitting result... Winner:', winnerPubkey.toBase58());
      const signature = await client.submitResult(currentMatchPubkey, winnerPubkey);
      console.log('Result submitted:', signature);
      setTxSignature(signature);
      
      // Wait a moment for chain state to propagate before confirming payout
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Confirming payout...');
      await handleConfirmPayout(winnerPubkey, matchData.playerA);
    } catch (error) {
      console.error('Error submitting result:', error);
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
    
    // AI plays the opposite color of the player
    const aiColor = aiPlayerColor === 'w' ? 'b' : 'w';
    if (chess.turn() !== aiColor) return;

    const moves = chess.moves({ verbose: true }) as Array<any>;
    if (moves.length === 0) return;

    // Depth based on difficulty: Novice=1, Club=2, Master=3
    const depthMap = { novice: 1, club: 2, master: 3 };
    const depth = depthMap[aiDifficulty];
    
    let bestMove = moves[0];
    let bestValue = aiColor === 'b' ? Infinity : -Infinity;
    
    for (const move of moves) {
      chess.move(move);
      const value = minimax(chess, depth, -Infinity, Infinity, aiColor === 'b');
      chess.undo();
      
      if (aiColor === 'b' ? value < bestValue : value > bestValue) {
        bestValue = value;
        bestMove = move;
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
  }, [playSound, aiDifficulty, aiPlayerColor]);

  const onSquareClick = (square: string) => {
    const chess = chessRef.current!;

    if (chess.isGameOver()) return;
    
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
      setLastMove({ from: selectedSquare, to: square });
      
      // Start AI game timer on first move
      if (mode === 'practice' && !isFreePlay && !aiGameStarted) {
        setAiGameStarted(true);
        lastTickRef.current = Date.now();
      }
      
      // Play sound
      if (chess.isCheck()) {
        playSound('check');
      } else if (move.flags?.includes('c') || move.flags?.includes('e')) {
        playSound('capture');
      } else if (move.flags?.includes('k') || move.flags?.includes('q')) {
        playSound('castle');
      } else {
        playSound('move');
      }
      
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
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 max-w-6xl mx-auto">
        {/* Chess Board */}
        <div className="flex-1 flex flex-col items-center w-full min-w-0">
          {/* Match Header */}
          {mode === 'wager' && matchInfo && (
            <div className="w-full max-w-[min(480px,calc(100vw-1rem))] glass-card border-solana-purple/20 rounded-lg sm:rounded-xl lg:rounded-2xl p-2 sm:p-3 lg:p-4 shadow-glow-sm mb-3 sm:mb-4">
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

          <div className="w-full max-w-[min(480px,calc(100vw-1rem))] space-y-3 sm:space-y-4">
            <div className="glass-card rounded-lg sm:rounded-xl lg:rounded-2xl p-2 sm:p-3 lg:p-4 shadow-glow">
              {/* Opponent info bar for multiplayer/free play (shown at top) */}
              {(isFreePlay || isMultiplayer) && opponentConnected && (
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${playerColor === 'b' ? 'bg-white border border-neutral-400' : 'bg-neutral-800 border border-neutral-600'}`} />
                    <span className="font-semibold text-sm truncate max-w-[120px]">
                      {opponentUsername || (opponentWallet ? `${opponentWallet.slice(0, 4)}...${opponentWallet.slice(-4)}` : 'Opponent')}
                    </span>
                    {/* Opponent's reaction bubble */}
                    <AnimatePresence>
                      {incomingReaction && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5, x: -10 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.5, x: -10 }}
                        >
                          <div className="bg-white/20 rounded-full px-2 py-0.5 border border-white/30">
                            <span className="text-xl">{incomingReaction}</span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className={`flex items-center gap-1.5 font-mono text-lg px-3 py-1 rounded-lg ${
                    (playerColor === 'w' && chessRef.current?.turn() === 'b') || 
                    (playerColor === 'b' && chessRef.current?.turn() === 'w')
                      ? 'bg-solana-purple/30 text-white'
                      : 'bg-white/5 text-neutral-400'
                  }`}>
                    <Clock className="w-4 h-4" />
                    {formatTime(playerColor === 'w' ? blackTimeMs : whiteTimeMs)}
                  </div>
                </div>
              )}
              
              {/* AI info bar for practice mode (shown at top) */}
              {mode === 'practice' && !isFreePlay && (
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${aiPlayerColor === 'w' ? 'bg-neutral-800 border border-neutral-600' : 'bg-white border border-neutral-400'}`} />
                    <span className="font-semibold text-sm">
                      🤖 {aiDifficulty === 'novice' ? 'Novice Bot' : aiDifficulty === 'club' ? 'Club Bot' : 'Master Bot'}
                    </span>
                    {/* AI's reaction bubble */}
                    <AnimatePresence>
                      {incomingReaction && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5, x: -10 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.5, x: -10 }}
                        >
                          <div className="bg-white/20 rounded-full px-2 py-0.5 border border-white/30">
                            <span className="text-xl">{incomingReaction}</span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className={`flex items-center gap-1.5 font-mono text-lg px-3 py-1 rounded-lg ${
                    chessRef.current?.turn() === (aiPlayerColor === 'w' ? 'b' : 'w') && aiGameStarted
                      ? 'bg-solana-purple/30 text-white'
                      : 'bg-white/5 text-neutral-400'
                  }`}>
                    <Clock className="w-4 h-4" />
                    {formatTime(aiPlayerColor === 'w' ? blackTimeMs : whiteTimeMs)}
                  </div>
                </div>
              )}
              
              {/* Opponent's captured pieces (shown at top) */}
              <div className="flex items-center justify-between mb-2 min-h-[28px]">
                <div className="flex items-center gap-0.5 flex-wrap">
                  {/* For AI practice mode, use aiPlayerColor; for multiplayer use playerColor */}
                  {capturedPieces[((mode === 'practice' && !isFreePlay) ? aiPlayerColor : playerColor) === 'w' ? 'b' : 'w'].map((piece, idx) => (
                    <img
                      key={idx}
                      src={piece.svg}
                      alt="captured piece"
                      className="w-5 h-5 sm:w-6 sm:h-6 opacity-70"
                    />
                  ))}
                </div>
                {materialAdvantage < 0 && (
                  <span className="text-xs font-bold text-neutral-400">+{Math.abs(materialAdvantage)}</span>
                )}
              </div>
              
              <div className="aspect-square w-full overflow-hidden rounded-lg sm:rounded-xl border-2 border-white/10">
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

                // Determine background color with priority: check > selected > lastMove > default
                let bgStyle: React.CSSProperties = {
                  backgroundColor: isLight ? '#e5e5e5' : '#525252',
                  borderRadius: '2px',
                };
                
                if (isLastMove && !isSelected && !isKingInCheck) {
                  bgStyle.backgroundColor = isLight ? '#fcd34d' : '#b45309'; // amber-300 / amber-700
                }
                if (isSelected) {
                  bgStyle.backgroundColor = '#34d399'; // emerald-400
                  bgStyle.boxShadow = 'inset 0 0 0 4px #10b981'; // emerald-500
                }
                if (isKingInCheck) {
                  bgStyle.backgroundColor = '#ef4444'; // red-500
                  bgStyle.boxShadow = 'inset 0 0 0 4px #b91c1c'; // red-700
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
                        className="relative w-[80%] h-[80%]"
                        style={{ zIndex: 1 }}
                      >
                        <img
                          src={svgPath}
                          alt=""
                          className="w-full h-full object-contain pointer-events-none drop-shadow-lg"
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
                          backgroundColor: 'rgba(0, 0, 0, 0.25)',
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
                          border: '5px solid rgba(0, 0, 0, 0.25)',
                          zIndex: 10,
                          pointerEvents: 'none',
                        }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
          
              {/* Player's captured pieces (shown at bottom) */}
              <div className="flex items-center justify-between mt-2 min-h-[28px]">
                <div className="flex items-center gap-0.5 flex-wrap">
                  {/* For AI practice mode, use aiPlayerColor; for multiplayer use playerColor */}
                  {capturedPieces[((mode === 'practice' && !isFreePlay) ? aiPlayerColor : playerColor) === 'w' ? 'w' : 'b'].map((piece, idx) => (
                    <img
                      key={idx}
                      src={piece.svg}
                      alt="captured piece"
                      className="w-5 h-5 sm:w-6 sm:h-6 opacity-70"
                    />
                  ))}
                </div>
                {materialAdvantage > 0 && (
                  <span className="text-xs font-bold text-solana-green">+{materialAdvantage}</span>
                )}
              </div>
              
              {/* Emoji Picker & Chat Buttons */}
              {((isFreePlay || isMultiplayer) && opponentConnected) || (mode === 'practice' && !isFreePlay) ? (
                <div className="flex items-center gap-2 mt-2">
                  {/* React Button */}
                  <div className="relative">
                    <button
                      onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowChat(false); }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all text-sm"
                    >
                      <span>😊</span>
                      <span className="text-neutral-400">React</span>
                    </button>
                    
                    <AnimatePresence>
                      {showEmojiPicker && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: 10 }}
                          className="absolute bottom-full left-0 mb-2 z-40"
                        >
                          <div className="bg-neutral-900 rounded-xl p-2 border border-white/20 shadow-xl flex gap-1">
                            {REACTION_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => sendReaction(emoji)}
                                className="text-2xl hover:scale-125 transition-transform p-1 hover:bg-white/10 rounded-lg"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  {/* Chat Button */}
                  <button
                    onClick={() => { setShowChat(!showChat); setShowEmojiPicker(false); }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all text-sm relative"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span className="text-neutral-400">Chat</span>
                    {unreadCount > 0 && !showChat && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                </div>
              ) : null}
              
              {/* Chat Popup */}
              <AnimatePresence>
                {showChat && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    className="absolute bottom-24 left-2 right-2 z-50 sm:left-auto sm:right-4 sm:w-80"
                  >
                    <div 
                      className="rounded-xl border border-white/20 shadow-2xl overflow-hidden"
                      style={{ backgroundColor: '#171717' }}
                    >
                      {/* Chat Header */}
                      <div 
                        className="flex items-center justify-between px-4 py-2 border-b border-white/10"
                        style={{ backgroundColor: '#1f1f1f' }}
                      >
                        <span className="font-semibold text-sm">Chat</span>
                        <button
                          onClick={() => setShowChat(false)}
                          className="text-neutral-400 hover:text-white transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* Chat Messages */}
                      <div 
                        className="h-48 overflow-y-auto p-3 space-y-2"
                        style={{ backgroundColor: '#171717' }}
                      >
                        {chatMessages.length === 0 ? (
                          <p className="text-neutral-500 text-sm text-center py-8">
                            No messages yet. Say hi! 👋
                          </p>
                        ) : (
                          chatMessages.map((msg, idx) => (
                            <div
                              key={idx}
                              className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className="max-w-[80%] px-3 py-1.5 rounded-xl text-sm text-white"
                                style={{
                                  backgroundColor: msg.sender === 'me' ? '#9945FF' : '#3f3f46'
                                }}
                              >
                                {msg.message}
                              </div>
                            </div>
                          ))
                        )}
                        <div ref={chatEndRef} />
                      </div>
                      
                      {/* Chat Input */}
                      <div 
                        className="p-2 border-t border-white/10"
                        style={{ backgroundColor: '#1f1f1f' }}
                      >
                        <form
                          onSubmit={(e) => { e.preventDefault(); sendChat(); }}
                          className="flex gap-2"
                        >
                          <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Type a message..."
                            maxLength={200}
                            className="flex-1 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none"
                            style={{ backgroundColor: '#262626', border: '1px solid #404040' }}
                          />
                          <button
                            type="submit"
                            disabled={!chatInput.trim()}
                            className="bg-solana-purple hover:bg-solana-purple/80 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-3 py-2 transition-colors"
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
              {(isFreePlay || isMultiplayer) && opponentConnected && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${playerColor === 'w' ? 'bg-white border border-neutral-400' : 'bg-neutral-800 border border-neutral-600'}`} />
                    <span className="font-semibold text-sm truncate max-w-[120px]">
                      {myUsername || (publicKey ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` : 'You')}
                    </span>
                    {/* Your reaction bubble */}
                    <AnimatePresence>
                      {outgoingReaction && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5, x: -10 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.5, x: -10 }}
                        >
                          <div className="bg-solana-purple/40 rounded-full px-2 py-0.5 border border-solana-purple/50">
                            <span className="text-xl">{outgoingReaction}</span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className={`flex items-center gap-1.5 font-mono text-lg px-3 py-1 rounded-lg ${
                    (playerColor === 'w' && chessRef.current?.turn() === 'w') || 
                    (playerColor === 'b' && chessRef.current?.turn() === 'b')
                      ? 'bg-solana-purple/30 text-white'
                      : 'bg-white/5 text-neutral-400'
                  }`}>
                    <Clock className="w-4 h-4" />
                    {formatTime(playerColor === 'w' ? whiteTimeMs : blackTimeMs)}
                  </div>
                </div>
              )}
              
              {/* Player info bar for AI practice mode (shown at bottom) */}
              {mode === 'practice' && !isFreePlay && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${aiPlayerColor === 'w' ? 'bg-white border border-neutral-400' : 'bg-neutral-800 border border-neutral-600'}`} />
                    <span className="font-semibold text-sm truncate max-w-[120px]">
                      {myUsername || (publicKey ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` : 'You')}
                    </span>
                    {/* Your reaction bubble */}
                    <AnimatePresence>
                      {outgoingReaction && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5, x: -10 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.5, x: -10 }}
                        >
                          <div className="bg-solana-purple/40 rounded-full px-2 py-0.5 border border-solana-purple/50">
                            <span className="text-xl">{outgoingReaction}</span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className={`flex items-center gap-1.5 font-mono text-lg px-3 py-1 rounded-lg ${
                    chessRef.current?.turn() === aiPlayerColor && aiGameStarted
                      ? 'bg-solana-purple/30 text-white'
                      : 'bg-white/5 text-neutral-400'
                  }`}>
                    <Clock className="w-4 h-4" />
                    {formatTime(aiPlayerColor === 'w' ? whiteTimeMs : blackTimeMs)}
                  </div>
                </div>
              )}
        </div>
        
        <div className="text-center py-3">
          <p className="text-sm font-medium text-neutral-400">
            {statusText}
          </p>
        </div>
      </div>

      {/* Game Controls */}
      <div className="w-full lg:w-80 space-y-4 mt-2 lg:mt-0">
        <div className="glass-card rounded-xl lg:rounded-2xl p-3 sm:p-4 lg:p-6">
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
                    
                    {/* AI Difficulty Selector */}
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                      <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-2">
                        AI Difficulty
                      </p>
                      <div className="flex rounded-lg border border-white/10 bg-black/40 p-1">
                        <button
                          type="button"
                          onClick={() => { setAiDifficulty('novice'); resetPractice(); }}
                          className="flex-1 px-3 py-2 text-xs font-semibold rounded-md transition-all text-white"
                          style={{
                            background: aiDifficulty === 'novice' 
                              ? 'linear-gradient(to right, #16a34a, #22c55e)' 
                              : 'transparent',
                            color: aiDifficulty === 'novice' ? 'white' : '#a3a3a3'
                          }}
                        >
                          Novice
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAiDifficulty('club'); resetPractice(); }}
                          className="flex-1 px-3 py-2 text-xs font-semibold rounded-md transition-all text-white"
                          style={{
                            background: aiDifficulty === 'club' 
                              ? 'linear-gradient(to right, #ca8a04, #eab308)' 
                              : 'transparent',
                            color: aiDifficulty === 'club' ? 'white' : '#a3a3a3'
                          }}
                        >
                          Club
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAiDifficulty('master'); resetPractice(); }}
                          className="flex-1 px-3 py-2 text-xs font-semibold rounded-md transition-all text-white"
                          style={{
                            background: aiDifficulty === 'master' 
                              ? 'linear-gradient(to right, #dc2626, #ef4444)' 
                              : 'transparent',
                            color: aiDifficulty === 'master' ? 'white' : '#a3a3a3'
                          }}
                        >
                          Master
                        </button>
                      </div>
                      <p className="text-[10px] text-neutral-500 mt-2 text-center">
                        {aiDifficulty === 'novice' && '~1000 ELO • Great for beginners'}
                        {aiDifficulty === 'club' && '~1400 ELO • Intermediate challenge'}
                        {aiDifficulty === 'master' && '~1800 ELO • Advanced play'}
                      </p>
                    </div>
                    
                    {/* AI Color Selector */}
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                      <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-2">
                        Play As
                      </p>
                      <div className="flex rounded-lg border border-white/10 bg-black/40 p-1">
                        <button
                          type="button"
                          onClick={() => { setAiPlayerColor('w'); resetPractice(); }}
                          className="flex-1 px-3 py-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-2"
                          style={{
                            background: aiPlayerColor === 'w' ? '#ffffff' : 'transparent',
                            color: aiPlayerColor === 'w' ? '#000000' : '#a3a3a3'
                          }}
                        >
                          <div className="w-3 h-3 rounded-full bg-white border border-neutral-300" />
                          White
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAiPlayerColor('b'); resetPractice(); }}
                          className="flex-1 px-3 py-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-2"
                          style={{
                            background: aiPlayerColor === 'b' ? '#262626' : 'transparent',
                            color: aiPlayerColor === 'b' ? '#ffffff' : '#a3a3a3'
                          }}
                        >
                          <div className="w-3 h-3 rounded-full bg-neutral-800 border border-neutral-600" />
                          Black
                        </button>
                      </div>
                    </div>
                    
                    <motion.button
                      type="button"
                      onClick={resetPractice}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-xl transition-all"
                    >
                      <RefreshCw className="h-4 w-4" />
                      New Game vs AI
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
                ) : isSpectating ? (
                  // Spectator Mode UI
                  <div className="space-y-4">
                    <div className="p-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl border border-yellow-500/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Eye className="h-5 w-5 text-yellow-400" />
                        <p className="text-sm font-semibold text-yellow-400">Spectating</p>
                      </div>
                      <p className="text-xs text-neutral-400 mb-3">
                        This game is already in progress. You are watching as a spectator.
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-white border border-neutral-300" />
                          <span className="text-white">{spectatorWhitePlayer}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-neutral-800 border border-neutral-600" />
                          <span className="text-white">{spectatorBlackPlayer}</span>
                        </div>
                      </div>
                    </div>
                    
                    <motion.button
                      type="button"
                      onClick={() => {
                        setIsSpectating(false);
                        setIsFreePlay(false);
                        setFreePlayCode('');
                        chessRef.current = new Chess();
                        setFen(chessRef.current.fen());
                        setLastMove(null);
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-xl transition-all"
                    >
                      <X className="h-4 w-4" />
                      Stop Watching
                    </motion.button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Lobby State - Color Selection */}
                    {inLobby && !opponentConnected && (
                      <div className="p-4 bg-gradient-to-r from-solana-purple/20 to-solana-green/20 rounded-xl border border-solana-purple/30">
                        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-2">
                          Pre-Game Lobby
                        </p>
                        <p className="text-sm text-white mb-3">
                          {(dynamicPlayerRole === 'host' || isCreatingFreePlay) ? (
                            <><span className="font-semibold">{lobbyOpponentName}</span> has joined!</>
                          ) : (
                            <>You joined <span className="font-semibold">{lobbyOpponentName}</span>'s game</>
                          )}
                        </p>
                        
                        {/* Color Selection UI */}
                        <div className="space-y-3">
                          <p className="text-xs text-neutral-400">Choose your color:</p>
                          
                          {/* Host can swap colors */}
                          {(dynamicPlayerRole === 'host' || isCreatingFreePlay) && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => socket?.emit('freeplay:swapColors', { code: freePlayCode })}
                                className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                                  lobbyHostColor === 'w' 
                                    ? 'bg-white text-black ring-2 ring-solana-green' 
                                    : 'bg-white/20 text-white hover:bg-white/30'
                                }`}
                              >
                                <div className="w-4 h-4 rounded-full bg-white border border-neutral-300" />
                                White
                              </button>
                              <button
                                onClick={() => socket?.emit('freeplay:swapColors', { code: freePlayCode })}
                                className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                                  lobbyHostColor === 'b' 
                                    ? 'bg-neutral-800 text-white ring-2 ring-solana-green' 
                                    : 'bg-white/20 text-white hover:bg-white/30'
                                }`}
                              >
                                <div className="w-4 h-4 rounded-full bg-neutral-800 border border-neutral-600" />
                                Black
                              </button>
                            </div>
                          )}
                          
                          {/* Guest sees current assignment with request option */}
                          {dynamicPlayerRole === 'join' && (
                            <>
                              <p className="text-xs text-neutral-500 mb-1">
                                Host controls color selection. You can request to swap:
                              </p>
                              <div className="flex gap-2">
                                <div className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 ${
                                  playerColor === 'w' 
                                    ? 'bg-white text-black ring-2 ring-solana-green' 
                                    : 'bg-white/10 text-neutral-500'
                                }`}>
                                  <div className="w-4 h-4 rounded-full bg-white border border-neutral-300" />
                                  White {playerColor === 'w' && '(You)'}
                                </div>
                                <div className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 ${
                                  playerColor === 'b' 
                                    ? 'bg-neutral-800 text-white ring-2 ring-solana-green' 
                                    : 'bg-white/10 text-neutral-500'
                                }`}>
                                  <div className="w-4 h-4 rounded-full bg-neutral-800 border border-neutral-600" />
                                  Black {playerColor === 'b' && '(You)'}
                                </div>
                              </div>
                              
                              {!whiteRequestPending && (
                                <button
                                  onClick={() => {
                                    socket?.emit('freeplay:requestSwap', { code: freePlayCode, wantColor: playerColor === 'w' ? 'b' : 'w' });
                                    setWhiteRequestPending(true);
                                  }}
                                  className="w-full py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-all"
                                >
                                  Request to play as {playerColor === 'w' ? 'Black' : 'White'}
                                </button>
                              )}
                              {whiteRequestPending && (
                                <p className="text-xs text-yellow-400 text-center">⏳ Waiting for host to respond...</p>
                              )}
                            </>
                          )}
                          
                          {/* Swap Request from Guest (Host sees this) */}
                          {whiteRequest && (dynamicPlayerRole === 'host' || isCreatingFreePlay) && (
                            <div className="p-3 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
                              <p className="text-sm text-yellow-300 mb-2">
                                {lobbyOpponentName} wants to play as {swapRequestWantColor === 'w' ? 'White' : 'Black'}
                              </p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    socket?.emit('freeplay:respondSwapRequest', { code: freePlayCode, accepted: true });
                                    setWhiteRequest(false);
                                    setSwapRequestWantColor(null);
                                  }}
                                  className="flex-1 py-1.5 px-3 rounded-lg bg-green-500/30 hover:bg-green-500/40 text-green-400 text-sm font-semibold transition-all flex items-center justify-center gap-1"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  Accept
                                </button>
                                <button
                                  onClick={() => {
                                    socket?.emit('freeplay:respondSwapRequest', { code: freePlayCode, accepted: false });
                                    setWhiteRequest(false);
                                    setSwapRequestWantColor(null);
                                  }}
                                  className="flex-1 py-1.5 px-3 rounded-lg bg-red-500/30 hover:bg-red-500/40 text-red-400 text-sm font-semibold transition-all flex items-center justify-center gap-1"
                                >
                                  <XCircle className="w-4 h-4" />
                                  Decline
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Start Game Button (Host only) */}
                        {(dynamicPlayerRole === 'host' || isCreatingFreePlay) && (
                          <motion.button
                            type="button"
                            onClick={() => socket?.emit('freeplay:startGame', { code: freePlayCode })}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="mt-4 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-solana-purple to-solana-green text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all"
                          >
                            <Swords className="h-5 w-5" />
                            Start Game
                          </motion.button>
                        )}
                        
                        {/* Waiting message for guest */}
                        {dynamicPlayerRole === 'join' && (
                          <p className="mt-4 text-sm text-neutral-400 text-center">
                            Waiting for host to start the game...
                          </p>
                        )}
                      </div>
                    )}
                    
                    {/* Regular waiting/playing state */}
                    {!inLobby && (
                      <div className="p-4 bg-gradient-to-r from-solana-purple/20 to-solana-green/20 rounded-xl border border-solana-purple/30">
                        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-1">
                          {opponentConnected ? 'Game In Progress' : 'Room Code'}
                        </p>
                        {freePlayCode && (
                          <p className="text-3xl font-bold font-mono text-white">{freePlayCode}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Users className={`h-4 w-4 ${opponentConnected ? 'text-green-400' : 'text-yellow-400'}`} />
                          <span className={`text-sm ${opponentConnected ? 'text-green-400' : 'text-yellow-400'}`}>
                            {opponentConnected ? `Playing as ${playerColor === 'w' ? 'White' : 'Black'}` : 'Waiting for opponent...'}
                          </span>
                        </div>
                        {freePlayCode && (
                          <motion.button
                            type="button"
                            onClick={() => {
                              const shareUrl = `${window.location.origin}/game?freeplay=${freePlayCode}`;
                              if (navigator.share) {
                                navigator.share({
                                  title: opponentConnected ? 'Watch our chess game on SolMate!' : 'Play Chess with me on SolMate!',
                                  text: opponentConnected 
                                    ? `Watch our live chess game! Room code: ${freePlayCode}` 
                                    : `Join my chess game! Room code: ${freePlayCode}`,
                                  url: shareUrl,
                                }).catch(() => {});
                              } else {
                                navigator.clipboard.writeText(shareUrl);
                                alert(opponentConnected 
                                  ? 'Spectator link copied! Share it so others can watch.' 
                                  : 'Link copied! Share it with your friend.');
                              }
                            }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="mt-3 w-full flex items-center justify-center gap-2 bg-solana-green/20 hover:bg-solana-green/30 text-solana-green font-semibold py-2 px-4 rounded-lg border border-solana-green/30 transition-all text-sm"
                          >
                            <Share2 className="h-4 w-4" />
                            {opponentConnected ? 'Share Spectator Link' : 'Share Invite Link'}
                          </motion.button>
                        )}
                      </div>
                    )}
                    
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
            {/* Determine if current player won */}
            {(() => {
              // In practice mode, player is always white
              // In multiplayer/free play, use playerColor
              const myColor = playerColor || 'w';
              const isWinner = gameWinner === myColor;
              const winnerColor = gameWinner || 'w';
              const loserColor = gameWinner === 'w' ? 'b' : 'w';
              
              return (
                <>
                  {/* Header: Victory/Defeat + Icon */}
                  <div className="flex items-center justify-center gap-1.5 mb-3">
                    <img 
                      src={isWinner ? "/pieces/wN.svg" : "/pieces/bN.svg"}
                      alt="Knight" 
                      className="w-3.5 h-3.5 flex-shrink-0"
                    />
                    <h2 className={`text-sm font-bold whitespace-nowrap ${isWinner ? 'text-white' : 'text-red-400'}`}>
                      {isWinner ? 'Victory!' : 'Defeat'}
                    </h2>
                    {isWinner ? (
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 flex-shrink-0 text-red-400" />
                    )}
                  </div>

                  {/* Winner vs Loser */}
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <div className="flex flex-col items-center gap-1">
                      <img 
                        src={`/pieces/${winnerColor}K.svg`}
                        alt="Winner" 
                        className="w-6 h-6 flex-shrink-0"
                      />
                      <span className={`text-[10px] font-medium uppercase ${isWinner ? 'text-emerald-400' : 'text-neutral-400'}`}>
                        {isWinner ? 'You' : 'Opp'}
                      </span>
                    </div>
                    
                    <div className="text-xs font-bold text-purple-400">VS</div>
                    
                    <div className="flex flex-col items-center gap-1">
                      <img 
                        src={`/pieces/${loserColor}K.svg`}
                        alt="Loser" 
                        className="w-6 h-6 flex-shrink-0 opacity-50"
                      />
                      <span className={`text-[10px] font-medium uppercase ${!isWinner ? 'text-red-400' : 'text-neutral-400'}`}>
                        {!isWinner ? 'You' : 'Opp'}
                      </span>
                    </div>
                  </div>

                  {/* Reward Section (for wager mode) - only show for winner */}
                  {mode === 'wager' && matchCreated && isWinner && (
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

                  {/* Loss message for wager mode */}
                  {mode === 'wager' && matchCreated && !isWinner && (
                    <div className="mb-3 text-center">
                      <p className="text-[10px] font-medium text-neutral-400 uppercase mb-1">Result</p>
                      <div className="bg-gradient-to-r from-red-600/20 to-red-400/20 border border-red-500/30 rounded-lg py-2 px-3">
                        <p className="text-lg font-bold text-red-400">
                          -{getStakeTierInfo(selectedStakeTier).stake} SOL
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Status Text (for practice or other info) */}
                  {mode === 'practice' && (
                    <p className="text-center text-neutral-300 text-[11px] mb-3 opacity-80">
                      {statusText}
                    </p>
                  )}
                </>
              );
            })()}

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
