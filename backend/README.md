# SolMate Backend

Real-time multiplayer backend server for SolMate chess game.

## Features

- **Real-time Multiplayer**: Socket.IO for instant move synchronization
- **Matchmaking System**: Auto-pair players by stake tier (0.5, 1, 5, 10 SOL)
- **10-Minute Time Controls**: Chess clock with automatic timeout detection
- **Game Room Management**: Isolated game sessions with move validation
- **XP & Ranking System**: Track player progress and skill levels
- **Reconnection Support**: Handle disconnects gracefully

## Installation

```bash
cd backend
npm install
```

## Configuration

Create a `.env` file:

```bash
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

## Running the Server

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## API Endpoints

### HTTP Endpoints

- `GET /health` - Server health check and statistics

### Socket.IO Events

#### Client → Server

- `player:register` - Register player with wallet address
- `matchmaking:join` - Join matchmaking queue for specific stake tier
- `matchmaking:leave` - Leave matchmaking queue
- `matchmaking:getStatus` - Get current queue status
- `game:joinRoom` - Join a matched game room
- `game:makeMove` - Make a chess move
- `game:resign` - Resign from current game
- `game:end` - Declare game end (checkmate/draw)

#### Server → Client

- `player:registered` - Confirmation with player stats
- `matchmaking:queued` - Queue position update
- `matchmaking:matched` - Match found, room created
- `matchmaking:left` - Left queue confirmation
- `matchmaking:status` - Queue statistics
- `game:joined` - Successfully joined game room
- `game:start` - Game started, both players ready
- `game:move` - Opponent made a move
- `game:moveConfirmed` - Your move was accepted
- `game:timeUpdate` - Clock update (every second)
- `game:end` - Game ended with result
- `error` - Error message

## Architecture

```
backend/
├── src/
│   ├── server.ts         # Main server & Socket.IO setup
│   ├── matchmaking.ts    # Queue management & pairing
│   ├── gameRoom.ts       # Game session management
│   ├── timeControl.ts    # Chess clock implementation
│   ├── playerStore.ts    # Player state & XP tracking
│   └── types.ts          # TypeScript interfaces
├── package.json
└── tsconfig.json
```

## Stake Tiers

- Tier 0: 0.5 SOL
- Tier 1: 1.0 SOL
- Tier 2: 5.0 SOL
- Tier 3: 10.0 SOL

## Rank System

- **Novice**: 0 XP
- **Amateur**: 100+ XP
- **Intermediate**: 500+ XP
- **Advanced**: 1500+ XP
- **Expert**: 3000+ XP
- **Master**: 5000+ XP

## XP Rewards

- **Win**: 50 XP × rank multiplier
- **Loss**: 10 XP × rank multiplier

Rank multipliers increase with opponent skill level.

## Time Controls

- Each player gets 10 minutes
- Time decrements during their turn
- Automatic loss on timeout
- Updates broadcast every second

## Development

```bash
# Watch mode with auto-reload
npm run dev

# Type checking
npm run build

# Linting
npm run lint
```

## Production Deployment

1. Build the project: `npm run build`
2. Set environment variables
3. Deploy to your preferred hosting (Railway, Heroku, DigitalOcean, etc.)
4. Ensure WebSocket connections are supported
5. Update CORS_ORIGIN to match your frontend domain

## Dependencies

- **express**: HTTP server
- **socket.io**: WebSocket communication
- **cors**: Cross-origin support
- **dotenv**: Environment configuration
- **uuid**: Unique room IDs
- **typescript**: Type safety
- **tsx**: Development runtime

## License

ISC
