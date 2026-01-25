"use client";

import { useState, useEffect } from "react";
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

const difficultyColors: Record<Difficulty, string> = {
  beginner: 'bg-green-500/20 text-green-400 border-green-500/30',
  intermediate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  advanced: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const categoryIcons: Record<Category, React.ReactNode> = {
  basics: <BookOpen className="h-5 w-5" />,
  openings: <Castle className="h-5 w-5" />,
  tactics: <Target className="h-5 w-5" />,
  endgames: <Crown className="h-5 w-5" />,
};

const categoryTitles: Record<Category, string> = {
  basics: 'Chess Basics',
  openings: 'Opening Repertoire',
  tactics: 'Tactical Patterns',
  endgames: 'Endgame Essentials',
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
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
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
          backgroundColor: '#171717',
          borderRadius: '1rem',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 10 }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              borderRadius: '9999px',
              border: 'none',
              cursor: 'pointer',
            }}
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
              <div style={{ width: '5rem', height: '5rem', margin: '0 auto 1rem', borderRadius: '9999px', backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Play style={{ height: '2.5rem', width: '2.5rem', color: 'white', marginLeft: '0.25rem' }} />
              </div>
              <p style={{ color: 'white', fontWeight: 600, fontSize: '1.125rem' }}>{lesson.title}</p>
              <p style={{ color: '#a1a1aa', fontSize: '0.875rem', marginTop: '0.5rem' }}>Video coming soon!</p>
            </div>
          )}
        </div>
        
        <div style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', marginBottom: '0.5rem' }}>{lesson.title}</h3>
          <p style={{ color: '#a1a1aa', marginBottom: '1rem' }}>{lesson.description}</p>
          
          {lesson.moves && (
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#14F195', marginBottom: '0.5rem' }}>Key Moves:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {lesson.moves.map((move, idx) => (
                  <span key={idx} style={{ padding: '0.25rem 0.75rem', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '0.5rem', fontFamily: 'monospace', fontSize: '0.875rem', color: 'white' }}>
                    {move}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {lesson.keyPoints && (
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#9945FF', marginBottom: '0.5rem' }}>Key Points:</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {lesson.keyPoints.map((point, idx) => (
                  <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.875rem', color: '#d4d4d4' }}>
                    <CheckCircle style={{ height: '1rem', width: '1rem', color: '#14F195', marginTop: '0.125rem', flexShrink: 0 }} />
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

function LessonCard({ lesson, onWatch }: LessonCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <motion.div
      layout
      className="glass-card rounded-xl overflow-hidden hover:border-solana-purple/30 transition-all"
    >
      <div 
        className="p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h3 className="font-semibold text-white truncate">{lesson.title}</h3>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${difficultyColors[lesson.difficulty]}`}>
                {lesson.difficulty}
              </span>
              {lesson.videoId && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-solana-green/20 text-solana-green border border-solana-green/30 flex items-center gap-1">
                  <Play className="h-3 w-3" />
                  Video
                </span>
              )}
            </div>
            <p className="text-sm text-neutral-400 line-clamp-2">{lesson.description}</p>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-5 w-5 text-neutral-500" />
          </motion.div>
        </div>
        
        {lesson.moves && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {lesson.moves.slice(0, 3).map((move, idx) => (
              <span key={idx} className="px-2 py-0.5 bg-white/5 rounded text-xs font-mono text-neutral-300">
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
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-white/5 pt-4">
              {lesson.keyPoints && (
                <ul className="space-y-2 mb-4">
                  {lesson.keyPoints.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-neutral-300">
                      <CheckCircle className="h-4 w-4 text-solana-green mt-0.5 flex-shrink-0" />
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
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-solana-purple to-solana-green text-white font-semibold py-2.5 px-4 rounded-xl transition-all"
              >
                <Play className="h-4 w-4" />
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
  
  return (
    <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="font-display text-2xl sm:text-4xl font-bold mb-2">
          <span className="text-gradient">Learn Chess</span>
        </h1>
        <p className="text-neutral-400 text-sm sm:text-base font-medium">
          Master the game from openings to endgames
        </p>
      </motion.div>
      
      {/* Category Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <div className="flex flex-wrap gap-2 p-1 bg-white/5 rounded-xl w-fit">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                activeCategory === category
                  ? 'bg-gradient-to-r from-solana-purple to-solana-green text-white shadow-lg'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {categoryIcons[category]}
              <span className="hidden sm:inline">{categoryTitles[category]}</span>
            </button>
          ))}
        </div>
      </motion.div>
      
      {/* Difficulty Filter */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-6 flex items-center gap-2"
      >
        <div className="flex gap-1">
          {(['all', 'beginner', 'intermediate', 'advanced'] as const).map((diff) => (
            <button
              key={diff}
              onClick={() => setDifficultyFilter(diff)}
              className={`px-3 py-1 text-sm rounded-lg transition-all ${
                difficultyFilter === diff
                  ? diff === 'all' 
                    ? 'bg-white/20 text-white'
                    : difficultyColors[diff as Difficulty]
                  : 'text-neutral-500 hover:text-white hover:bg-white/5'
              }`}
            >
              {diff === 'all' ? 'All' : diff.charAt(0).toUpperCase() + diff.slice(1)}
            </button>
          ))}
        </div>
      </motion.div>
      
      {/* Category Header */}
      <motion.div
        key={activeCategory}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-6"
      >
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          {categoryIcons[activeCategory]}
          {categoryTitles[activeCategory]}
        </h2>
        <p className="text-neutral-400 text-sm mt-1">
          {categoryDescriptions[activeCategory]}
        </p>
      </motion.div>
      
      {/* Lessons Grid */}
      <motion.div
        key={`${activeCategory}-${difficultyFilter}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
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
          <div className="col-span-full py-12 text-center">
            <p className="text-neutral-500">No lessons found for this filter.</p>
          </div>
        )}
      </motion.div>
      
      {/* Coming Soon Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-12 p-6 glass-card rounded-2xl"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-yellow-500/20">
            <Star className="h-5 w-5 text-yellow-400" />
          </div>
          <h3 className="text-lg font-bold text-white">Coming Soon</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
            <Lock className="h-5 w-5 text-neutral-500" />
            <div>
              <p className="text-sm font-medium text-neutral-300">Interactive Puzzles</p>
              <p className="text-xs text-neutral-500">Practice tactics with real puzzles</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
            <Lock className="h-5 w-5 text-neutral-500" />
            <div>
              <p className="text-sm font-medium text-neutral-300">Progress Tracking</p>
              <p className="text-xs text-neutral-500">Track your learning journey</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
            <Lock className="h-5 w-5 text-neutral-500" />
            <div>
              <p className="text-sm font-medium text-neutral-300">Video Lessons</p>
              <p className="text-xs text-neutral-500">Animated opening tutorials</p>
            </div>
          </div>
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
    </main>
  );
}
