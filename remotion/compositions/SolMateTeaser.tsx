import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  spring,
  Sequence,
  staticFile,
  Audio,
  Easing,
} from 'remotion';

// ============================================
// COLOR PALETTE
// ============================================
const COLORS = {
  background: '#0a0a0f',
  purple: '#9945FF',
  purpleLight: '#b388ff',
  green: '#14F195',
  gold: '#FFD700',
  white: '#ffffff',
  gray: '#a1a1aa',
  darkGray: '#1a1a24',
  cyan: '#00D4FF',
};

// ============================================
// FILM GRAIN
// ============================================
const FilmGrain: React.FC<{ opacity?: number }> = ({ opacity = 0.03 }) => {
  const frame = useCurrentFrame();
  const seed = frame % 10;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' seed='${seed}' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        pointerEvents: 'none',
      }}
    />
  );
};

// ============================================
// AMBIENT GLOW
// ============================================
const AmbientGlow: React.FC<{ intensity?: number; color?: string }> = ({
  intensity = 1,
  color = COLORS.purple
}) => {
  const frame = useCurrentFrame();
  const pulse = interpolate(Math.sin(frame * 0.03), [-1, 1], [0.7, 1.3]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(ellipse at 50% 30%, ${color}${Math.round(20 * intensity * pulse).toString(16).padStart(2, '0')} 0%, transparent 60%),
          radial-gradient(ellipse at 20% 80%, ${color}0d 0%, transparent 50%)
        `,
      }}
    />
  );
};

// ============================================
// SCENE 1: OPENING BRAND (0-4s)
// ============================================
const OpeningScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo animation
  const logoProgress = spring({
    frame: frame - 10,
    fps,
    config: { damping: 15, stiffness: 70 },
  });

  const logoScale = interpolate(logoProgress, [0, 1], [0.5, 1]);
  const logoOpacity = interpolate(frame, [10, 40], [0, 1], { extrapolateRight: 'clamp' });

  // Title animation
  const titleOpacity = interpolate(frame, [40, 60], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [40, 60], [30, 0], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Tagline
  const taglineOpacity = interpolate(frame, [60, 80], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <AmbientGlow intensity={1.5} />
      <FilmGrain opacity={0.02} />

      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          {/* Logo */}
          <div
            style={{
              opacity: logoOpacity,
              transform: `scale(${logoScale})`,
              marginBottom: 40,
              filter: `drop-shadow(0 0 60px ${COLORS.purple}88)`,
            }}
          >
            <Img
              src={staticFile('images/solmate-logo.png')}
              style={{ width: 160, height: 160, objectFit: 'contain' }}
            />
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: 96,
              fontWeight: 800,
              background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.purpleLight})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0,
              opacity: titleOpacity,
              transform: `translateY(${titleY}px)`,
              letterSpacing: -3,
            }}
          >
            SolMate
          </h1>

          {/* Tagline */}
          <p
            style={{
              fontSize: 32,
              color: COLORS.gray,
              margin: 0,
              marginTop: 20,
              opacity: taglineOpacity,
              letterSpacing: 4,
              textTransform: 'uppercase',
            }}
          >
            Competitive Chess. Real Stakes.
          </p>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 2: CHESS GAMEPLAY (4-16s)
// ============================================
const ChessGameplay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Board entrance
  const boardProgress = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 60 },
  });

  const boardScale = interpolate(boardProgress, [0, 1], [0.8, 1]);
  const boardOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  // Move animations - 19 moves spread across 20 seconds (600 frames)
  // ~31 frames per move, extra time at end for checkmate celebration
  const moveFrames = [
    25,   // 1. d4 - 0.8s
    56,   // 1... d5 - 1.9s
    87,   // 2. c4 - 2.9s (Queen's Gambit!)
    118,  // 2... e6 - 3.9s
    149,  // 3. Nc3 - 5.0s
    180,  // 3... Nf6 - 6.0s
    211,  // 4. Bg5 - 7.0s
    242,  // 4... Be7 - 8.1s
    273,  // 5. e4 - 9.1s
    304,  // 5... O-O - 10.1s
    335,  // 6. e5 - 11.2s
    366,  // 6... Nd7 - 12.2s
    397,  // 7. Bxe7 - 13.2s
    428,  // 7... Qxe7 - 14.3s
    459,  // 8. Qg4 - 15.3s
    485,  // 8... Kh8 - 16.2s
    511,  // 9. Qh5 - 17.0s
    537,  // 9... g6 - 17.9s
    563,  // 10. Qxh7# - 18.8s (CHECKMATE!)
  ];

  // Initial position
  const initialPieces: { [key: number]: string } = {
    0: '♜', 1: '♞', 2: '♝', 3: '♛', 4: '♚', 5: '♝', 6: '♞', 7: '♜',
    8: '♟', 9: '♟', 10: '♟', 11: '♟', 12: '♟', 13: '♟', 14: '♟', 15: '♟',
    48: '♙', 49: '♙', 50: '♙', 51: '♙', 52: '♙', 53: '♙', 54: '♙', 55: '♙',
    56: '♖', 57: '♘', 58: '♗', 59: '♕', 60: '♔', 61: '♗', 62: '♘', 63: '♖',
  };

  // Queen's Gambit opening followed by classic kingside mate:
  // 1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. e4 O-O 6. e5 Nd7
  // 7. Bxe7 Qxe7 8. Qg4 Kh8 9. Qh5 g6 10. Qxh7# - Classic mate on h7!
  const moves = [
    { from: 51, to: 35, notation: 'd4' },     // 1. d4
    { from: 11, to: 27, notation: 'd5' },     // 1... d5
    { from: 50, to: 34, notation: 'c4' },     // 2. c4 (Queen's Gambit!)
    { from: 12, to: 20, notation: 'e6' },     // 2... e6 (Declined)
    { from: 57, to: 42, notation: 'Nc3' },    // 3. Nc3
    { from: 6, to: 21, notation: 'Nf6' },     // 3... Nf6
    { from: 58, to: 37, notation: 'Bg5' },    // 4. Bg5
    { from: 5, to: 12, notation: 'Be7' },     // 4... Be7
    { from: 52, to: 36, notation: 'e4' },     // 5. e4
    { from: 4, to: 6, notation: 'O-O' },      // 5... O-O (castles)
    { from: 36, to: 28, notation: 'e5' },     // 6. e5 (attacks knight)
    { from: 21, to: 11, notation: 'Nd7' },    // 6... Nd7 (knight retreats)
    { from: 37, to: 12, notation: 'Bxe7' },   // 7. Bxe7 (takes bishop)
    { from: 11, to: 12, notation: 'Nxe7' },   // 7... Nxe7 (KNIGHT recaptures, not queen!)
    { from: 59, to: 22, notation: 'Qg4' },    // 8. Qg4 (attacking kingside)
    { from: 6, to: 7, notation: 'Kh8' },      // 8... Kh8 (king moves to corner)
    { from: 22, to: 31, notation: 'Qh5' },    // 9. Qh5 (threatens Qxh7#)
    { from: 14, to: 22, notation: 'g6' },     // 9... g6 (desperate defense)
    { from: 31, to: 15, notation: 'Qxh7#' },  // 10. Qxh7# CHECKMATE!
  ];

  const currentPieces = { ...initialPieces };
  const highlightedSquares: number[] = [];

  moves.forEach((move, i) => {
    const moveFrame = moveFrames[i];
    if (frame >= moveFrame + 20) {
      const piece = currentPieces[move.from];
      delete currentPieces[move.from];
      currentPieces[move.to] = piece;

      // Special handling for castling (O-O)
      if (move.notation === 'O-O' && move.from === 4 && move.to === 6) {
        // Black kingside castling: also move rook from h8 (7) to f8 (5)
        const rook = currentPieces[7];
        delete currentPieces[7];
        currentPieces[5] = rook;
      }
    }

    // Highlight the most recent move
    if (frame >= moveFrame && frame < moveFrame + 60) {
      const isCurrentMove = moves.findIndex((_, idx) => {
        const mf = moveFrames[idx];
        return frame >= mf && frame < mf + 60;
      }) === i;

      if (isCurrentMove) {
        highlightedSquares.push(move.from, move.to);
        // Also highlight rook squares for castling
        if (move.notation === 'O-O' && move.from === 4 && move.to === 6) {
          highlightedSquares.push(7, 5); // Rook h8->f8
        }
      }
    }
  });

  // Get current move notation to display
  const getCurrentMoveNotation = () => {
    const moveTexts: string[] = [];
    moves.forEach((move, i) => {
      const moveFrame = moveFrames[i];
      if (frame >= moveFrame) {
        if (i % 2 === 0) {
          moveTexts.push(`${Math.floor(i/2) + 1}. ${move.notation}`);
        } else {
          moveTexts[moveTexts.length - 1] += ` ${move.notation}`;
        }
      }
    });
    return moveTexts.join(' ');
  };

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <AmbientGlow intensity={0.8} color={COLORS.purple} />
      <FilmGrain />

      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          {/* Board */}
          <div
            style={{
              opacity: boardOpacity,
              transform: `scale(${boardScale})`,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 60px)',
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: `0 0 100px ${COLORS.purple}44, 0 30px 60px rgba(0,0,0,0.7)`,
                border: `3px solid ${COLORS.purple}33`,
              }}
            >
              {Array.from({ length: 64 }).map((_, i) => {
                const row = Math.floor(i / 8);
                const col = i % 8;
                const isLight = (row + col) % 2 === 0;

                // Highlight recent move squares
                const isHighlighted = highlightedSquares.includes(i);

                const highlightOpacity = interpolate(
                  Math.sin(frame * 0.15),
                  [-1, 1],
                  [0.3, 0.6]
                );

                // Determine piece color based on unicode character
                const piece = currentPieces[i];
                const whitePieces = ['♖', '♘', '♗', '♕', '♔', '♙'];
                const isWhitePiece = piece && whitePieces.includes(piece);

                // Create outline effect for all pieces using text shadow
                // White pieces: light color with dark outline
                // Black pieces: dark color with light outline
                const pieceColor = isWhitePiece ? '#e8e8e8' : '#2a2a2a';
                const outlineColor = isWhitePiece ? '#000000' : '#ffffff';

                // Create a strong outline using multiple text shadows
                const textOutline = `
                  -1px -1px 0 ${outlineColor},
                  1px -1px 0 ${outlineColor},
                  -1px 1px 0 ${outlineColor},
                  1px 1px 0 ${outlineColor},
                  -2px 0 0 ${outlineColor},
                  2px 0 0 ${outlineColor},
                  0 -2px 0 ${outlineColor},
                  0 2px 0 ${outlineColor}
                `.trim();

                return (
                  <div
                    key={i}
                    style={{
                      width: 60,
                      height: 60,
                      backgroundColor: isLight ? '#ffffff' : '#000000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                  >
                    {isHighlighted && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundColor: COLORS.green,
                          opacity: highlightOpacity,
                        }}
                      />
                    )}

                    {currentPieces[i] && (
                      <span
                        style={{
                          fontSize: 40,
                          color: pieceColor,
                          textShadow: textOutline,
                          position: 'relative',
                          zIndex: 1,
                          fontWeight: 'bold',
                        }}
                      >
                        {currentPieces[i]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Move notation */}
          <div
            style={{
              position: 'absolute',
              bottom: -100,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '16px 32px',
              background: `linear-gradient(135deg, ${COLORS.darkGray}, ${COLORS.background})`,
              borderRadius: 12,
              border: `2px solid ${COLORS.purple}44`,
              opacity: interpolate(frame, [30, 50], [0, 1], { extrapolateRight: 'clamp' }),
              minWidth: 450,
              textAlign: 'center',
            }}
          >
            <p
              style={{
                fontSize: 18,
                color: COLORS.green,
                margin: 0,
                marginBottom: frame > moveFrames[moveFrames.length - 1] + 20 ? 8 : 0,
                fontFamily: 'monospace',
                fontWeight: 600,
              }}
            >
              {getCurrentMoveNotation()}
            </p>
            {frame > moveFrames[moveFrames.length - 1] + 20 && (
              <p
                style={{
                  fontSize: 32,
                  color: COLORS.gold,
                  margin: 0,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: 3,
                  opacity: interpolate(
                    frame,
                    [moveFrames[moveFrames.length - 1] + 20, moveFrames[moveFrames.length - 1] + 40],
                    [0, 1],
                    { extrapolateRight: 'clamp' }
                  ),
                }}
              >
                ⚔️ CHECKMATE! ⚔️
              </p>
            )}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 3: WALLET/CRYPTO (16-24s)
// ============================================
const WalletScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Wallet card animation
  const walletProgress = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 60 },
  });

  const walletY = interpolate(walletProgress, [0, 1], [100, 0]);
  const walletOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  // SOL amount counter
  const solAmount = interpolate(frame, [30, 60], [0, 0.5], {
    extrapolateRight: 'clamp',
  });

  // Lock animation
  const lockScale = spring({
    frame: frame - 60,
    fps,
    config: { damping: 10, stiffness: 100 },
  });

  const lockOpacity = interpolate(frame, [60, 80], [0, 1], { extrapolateRight: 'clamp' });

  // Success check
  const checkOpacity = interpolate(frame, [180, 200], [0, 1], { extrapolateRight: 'clamp' });
  const checkScale = spring({
    frame: frame - 180,
    fps,
    config: { damping: 12, stiffness: 80 },
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <AmbientGlow intensity={1.2} color={COLORS.green} />
      <FilmGrain />

      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          {/* Wallet Card */}
          <div
            style={{
              opacity: walletOpacity,
              transform: `translateY(${walletY}px)`,
              background: `linear-gradient(135deg, ${COLORS.darkGray}, ${COLORS.background})`,
              borderRadius: 24,
              padding: '40px 60px',
              border: `3px solid ${COLORS.purple}44`,
              boxShadow: `0 0 100px ${COLORS.purple}33, 0 20px 60px rgba(0,0,0,0.6)`,
              marginBottom: 40,
            }}
          >
            <div style={{ fontSize: 60, marginBottom: 20 }}>👻</div>

            <h2
              style={{
                fontSize: 32,
                color: COLORS.white,
                margin: 0,
                marginBottom: 30,
                fontWeight: 700,
              }}
            >
              Connect Phantom Wallet
            </h2>

            <div
              style={{
                padding: '20px 40px',
                background: `linear-gradient(135deg, ${COLORS.purple}22, transparent)`,
                borderRadius: 16,
                border: `2px solid ${COLORS.purple}44`,
              }}
            >
              <p style={{ fontSize: 18, color: COLORS.gray, margin: 0, marginBottom: 8 }}>
                Match Stake
              </p>
              <p
                style={{
                  fontSize: 48,
                  color: COLORS.green,
                  margin: 0,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                }}
              >
                {solAmount.toFixed(2)} SOL
              </p>
            </div>
          </div>

          {/* Lock Icon */}
          <div
            style={{
              opacity: lockOpacity,
              transform: `scale(${lockScale})`,
              fontSize: 80,
              filter: `drop-shadow(0 0 30px ${COLORS.gold})`,
              marginBottom: 20,
            }}
          >
            🔒
          </div>

          {/* Check Icon */}
          {frame > 180 && (
            <div
              style={{
                opacity: checkOpacity,
                transform: `scale(${checkScale})`,
                fontSize: 100,
                filter: `drop-shadow(0 0 40px ${COLORS.green})`,
              }}
            >
              ✓
            </div>
          )}

          {/* Text */}
          <p
            style={{
              fontSize: 28,
              color: COLORS.white,
              fontWeight: 600,
              opacity: lockOpacity,
            }}
          >
            {frame < 180 ? 'Funds secured in escrow' : 'Ready to play!'}
          </p>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================
// SCENE 4: CLOSING CTA (24-30s)
// ============================================
const ClosingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: 'clamp' });
  const logoScale = spring({
    frame: frame - 20,
    fps,
    config: { damping: 15, stiffness: 70 },
  });

  const textOpacity = interpolate(frame, [50, 70], [0, 1], { extrapolateRight: 'clamp' });
  const ctaOpacity = interpolate(frame, [90, 110], [0, 1], { extrapolateRight: 'clamp' });

  const glowPulse = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.6, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <AmbientGlow intensity={1.5} />
      <FilmGrain />

      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          {/* Logo */}
          <div
            style={{
              opacity: logoOpacity,
              transform: `scale(${logoScale})`,
              marginBottom: 30,
              filter: `drop-shadow(0 0 ${60 * glowPulse}px ${COLORS.purple}88)`,
            }}
          >
            <Img
              src={staticFile('images/solmate-logo.png')}
              style={{ width: 140, height: 140, objectFit: 'contain' }}
            />
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: COLORS.white,
              margin: 0,
              marginBottom: 20,
              opacity: textOpacity,
              letterSpacing: -2,
            }}
          >
            SolMate
          </h1>

          {/* Tagline */}
          <p
            style={{
              fontSize: 28,
              color: COLORS.purple,
              margin: 0,
              marginBottom: 40,
              opacity: textOpacity,
              letterSpacing: 2,
            }}
          >
            Play Smart. Win Clean.
          </p>

          {/* CTA */}
          <div
            style={{
              opacity: ctaOpacity,
              padding: '16px 48px',
              borderRadius: 16,
              background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.purpleLight})`,
              boxShadow: `0 0 40px ${COLORS.purple}66`,
              display: 'inline-block',
            }}
          >
            <p
              style={{
                fontSize: 24,
                color: COLORS.white,
                margin: 0,
                fontWeight: 700,
              }}
            >
              Start Playing →
            </p>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================
// MAIN COMPOSITION - 40 seconds (1200 frames @ 30fps)
// ============================================
export const SolMateTeaser: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Background Music */}
      <Audio
        src={staticFile('audio/ambient-cinematic.mp3')}
        volume={0.5}
        startFrom={0}
      />

      {/* Scene 1: Opening Brand (0-4s / 0-120 frames) */}
      <Sequence from={0} durationInFrames={120}>
        <OpeningScene />
      </Sequence>

      {/* Scene 2: Chess Gameplay (4-24s / 120-720 frames) - EXTENDED */}
      <Sequence from={120} durationInFrames={600}>
        <ChessGameplay />
      </Sequence>

      {/* Scene 3: Wallet/Crypto (24-32s / 720-960 frames) */}
      <Sequence from={720} durationInFrames={240}>
        <WalletScene />
      </Sequence>

      {/* Scene 4: Closing CTA (32-40s / 960-1200 frames) */}
      <Sequence from={960} durationInFrames={240}>
        <ClosingScene />
      </Sequence>
    </AbsoluteFill>
  );
};

// Square version (1080x1080)
export const SolMateTeaserSquare: React.FC = () => <SolMateTeaser />;

// Vertical version (1080x1920)
export const SolMateTeaserVertical: React.FC = () => <SolMateTeaser />;
