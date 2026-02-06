"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BookOpen, 
  ChevronDown,
  Play, 
  Crown, 
  Target, 
  Castle,
  CheckCircle,
  Lock,
  Star,
  X
} from "lucide-react";

type Difficulty = 'beginner' | 'intermediate' | 'advanced';
type Category = 'basics' | 'openings' | 'tactics' | 'endgames';

interface Lesson {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  category: Category;
  moves?: string[];
  keyPoints?: string[];
  videoId?: string; // For future Remotion video integration
}

/* ── Particle Field ──────────────────────────────────── */
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const particles: { x: number; y: number; vx: number; vy: number; r: number; color: string }[] = [];
    const colors = [
      'rgba(0,255,163,0.12)',
      'rgba(153,69,255,0.12)',
      'rgba(0,212,255,0.08)',
    ];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 20; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        r: Math.random() * 1.5 + 0.5,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  );
}

const OPENINGS: Lesson[] = [
  {
    id: 'italian-game',
    title: 'Italian Game',
    description: 'One of the oldest and most classical openings. Develops pieces quickly while controlling the center.',
    difficulty: 'beginner',
    category: 'openings',
    moves: ['1. e4 e5', '2. Nf3 Nc6', '3. Bc4'],
    keyPoints: [
      'Controls the center with e4',
      'Develops knight to active square f3',
      'Bishop targets weak f7 pawn',
      'Prepares quick castling'
    ],
    videoId: 'ItalianGame',
  },
  {
    id: 'sicilian-defense',
    title: 'Sicilian Defense',
    description: 'The most popular response to 1.e4. Creates an asymmetrical pawn structure and fighting chances for Black.',
    difficulty: 'intermediate',
    category: 'openings',
    moves: ['1. e4 c5'],
    keyPoints: [
      'Black fights for center control without mirroring',
      'Creates imbalanced positions',
      'Sharp tactical play',
      'Many variations: Najdorf, Dragon, Scheveningen'
    ],
  },
  {
    id: 'queens-gambit',
    title: "Queen's Gambit",
    description: 'A classical opening that offers a pawn sacrifice to gain central control. Made famous by the Netflix series.',
    difficulty: 'intermediate',
    category: 'openings',
    moves: ['1. d4 d5', '2. c4'],
    keyPoints: [
      'Gambit pawn to control center',
      'If dxc4, White gains central dominance',
      'Leads to strategic middlegames',
      'Declined variation is very solid'
    ],
  },
  {
    id: 'ruy-lopez',
    title: 'Ruy Lopez (Spanish Game)',
    description: 'Named after a Spanish priest. One of the most respected openings at all levels.',
    difficulty: 'intermediate',
    category: 'openings',
    moves: ['1. e4 e5', '2. Nf3 Nc6', '3. Bb5'],
    keyPoints: [
      'Pressures the knight defending e5',
      'Highly strategic opening',
      'Rich in theory and ideas',
      'Played by world champions for centuries'
    ],
  },
  {
    id: 'french-defense',
    title: 'French Defense',
    description: 'A solid defense that creates a pawn chain. Black accepts a cramped position for counterattacking chances.',
    difficulty: 'intermediate',
    category: 'openings',
    moves: ['1. e4 e6', '2. d4 d5'],
    keyPoints: [
      'Solid pawn structure',
      'Black attacks White\'s center with ...c5',
      'Light-squared bishop can be problematic',
      'Counterattacking chances on queenside'
    ],
  },
  {
    id: 'kings-indian',
    title: 'King\'s Indian Defense',
    description: 'An aggressive hypermodern defense. Black allows White to build a big center, then attacks it.',
    difficulty: 'advanced',
    category: 'openings',
    moves: ['1. d4 Nf6', '2. c4 g6', '3. Nc3 Bg7'],
    keyPoints: [
      'Fianchettoed bishop is powerful',
      'Black launches kingside attack',
      'Famous for tactical complications',
      'Favorite of Kasparov and Fischer'
    ],
  },
  {
    id: 'london-system',
    title: 'London System',
    description: 'A solid, easy-to-learn system. The same setup works against almost any Black response.',
    difficulty: 'beginner',
    category: 'openings',
    moves: ['1. d4 d5', '2. Bf4', '3. e3', '4. Nf3'],
    keyPoints: [
      'Simple and consistent setup',
      'Bishop goes to f4 early',
      'Solid pawn structure',
      'Great for beginners to learn'
    ],
  },
  {
    id: 'caro-kann',
    title: 'Caro-Kann Defense',
    description: 'A solid and reliable defense. Unlike the French, the light-squared bishop is not blocked.',
    difficulty: 'intermediate',
    category: 'openings',
    moves: ['1. e4 c6', '2. d4 d5'],
    keyPoints: [
      'Very solid pawn structure',
      'Light-squared bishop stays active',
      'Less cramped than French Defense',
      'Favorite of Karpov and Anand'
    ],
  },
];

const BASICS: Lesson[] = [
  {
    id: 'piece-movement',
    title: 'How Pieces Move',
    description: 'Learn how each chess piece moves across the board.',
    difficulty: 'beginner',
    category: 'basics',
    videoId: 'HowPiecesMove', // Remotion video ID
    keyPoints: [
      'King: One square in any direction',
      'Queen: Any number of squares in any direction',
      'Rook: Any number of squares horizontally or vertically',
      'Bishop: Any number of squares diagonally',
      'Knight: L-shape (2+1 squares), can jump over pieces',
      'Pawn: Forward one square (two on first move), captures diagonally'
    ],
  },
  {
    id: 'special-moves',
    title: 'Special Moves',
    description: 'Master castling, en passant, and pawn promotion.',
    difficulty: 'beginner',
    category: 'basics',
    videoId: 'SpecialMoves', // Remotion video ID
    keyPoints: [
      'Castling: King moves 2 squares toward rook, rook jumps over',
      'Cannot castle through check or if king/rook has moved',
      'En passant: Capture a pawn that just moved 2 squares',
      'Promotion: Pawn reaching 8th rank becomes any piece (usually Queen)'
    ],
  },
  {
    id: 'checkmate-basics',
    title: 'Check, Checkmate & Stalemate',
    description: 'Understanding how games end.',
    difficulty: 'beginner',
    category: 'basics',
    videoId: 'CheckmateBasics', // Remotion video ID
    keyPoints: [
      'Check: King is under attack, must be addressed',
      'Checkmate: King is in check with no escape - game over!',
      'Stalemate: Not in check but no legal moves - draw',
      'Always look for checkmate opportunities'
    ],
  },
  {
    id: 'chess-notation',
    title: 'Chess Notation',
    description: 'Read and write chess moves like a pro.',
    difficulty: 'beginner',
    category: 'basics',
    videoId: 'ChessNotation', // Remotion video ID
    keyPoints: [
      'Files: a-h (left to right from White\'s view)',
      'Ranks: 1-8 (bottom to top from White\'s view)',
      'Pieces: K=King, Q=Queen, R=Rook, B=Bishop, N=Knight',
      'Pawns use only the destination square (e.g., e4)',
      'Captures use "x" (e.g., Nxe5)',
      'Check = +, Checkmate = #'
    ],
  },
  {
    id: 'opening-principles',
    title: 'Opening Principles',
    description: 'The golden rules for starting your games.',
    difficulty: 'beginner',
    category: 'basics',
    videoId: 'OpeningPrinciples', // Remotion video ID
    keyPoints: [
      'Control the center (e4, d4, e5, d5)',
      'Develop your pieces (knights and bishops first)',
      'Castle early for king safety',
      'Don\'t move the same piece twice',
      'Don\'t bring your queen out too early',
      'Connect your rooks'
    ],
  },
];

const TACTICS: Lesson[] = [
  {
    id: 'forks',
    title: 'Forks',
    description: 'Attack two or more pieces at once with a single piece.',
    difficulty: 'beginner',
    category: 'tactics',
    keyPoints: [
      'Knights are the best forking pieces',
      'Fork the king and queen for material gain',
      'Pawns can fork too!',
      'Always check for fork opportunities after each move'
    ],
  },
  {
    id: 'pins-skewers',
    title: 'Pins & Skewers',
    description: 'Use line pieces to attack multiple targets on the same line.',
    difficulty: 'intermediate',
    category: 'tactics',
    keyPoints: [
      'Pin: Piece cannot move without exposing more valuable piece behind',
      'Absolute pin: Piece is pinned to the king (illegal to move)',
      'Skewer: Opposite of pin - more valuable piece is in front',
      'Bishops, rooks, and queens create pins and skewers'
    ],
  },
  {
    id: 'discovered-attacks',
    title: 'Discovered Attacks',
    description: 'Move one piece to unleash an attack from another.',
    difficulty: 'intermediate',
    category: 'tactics',
    keyPoints: [
      'Moving piece can also attack (double attack)',
      'Discovered check is very powerful',
      'Double check forces king to move',
      'Look for pieces blocking your attacking lines'
    ],
  },
  {
    id: 'back-rank-mate',
    title: 'Back Rank Mate',
    description: 'Exploit a trapped king on the back rank.',
    difficulty: 'intermediate',
    category: 'tactics',
    keyPoints: [
      'King trapped by own pawns on back rank',
      'Rook or queen delivers checkmate',
      'Create "luft" (escape square) to prevent this',
      'Very common in beginner and intermediate games'
    ],
  },
  {
    id: 'removing-defender',
    title: 'Removing the Defender',
    description: 'Eliminate the piece protecting your target.',
    difficulty: 'advanced',
    category: 'tactics',
    keyPoints: [
      'Identify which piece defends the target',
      'Capture, deflect, or distract the defender',
      'Often involves a sacrifice',
      'Look for overloaded defenders'
    ],
  },
];

const ENDGAMES: Lesson[] = [
  {
    id: 'king-queen-mate',
    title: 'King + Queen vs King',
    description: 'The most basic checkmate pattern every player must know.',
    difficulty: 'beginner',
    category: 'endgames',
    keyPoints: [
      'Drive the enemy king to the edge',
      'Use your king to help restrict',
      'Avoid stalemate!',
      'Should be mate in under 10 moves'
    ],
  },
  {
    id: 'king-rook-mate',
    title: 'King + Rook vs King',
    description: 'A fundamental endgame checkmate technique.',
    difficulty: 'beginner',
    category: 'endgames',
    keyPoints: [
      'Use the "box" or "staircase" method',
      'Push enemy king to the edge rank by rank',
      'Your king must help',
      'Slightly more complex than K+Q mate'
    ],
  },
  {
    id: 'pawn-endgames',
    title: 'Pawn Endgames & Opposition',
    description: 'When only kings and pawns remain, these principles decide the game.',
    difficulty: 'intermediate',
    category: 'endgames',
    keyPoints: [
      'Opposition: Kings facing each other with one square between',
      'Having opposition often means winning',
      'King in front of pawn = winning',
      'Know the "square rule" for catching pawns'
    ],
  },
  {
    id: 'rook-endgames',
    title: 'Rook Endgame Basics',
    description: 'Rook endings are the most common endgame type.',
    difficulty: 'advanced',
    category: 'endgames',
    keyPoints: [
      'Rooks belong behind passed pawns',
      'Active king is crucial',
      'Lucena position = winning technique',
      'Philidor position = drawing technique'
    ],
  },
];

const ALL_LESSONS = [...BASICS, ...OPENINGS, ...TACTICS, ...ENDGAMES];

const categoryLabels: Record<Category, string> = {
  basics: '📖 Basics',
  openings: '🏰 Openings',
  tactics: '🎯 Tactics',
  endgames: '👑 Endgames',
};

const categorySectionTitles: Record<Category, string> = {
  basics: '📖 Chess Basics',
  openings: '🏰 Opening Repertoire',
  tactics: '🎯 Tactical Patterns',
  endgames: '👑 Endgame Essentials',
};

const categoryDescriptions: Record<Category, string> = {
  basics: 'Master the fundamentals of chess',
  openings: 'Learn powerful opening strategies',
  tactics: 'Sharpen your tactical vision',
  endgames: 'Convert your advantages',
};

interface VideoModalProps {
  lesson: Lesson;
  onClose: () => void;
}

// Map videoId to actual video files
const videoFiles: Record<string, string> = {
  'HowPiecesMove': '/videos/how-pieces-move.mp4',
  'SpecialMoves': '/videos/special-moves.mp4',
  'CheckmateBasics': '/videos/checkmate-basics.mp4',
  'ChessNotation': '/videos/chess-notation.mp4',
  'OpeningPrinciples': '/videos/opening-principles.mp4',
  'ItalianGame': '/videos/italian-game.mp4',
};

function VideoModal({ lesson, onClose }: VideoModalProps) {
  const [mounted, setMounted] = useState(false);
  const hasVideo = !!lesson.videoId;
  const videoSrc = lesson.videoId ? videoFiles[lesson.videoId] : null;
  
  useEffect(() => {
    setMounted(true);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);
  
  const modalContent = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backgroundColor: 'rgba(7,7,14,0.95)',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '48rem',
          backgroundColor: '#0f0f1a',
          borderRadius: '20px',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 10 }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem',
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)')}
          >
            <X style={{ height: '1.25rem', width: '1.25rem', color: 'white' }} />
          </button>
        </div>
        
        {/* Video Area */}
        <div style={{ aspectRatio: '16/9', backgroundColor: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
          {hasVideo && videoSrc ? (
            <video
              src={videoSrc}
              controls
              autoPlay
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              controlsList="nodownload"
            >
              Your browser does not support the video tag.
            </video>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '5rem', height: '5rem', margin: '0 auto 1rem', borderRadius: '9999px', backgroundColor: 'rgba(153,69,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>
                ♟
              </div>
              <p style={{ color: 'white', fontWeight: 600, fontSize: '1.125rem' }}>{lesson.title}</p>
              <p style={{ color: '#6b6b80', fontSize: '0.875rem', marginTop: '0.5rem' }}>Video coming soon!</p>
            </div>
          )}
        </div>
        
        <div style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#e8e8f0', marginBottom: '0.75rem', fontFamily: 'Outfit, sans-serif' }}>{lesson.title}</h3>
          
          {lesson.moves && (
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#00ffa3', marginBottom: '0.5rem', fontFamily: "'Space Mono', monospace" }}>Key Moves:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {lesson.moves.map((move, idx) => (
                  <span key={idx} style={{
                    padding: '3px 10px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '6px',
                    fontFamily: "'Space Mono', monospace",
                    fontSize: '12px',
                    color: '#a0a0b8',
                  }}>
                    {move}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {lesson.keyPoints && (
            <div>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#9945ff', marginBottom: '0.5rem', fontFamily: "'Space Mono', monospace" }}>Key Points:</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {lesson.keyPoints.map((point, idx) => (
                  <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '13px', color: '#a0a0b8' }}>
                    <CheckCircle style={{ height: '1rem', width: '1rem', color: '#00ffa3', marginTop: '0.125rem', flexShrink: 0 }} />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
  
  // Use portal to render modal at document body level
  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}

interface LessonCardProps {
  lesson: Lesson;
  onWatch: () => void;
}

const diffBadgeStyle: Record<Difficulty, React.CSSProperties> = {
  beginner: { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e' },
  intermediate: { background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)', color: '#eab308' },
  advanced: { background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.2)', color: '#ff5050' },
};

function LessonCard({ lesson, onWatch }: LessonCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <motion.div
      layout
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px',
        overflow: 'hidden',
        transition: 'border-color 0.2s, transform 0.2s, box-shadow 0.2s',
      }}
      whileHover={{
        borderColor: 'rgba(153,69,255,0.2)',
        y: -2,
        boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
      }}
    >
      <div 
        style={{ padding: '18px 20px', cursor: 'pointer' }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#e8e8f0', margin: 0, fontFamily: 'Outfit, sans-serif' }}>{lesson.title}</h3>
              <span style={{
                padding: '3px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: "'Space Mono', monospace",
                textTransform: 'capitalize',
                ...diffBadgeStyle[lesson.difficulty],
              }}>
                {lesson.difficulty}
              </span>
              {lesson.videoId && (
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  fontFamily: "'Space Mono', monospace",
                  background: 'rgba(0,255,163,0.08)',
                  border: '1px solid rgba(0,255,163,0.15)',
                  color: '#00ffa3',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  ▶ Video
                </span>
              )}
            </div>
            <p style={{ fontSize: '13px', color: '#6b6b80', lineHeight: 1.5, margin: 0, fontFamily: 'Outfit, sans-serif' }}>{lesson.description}</p>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{ flexShrink: 0 }}
          >
            <ChevronDown style={{ height: '20px', width: '20px', color: '#444' }} />
          </motion.div>
        </div>
        
        {lesson.moves && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
            {lesson.moves.slice(0, 3).map((move, idx) => (
              <span key={idx} style={{
                padding: '3px 10px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '6px',
                fontFamily: "'Space Mono', monospace",
                fontSize: '12px',
                color: '#a0a0b8',
              }}>
                {move}
              </span>
            ))}
          </div>
        )}
      </div>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 20px 18px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '16px' }}>
              {lesson.keyPoints && (
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {lesson.keyPoints.map((point, idx) => (
                    <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: '#a0a0b8', fontFamily: 'Outfit, sans-serif' }}>
                      <CheckCircle style={{ height: '16px', width: '16px', color: '#00ffa3', marginTop: '1px', flexShrink: 0 }} />
                      {point}
                    </li>
                  ))}
                </ul>
              )}
              
              <motion.button
                onClick={(e) => {
                  e.stopPropagation();
                  onWatch();
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '10px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #9945ff 0%, #00ffa3 100%)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                <Play style={{ height: '16px', width: '16px', color: 'white' }} />
                Watch Video
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function LearnPage() {
  const [activeCategory, setActiveCategory] = useState<Category>('openings');
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | 'all'>('all');
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  
  const categories: Category[] = ['basics', 'openings', 'tactics', 'endgames'];
  
  const filteredLessons = ALL_LESSONS.filter(lesson => {
    const categoryMatch = lesson.category === activeCategory;
    const difficultyMatch = difficultyFilter === 'all' || lesson.difficulty === difficultyFilter;
    return categoryMatch && difficultyMatch;
  });

  const diffPillStyle = (diff: Difficulty | 'all', isActive: boolean): React.CSSProperties => {
    if (!isActive) {
      return {
        padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
        fontFamily: "'Space Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em',
        background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: '#444',
        cursor: 'pointer', transition: 'all 0.2s',
      };
    }
    switch (diff) {
      case 'all': return {
        padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
        fontFamily: "'Space Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em',
        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)', color: '#e8e8f0',
        cursor: 'pointer', transition: 'all 0.2s',
      };
      case 'beginner': return {
        padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
        fontFamily: "'Space Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em',
        background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e',
        cursor: 'pointer', transition: 'all 0.2s',
      };
      case 'intermediate': return {
        padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
        fontFamily: "'Space Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em',
        background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.25)', color: '#eab308',
        cursor: 'pointer', transition: 'all 0.2s',
      };
      case 'advanced': return {
        padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
        fontFamily: "'Space Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em',
        background: 'rgba(255,80,80,0.15)', border: '1px solid rgba(255,80,80,0.25)', color: '#ff5050',
        cursor: 'pointer', transition: 'all 0.2s',
      };
    }
  };
  
  return (
    <main style={{ minHeight: '100vh', background: '#07070e', position: 'relative' }}>
      <ParticleField />
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 40px 80px', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '32px' }}
        >
          <h1 style={{
            color: '#e8e8f0',
            fontSize: 'clamp(28px, 4vw, 42px)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            margin: '0 0 6px',
            fontFamily: 'Outfit, sans-serif',
          }}>
            Learn Chess
          </h1>
          <p style={{ fontSize: '15px', color: '#6b6b80', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
            Master the game from openings to endgames
          </p>
        </motion.div>
        
        {/* Category Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div style={{
            display: 'inline-flex',
            gap: '4px',
            padding: '4px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '14px',
          }}>
            {categories.map((category) => {
              const isActive = activeCategory === category;
              return (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: isActive ? 700 : 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: 'none',
                    fontFamily: 'Outfit, sans-serif',
                    background: isActive ? 'linear-gradient(135deg, #00ffa3 0%, #00d4ff 50%, #9945ff 100%)' : 'transparent',
                    color: isActive ? '#07070e' : '#6b6b80',
                    WebkitTextFillColor: isActive ? '#07070e' : undefined,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = '#a0a0b8';
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = '#6b6b80';
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  {categoryLabels[category]}
                </button>
              );
            })}
          </div>
        </motion.div>
        
        {/* Difficulty Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          style={{ marginTop: '16px', display: 'flex', gap: '6px', marginBottom: '24px' }}
        >
          {(['all', 'beginner', 'intermediate', 'advanced'] as const).map((diff) => (
            <button
              key={diff}
              onClick={() => setDifficultyFilter(diff)}
              style={diffPillStyle(diff, difficultyFilter === diff)}
            >
              {diff === 'all' ? 'ALL' : diff.toUpperCase()}
            </button>
          ))}
        </motion.div>
        
        {/* Category Header */}
        <motion.div
          key={activeCategory}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ marginBottom: '20px' }}
        >
          <h2 style={{
            fontSize: '14px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#9945ff',
            fontFamily: "'Space Mono', monospace",
            margin: 0,
          }}>
            {categorySectionTitles[activeCategory]}
          </h2>
          <p style={{ fontSize: '13px', color: '#6b6b80', marginTop: '4px', marginBottom: 0, fontFamily: 'Outfit, sans-serif' }}>
            {categoryDescriptions[activeCategory]}
          </p>
        </motion.div>
        
        {/* Lessons Grid */}
        <motion.div
          key={`${activeCategory}-${difficultyFilter}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '12px',
          }}
        >
          {filteredLessons.map((lesson, idx) => (
            <motion.div
              key={lesson.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <LessonCard 
                lesson={lesson} 
                onWatch={() => setSelectedLesson(lesson)}
              />
            </motion.div>
          ))}
          
          {filteredLessons.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '48px 0', textAlign: 'center' }}>
              <p style={{ color: '#444', fontFamily: 'Outfit, sans-serif' }}>No lessons found for this filter.</p>
            </div>
          )}
        </motion.div>
        
        {/* Coming Soon Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            marginTop: '48px',
            padding: '28px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ padding: '8px', borderRadius: '12px', background: 'rgba(234,179,8,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Star style={{ height: '20px', width: '20px', color: '#eab308' }} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#e8e8f0', margin: 0, fontFamily: 'Outfit, sans-serif' }}>Coming Soon</h3>
          </div>
          <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {[
              { title: 'Interactive Puzzles', subtitle: 'Practice tactics with real puzzles' },
              { title: 'Progress Tracking', subtitle: 'Track your learning journey' },
              { title: 'Video Lessons', subtitle: 'Animated opening tutorials' },
            ].map((item) => (
              <div key={item.title} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 16px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.015)',
                border: '1px solid rgba(255,255,255,0.04)',
              }}>
                <Lock style={{ height: '18px', width: '18px', color: '#333', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: '13px', color: '#a0a0b8', margin: 0, fontFamily: 'Outfit, sans-serif' }}>{item.title}</p>
                  <p style={{ fontSize: '11px', color: '#444', margin: '2px 0 0', fontFamily: 'Outfit, sans-serif' }}>{item.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
        
        {/* Video Modal */}
        <AnimatePresence>
          {selectedLesson && (
            <VideoModal 
              lesson={selectedLesson} 
              onClose={() => setSelectedLesson(null)} 
            />
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
