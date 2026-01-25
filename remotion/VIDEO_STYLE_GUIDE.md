# SolMate Video Style Guide

This guide ensures consistency across all educational videos in the SolMate Learn section.

## 🎨 Color Palette

```typescript
const COLORS = {
  purple: '#9945FF',      // Primary - Solana purple
  green: '#14F195',       // Secondary - Solana green  
  cyan: '#00D4FF',        // Accent - highlights
  gold: '#FFD700',        // Special emphasis (center squares, etc.)
  red: '#ff4444',         // Danger/warnings (check, bad moves)
  bgDark: '#0a0a0a',      // Background base
  bgGradientStart: '#1a1025',  // Background gradient
  boardLight: '#e8e4f0',  // Light board squares
  boardDark: '#6b5b95',   // Dark board squares (purple-tinted)
};
```

## 📐 Video Specifications

- **Resolution:** 1920 x 1080 (Full HD)
- **Frame Rate:** 30 fps
- **Duration:** 22-35 seconds typical
- **Codec:** H264
- **Output format:** MP4

## 🎬 Scene Structure

Every video follows this structure:

### 1. Title Scene (2-3 seconds / 60-90 frames)
- Dark gradient background with subtle grid overlay
- Mini chessboard icon or relevant visual (fades in first)
- Main title with gradient text (purple → green)
- Subtitle in muted gray (#a1a1aa)

### 2. Content Scenes (3-5 seconds each / 90-150 frames)
- Centered chessboard with pieces
- InfoBox with title + subtitle
- Animated piece movements using spring()
- Highlighted squares for emphasis

### 3. Closing Scene (2-3 seconds / 60-90 frames)
- SolMate logo with purple glow
- Tagline text
- Chess pawn emoji (♟️)

## 🧩 Required Components

### Background
```tsx
<AbsoluteFill>
  {/* Radial gradient */}
  <div style={{
    background: `radial-gradient(ellipse at 50% 30%, ${COLORS.bgGradientStart} 0%, ${COLORS.bgDark} 70%)`,
  }} />
  {/* Subtle grid overlay */}
  <div style={{
    backgroundImage: `linear-gradient(rgba(153, 69, 255, 0.03) 1px, transparent 1px),
                     linear-gradient(90deg, rgba(153, 69, 255, 0.03) 1px, transparent 1px)`,
    backgroundSize: '50px 50px',
  }} />
  {/* Purple glow blob */}
  <div style={{
    background: `radial-gradient(ellipse, ${COLORS.purple}20 0%, transparent 70%)`,
    filter: 'blur(60px)',
  }} />
</AbsoluteFill>
```

### ChessBoard
- Square size: 56px
- Board size: 448px (8 × 56)
- Border radius: 12px
- Box shadow: `0 0 60px ${COLORS.purple}40, 0 20px 40px rgba(0,0,0,0.5)`
- Optional features:
  - `highlightedSquares` - purple overlay (0.4 opacity)
  - `glowSquares` - gold pulsing glow
  - `dangerSquares` - red pulsing overlay
  - `shieldSquare` - green protective glow

### InfoBox
- Position: Bottom center or right side of board
- Background: `rgba(0, 0, 0, 0.85)` with backdrop blur
- Border: `2px solid ${COLORS.purple}`
- Border radius: 16px
- Padding: 24px 48px
- Title: 36px, white, font-weight 700
- Subtitle: 22px, green (#14F195)

### Closing Scene Logo
```tsx
<Img
  src={staticFile('images/solmate-logo.png')}
  style={{
    height: 120,
    filter: `drop-shadow(0 0 40px ${COLORS.purple}80)`,
  }}
/>
```

## 🎭 Animation Guidelines

### Spring Configurations
```typescript
// Standard element appearance
spring({ frame, fps, config: { damping: 20, stiffness: 100 } })

// Bouncy emphasis
spring({ frame, fps, config: { damping: 12, stiffness: 80 } })

// Quick snap
spring({ frame, fps, config: { damping: 15, stiffness: 150 } })
```

### Piece Movement
- Duration: 20 frames (~0.67 seconds)
- Use spring() for natural motion
- Show trail or highlight on destination square

### Pulsing Effects
```typescript
// Gentle pulse for highlights
const pulse = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.3, 0.6]);

// Faster pulse for danger
const dangerPulse = interpolate(Math.sin(frame * 0.15), [-1, 1], [0.4, 0.7]);
```

### Text Fade-ins
- Stagger elements by 15-20 frames
- Use spring() for opacity and translateY/translateX

## ♟️ Chess Piece Symbols

```typescript
const PIECES = {
  // White pieces
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  // Black pieces
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};
```

## 📁 File Organization

```
remotion/
├── src/
│   ├── Root.tsx              # Composition registry
│   ├── videos/
│   │   ├── HowPiecesMove.tsx
│   │   ├── SpecialMoves.tsx
│   │   ├── CheckmateBasics.tsx
│   │   ├── ChessNotation.tsx
│   │   ├── OpeningPrinciples.tsx
│   │   └── [NewVideo].tsx    # Add new videos here
│   ├── components/           # Shared components (optional)
│   ├── scenes/               # Shared scenes (optional)
│   └── styles/
│       └── theme.ts          # Color constants
├── public/
│   └── images/
│       └── solmate-logo.png  # Logo for closing scenes
└── VIDEO_STYLE_GUIDE.md      # This file
```

## 🔧 Adding a New Video

### 1. Create the video file
```bash
# Create new file in remotion/src/videos/
touch remotion/src/videos/NewTopic.tsx
```

### 2. Register in Root.tsx
```tsx
import { NewTopic } from "./videos/NewTopic";

<Composition
  id="NewTopic"
  component={NewTopic}
  durationInFrames={900}  // Adjust as needed
  fps={30}
  width={1920}
  height={1080}
/>
```

### 3. Render to MP4
```bash
cd remotion
npx remotion render NewTopic ../public/videos/new-topic.mp4 --codec h264
```

### 4. Add to Learn page
In `app/learn/page.tsx`:
1. Add `videoId: 'NewTopic'` to the lesson object
2. Add mapping in `videoFiles`: `'NewTopic': '/videos/new-topic.mp4'`

## 📝 Typography

- **Font Family:** `'Inter, system-ui, sans-serif'`
- **Title:** 72px, font-weight 800, gradient text
- **Scene Title:** 36-42px, font-weight 700, white
- **Subtitle:** 22-32px, regular weight, green or gray
- **Notation Text:** monospace font, green (#14F195)

## ✅ Quality Checklist

Before rendering a new video:

- [ ] Uses consistent color palette
- [ ] Has title scene with gradient text
- [ ] Has closing scene with SolMate logo
- [ ] Piece movements are animated (not static)
- [ ] InfoBox appears with spring animation
- [ ] Duration is appropriate (22-35 seconds)
- [ ] All text is readable and well-positioned
- [ ] Highlights/glows pulse gently
- [ ] Board has proper shadow and styling

## 🎯 Video Topics Completed

1. ✅ How Pieces Move (`HowPiecesMove`)
2. ✅ Special Moves (`SpecialMoves`) - Castling, En Passant, Promotion
3. ✅ Check, Checkmate & Stalemate (`CheckmateBasics`)
4. ✅ Chess Notation (`ChessNotation`)
5. ✅ Opening Principles (`OpeningPrinciples`)
6. ✅ Italian Game (`ItalianGame`) - Classic opening walkthrough

## 📋 Planned Videos (from Learn page)

### Tactics
- [ ] Forks
- [ ] Pins & Skewers
- [ ] Discovered Attacks
- [ ] Back Rank Mate
- [ ] Deflection & Decoy

### Endgames
- [ ] King & Pawn Endgames
- [ ] Rook Endgames
- [ ] Opposition
- [ ] Lucena Position
- [ ] Philidor Position

### Openings (optional video intros)
- [x] Italian Game
- [ ] Sicilian Defense
- [ ] Queen's Gambit
- [ ] etc.
