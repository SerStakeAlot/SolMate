# SolMate Educational Videos

Remotion-powered educational chess videos for SolMate.

## Setup

```bash
cd remotion
npm install
```

## Development

Start the Remotion Studio to preview videos:

```bash
npm start
```

This opens a browser preview at `http://localhost:3000` where you can scrub through the video timeline.

## Building Videos

Render to MP4:

```bash
npm run build
```

Output will be in `remotion/out/how-pieces-move.mp4`

## Project Structure

```
remotion/
├── src/
│   ├── index.ts           # Remotion entry point
│   ├── Root.tsx           # Composition registry
│   ├── components/        # Reusable components
│   │   ├── Background.tsx # Animated background
│   │   ├── ChessBoard.tsx # Chess board with highlights
│   │   └── AnimatedText.tsx # Text animations
│   ├── scenes/            # Individual scenes
│   │   ├── TitleScene.tsx
│   │   ├── PieceScenes.tsx
│   │   └── ClosingScene.tsx
│   ├── videos/            # Main compositions
│   │   └── HowPiecesMove.tsx
│   └── styles/
│       └── theme.ts       # Colors, fonts, constants
└── out/                   # Rendered videos
```

## Video Specifications

- **Resolution**: 1920x1080 (Full HD)
- **Frame Rate**: 30fps
- **Duration**: ~30 seconds
- **Format**: MP4 (H.264)

## Creating New Videos

1. Create scene components in `src/scenes/`
2. Create main composition in `src/videos/`
3. Register in `Root.tsx`
4. Add build script to `package.json`

## Style Guide

All videos follow SolMate's brand:

- **Colors**: Solana purple (#9945FF), green (#14F195)
- **Background**: Dark gradient with subtle grid
- **Font**: Inter (clean, modern)
- **Motion**: Smooth springs, confident easing
- **Board**: Purple/white squares with glow effects

## Available Compositions

| ID | Description | Duration |
|----|-------------|----------|
| `HowPiecesMove` | Beginner piece movement guide | 30s |

## Future Videos

- Opening strategies (Italian Game, Sicilian, etc.)
- Tactical patterns (forks, pins, skewers)
- Checkmate patterns
- Endgame techniques
