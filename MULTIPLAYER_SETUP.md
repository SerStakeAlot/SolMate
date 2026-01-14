# SolMate - Multiplayer Setup Guide

## Overview

SolMate now includes a complete real-time multiplayer backend with:

- ✅ **Automatic Matchmaking** - Players pair by stake tier
- ✅ **10-Minute Time Controls** - Chess clocks with automatic timeout
- ✅ **Real-time Move Synchronization** - Instant move relay between players
- ✅ **XP & Ranking System** - Track progress from Novice to Master
- ✅ **WebSocket Communication** - Low-latency Socket.IO integration

## Quick Start

### 1. Install Backend Dependencies

```bash
cd backend
npm install
```

### 2. Configure Backend

Create `backend/.env`:

```bash
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

### 3. Install Frontend Dependencies

```bash
cd ..
npm install
```

### 4. Configure Frontend

Create `.env.local`:

```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

### 5. Start Backend Server

```bash
cd backend
npm run dev
```

Backend will run on `http://localhost:3001`

### 6. Start Frontend (New Terminal)

```bash
npm run dev
```

Frontend will run on `http://localhost:3000`

## How to Play Multiplayer

1. **Connect Wallet** - Use Phantom or Solflare
2. **Select Mode** - Click "Enter Arena" from home
3. **Choose Multiplayer** - Select the purple "Multiplayer" card
4. **Select Stake Tier** - Choose 0.5, 1, 5, or 10 SOL
5. **Wait for Match** - System auto-pairs you with opponent
6. **Play Chess** - 10 minutes per player, moves sync in real-time
7. **Win & Earn XP** - Gain experience and rank up

## Matchmaking System

### Stake Tiers

- **Tier 0**: 0.5 SOL
- **Tier 1**: 1.0 SOL
- **Tier 2**: 5.0 SOL
- **Tier 3**: 10.0 SOL

Players are only matched with others in the same tier.

### How Matchmaking Works

1. Player joins queue for specific tier
2. Backend maintains separate queue per tier
3. When 2+ players in queue, they're instantly paired
4. Game room created with random color assignment
5. Both players join room and game starts
6. Timer begins when both players connected

## Time Controls

- Each player gets **10 minutes** (600,000ms)
- Clock runs during your turn only
- Time updates broadcast every second
- Automatic loss on timeout
- Timer pauses between moves

## Ranking System

### Ranks

- **Novice**: 0 XP
- **Amateur**: 100+ XP
- **Intermediate**: 500+ XP
- **Advanced**: 1500+ XP
- **Expert**: 3000+ XP
- **Master**: 5000+ XP

### XP Rewards

- **Win**: 50 XP × opponent rank multiplier
- **Loss**: 10 XP × opponent rank multiplier

Higher ranked opponents give more XP.

## Architecture

```
┌─────────────────┐         WebSocket         ┌─────────────────┐
│                 │ ◄──────────────────────► │                 │
│  Next.js        │                           │  Backend        │
│  Frontend       │   Socket.IO (Port 3001)   │  Server         │
│                 │                           │                 │
└─────────────────┘                           └─────────────────┘
        │                                             │
        │                                             │
        ▼                                             ▼
┌─────────────────┐                           ┌─────────────────┐
│                 │                           │                 │
│  Solana         │                           │  Game Rooms     │
│  Escrow         │                           │  Matchmaking    │
│  (Devnet)       │                           │  Time Control   │
│                 │                           │                 │
└─────────────────┘                           └─────────────────┘
```

## Game Flow

1. **Register**: Player connects, backend creates profile
2. **Queue**: Player selects stake tier, joins matchmaking queue
3. **Match**: Backend pairs 2 players from same tier
4. **Join Room**: Both players join game room via Socket.IO
5. **Play**: Moves sent through backend, validated, relayed to opponent
6. **Time Updates**: Server broadcasts clock every second
7. **End**: Checkmate, timeout, or resignation triggers game end
8. **Payout**: Winner submits result to Solana escrow for payout

## Socket.IO Events Reference

### Client → Server

```typescript
// Register player
socket.emit('player:register', { walletAddress: string });

// Join matchmaking
socket.emit('matchmaking:join', { stakeTier: number });

// Leave matchmaking
socket.emit('matchmaking:leave');

// Join game room
socket.emit('game:joinRoom', { roomId: string });

// Make move
socket.emit('game:makeMove', { 
  roomId: string, 
  move: { from, to, promotion, fen, san } 
});

// Resign
socket.emit('game:resign', { roomId: string });

// End game
socket.emit('game:end', { roomId, winner, reason });
```

### Server → Client

```typescript
// Registration confirmed
socket.on('player:registered', (data) => {});

// In queue
socket.on('matchmaking:queued', (data) => {});

// Match found
socket.on('matchmaking:matched', (data) => {});

// Joined game
socket.on('game:joined', (data) => {});

// Game started
socket.on('game:start', (data) => {});

// Opponent moved
socket.on('game:move', (data) => {});

// Time update
socket.on('game:timeUpdate', (data) => {});

// Game ended
socket.on('game:end', (data) => {});

// Error
socket.on('error', (error) => {});
```

## Development

### Backend Development

```bash
cd backend
npm run dev    # Auto-reload with tsx watch
npm run build  # Compile TypeScript
npm start      # Run compiled code
```

### Frontend Development

```bash
npm run dev    # Next.js dev server
npm run build  # Production build
npm start      # Production server
```

### Health Check

```bash
curl http://localhost:3001/health
```

Returns:
```json
{
  "status": "ok",
  "timestamp": "2026-01-09T...",
  "activePlayers": 0,
  "activeGames": 0,
  "queues": [...]
}
```

## Production Deployment

### Backend

1. Deploy to cloud provider (Railway, Heroku, DigitalOcean, etc.)
2. Ensure WebSocket support enabled
3. Set environment variables
4. Update CORS_ORIGIN to match frontend domain

### Frontend

1. Update `NEXT_PUBLIC_BACKEND_URL` to production backend URL
2. Deploy to Vercel/Netlify
3. Ensure proper CORS configuration

## Troubleshooting

### Connection Failed

- Check backend is running on port 3001
- Verify `.env.local` has correct `NEXT_PUBLIC_BACKEND_URL`
- Check browser console for Socket.IO errors
- Ensure firewall allows WebSocket connections

### Matchmaking Timeout

- Need 2 players in same tier
- Check queue status via `/health` endpoint
- Try different stake tier with more players

### Moves Not Syncing

- Verify both players connected to room
- Check backend logs for move validation errors
- Ensure it's your turn (color matches current turn)

### Time Not Updating

- Backend sends updates every 1 second
- Check Socket.IO connection is stable
- Look for `game:timeUpdate` events in console

## Next Steps

- [ ] Connect multiplayer to Solana escrow for real stakes
- [ ] Add move history display
- [ ] Implement draw offers
- [ ] Add spectator mode
- [ ] Create leaderboard
- [ ] Tournament brackets

## Support

For issues or questions:
1. Check backend logs: `backend/` terminal
2. Check frontend logs: Browser console
3. Test health endpoint: `http://localhost:3001/health`
4. Review backend README: `backend/README.md`
