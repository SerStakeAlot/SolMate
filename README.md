# SolMate
A Solana x Chess Dapp

## Overview

SolMate is a decentralized chess gaming application built on Solana blockchain where players can:
- Connect their Solana wallets (Phantom, Solflare, etc.)
- Play chess matches against other players
- Stake SOL on match outcomes using Anchor escrow contracts
- Browse open matches in the lobby
- Track their match statistics and rewards

## Features

### Current Implementation
- ✅ Wallet Connection: Integrated Solana wallet adapter with support for Phantom and Solflare
- ✅ Modern UI: Built with Next.js 16, React 19, and Tailwind CSS
- ✅ Chess Board Interface: Visual chess board layout with full game logic
- ✅ **Anchor Escrow Program**: Complete smart contract for match stakes and payouts
- ✅ **Match Lobby**: Browse and join open matches
- ✅ **Stake Tiers**: Fixed tiers (0.5, 1, 5, 10 SOL) with 10% platform fee
- ✅ **Automatic Payouts**: Winner receives 90% of pot, 10% goes to fee vault
- ✅ **Safety Features**: Self-match prevention, join delays, deadline enforcement
- ✅ **Real-time Multiplayer**: Socket.IO backend for live gameplay
- ✅ **Automatic Matchmaking**: Pair players by stake tier
- ✅ **10-Minute Time Controls**: Chess clocks with automatic timeout
- ✅ **XP & Ranking System**: Progress from Novice to Master

### Architecture
- **Frontend**: Next.js 16 with App Router, React 19, TypeScript
- **Backend**: Node.js + Express + Socket.IO for real-time multiplayer
- **Styling**: Tailwind CSS v4
- **Blockchain**: Solana (Devnet)
- **Wallet Integration**: @solana/wallet-adapter
- **Smart Contracts**: Anchor Framework (Rust)
- **Chess Logic**: chess.js library
- **Real-time Communication**: Socket.IO WebSockets

## Prerequisites

- Node.js 20+ and npm 10+
- Rust 1.92+ and Cargo (for Anchor program development)
- Anchor CLI 0.30.1+
- A Solana wallet (Phantom or Solflare recommended)
- SOL on Devnet for testing

## Installation

### Frontend & Blockchain

1. Clone the repository:
```bash
git clone https://github.com/SerStakeAlot/SolMate.git
cd SolMate
```

2. Install frontend dependencies:
```bash
npm install
```

3. Configure frontend environment:
```bash
cp .env.local.example .env.local
# Edit .env.local if needed
```

### Backend (Multiplayer Server)

4. Install backend dependencies:
```bash
cd backend
npm install
```

5. Configure backend environment:
```bash
cp .env.example .env
# Edit .env if needed (default: PORT=3001)
```

### Running the Application

6. Start the backend server (Terminal 1):
```bash
cd backend
npm run dev
```

7. Start the frontend (Terminal 2):
```bash
npm run dev
```

8. Open [http://localhost:3000](http://localhost:3000)

### Blockchain Deployment (Optional)

9. Build the Anchor program:
```bash
npm run anchor:build
```

10. Deploy to Devnet:
```bash
npm run anchor:deploy
```

11. Update the program ID in:
   - `/anchor/programs/sol_mate_escrow/src/lib.rs`
   - `/utils/escrow.ts`
   - `/Anchor.toml`

## Available Scripts

### Frontend
- `npm run dev` - Start the Next.js development server
- `npm run build` - Build the production application
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint

### Backend
- `cd backend && npm run dev` - Start backend server with auto-reload
- `cd backend && npm run build` - Build backend TypeScript
- `cd backend && npm start` - Start production backend

### Blockchain
- `npm run anchor:build` - Build Anchor program
- `npm run anchor:test` - Test Anchor program
- `npm run anchor:deploy` - Deploy program to Devnet

## Project Structure

```
SolMate/
├── anchor/                      # Anchor smart contract workspace
│   ├── programs/
│   │   └── sol_mate_escrow/    # Escrow program
│   │       ├── src/
│   │       │   ├── lib.rs      # Program entry point
│   │       │   ├── state.rs    # Account structures
│   │       │   ├── errors.rs   # Error definitions
│   │       │   └── instructions/ # Program instructions
│   │       └── Cargo.toml
│   ├── Cargo.toml
│   └── Anchor.toml
├── backend/                     # Multiplayer backend server
│   ├── src/
│   │   ├── server.ts           # Main server & Socket.IO
│   │   ├── matchmaking.ts      # Queue & pairing logic
│   │   ├── gameRoom.ts         # Game session management
│   │   ├── timeControl.ts      # Chess clock system
│   │   ├── playerStore.ts      # Player state & XP
│   │   └── types.ts            # TypeScript interfaces
│   ├── package.json
│   └── tsconfig.json
├── app/                         # Next.js app directory
│   ├── globals.css             # Global styles
│   ├── layout.tsx              # Root layout with wallet provider
│   ├── page.tsx                # Home page
│   ├── game/
│   │   └── page.tsx            # Game page
│   ├── lobby/
│   │   └── page.tsx            # Match lobby page
│   ├── multiplayer/
│   │   └── page.tsx            # Multiplayer mode
│   └── play/
│       └── page.tsx            # Mode selection page
├── components/                  # React components
│   ├── ChessGame.tsx           # Chess game with escrow integration
│   ├── MultiplayerChess.tsx    # Real-time multiplayer component
│   ├── WalletButton.tsx        # Wallet connection button
│   └── WalletProvider.tsx      # Solana wallet provider wrapper
├── utils/                       # Utility functions
│   └── escrow.ts               # Escrow client and helpers
├── next.config.js              # Next.js configuration
├── tailwind.config.js          # Tailwind CSS configuration
└── tsconfig.json               # TypeScript configuration
```Multiplayer**: Real-time matches with 10-minute timer
   - **Join Match**: Browse lobby for open matches
   - **Host Match**: Create new staked match
   - **Practice**: Play against AI without stakes
3. **Matchmaking** (Multiplayer mode): Select stake tier, auto-pair with opponent
### User Flow

1. **Home Page**: Connect wallet or enter as guest
2. **Play Selection**: Choose between:
   - **Join Match**: Browse lobby for open matches
   - **Host Match**: Create new staked match
   - **Practice**: Play against AI without stakes
3. **Lobby** (Join mode): Filter by stake tier, view countdown timers, join matches
4. **Game Page**: Play chess with real-time move validation
5. **Automatic Payout**: Winner determined on checkmate, payout auto-executed

### Escrow Smart Contract

The Anchor program manages all on-chain operations:

**Match Lifecycle:**
1. Player A creates match → stake locked in escrow PDA
2. Player B joins within deadline → their stake locked
3. Match becomes Active → chess game proceeds
4. Winner declared → result submitted on-chain
5. Payout executed → 90% to winner, 10% to fee vault

**Security Features:**
- PDA-only custody (no off-chain funds)
- Self-match prevention
- Join deadline enforcement  
- 3-second join delay (bot prevention)
- Winner validation
- Arithmetic overflow protection

**Stake Tiers:**
- Tier 0: 0.5 SOL
- Tier 1: 1 SOL
- Tier 2: 5 SOL
- Tier 3: 10 SOL

Each tier has a 10% platform fee on payout.

### Multiplayer System

The real-time backend enables live gameplay:

**Matchmaking:**
1. Player selects stake tier
2. Joins matchmaking queue
3. Backend pairs players from same tier
4. Game room created, colors assigned randomly
5. Both players join room, timer starts

**Game Session:**
- 10 minutes per player (total: 20 minutes max)
- Clock runs only during your turn
- Moves validated and relayed instantly
- Time updates broadcast every second
- Automatic loss on timeout

**XP & Ranking:**
- Win: 50 XP × rank multiplier
- Loss: 10 XP × rank multiplier
- Ranks: Novice → Amateur → Intermediate → Advanced → Expert → Master

## Development Roadmap

### Phase 1: MVP ✅
- [x] Frontend chess game with wallet integration
- [x] Anchor escrow smart contract
- [x] Match lobby system
- [x] Automatic payout mechanism
- [x] Safety features and deadline enforcement

###x] Real-time multiplayer via WebSocket
- [x] 10-minute time controls
- [x] Automatic matchmaking system
- [x] XP and ranking foundation
- [ ] Move history and game replay
- [ ] ELO rating system
- [ ] Tournament brackets
- [ ] Spectator mode with chat
- [ ] Side betting system

### Phase 3: Advanced Features
- [ ] Mobile responsive improvements
- [ ] Player profiles and statistics
- [ ] Leaderboards and achievements
- [ ] Draw offers and rematch requests
- [ ] Game analysis and hitics
- [ ] Leaderboards and achievements

### Phase 4: Platform Growth
- [ ] Custom stake amounts (not just tiers)
- [ ] Multi-token support (USDC, etc.)
- [ ] NFT integration for chess pieces
- [ ] Social features and friend system

## Testing

### Frontend
```bash
npm run dev
# Visit http://localhost:3000
```

### Anchor Program
```bash
npm run anchor:test
```

### Manual Testing Flow
1. Connect Phantom wallet (Devnet)
2. Get Devnet SOL from faucet
3. Create a match (Host mode)
4. Open lobby in new browser/wallet
5. Join the match
6. Play game to checkmate
7. Verify payout on Solana Explorer

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC

## Connect

Competitive Chess on Solana • Powered by Anchor

