# SolMate
A Solana x Chess Dapp

## Overview

SolMate is a decentralized chess gaming application built on Solana blockchain where players can:
- Connect their Solana wallets (Phantom, Solflare, etc.)
- Play chess matches against other players
- Wager SOL on game outcomes
- Place side bets on ongoing matches
- Track their game statistics and earnings

## Features

### Current Implementation
- ✅ Wallet Connection: Integrated Solana wallet adapter with support for Phantom and Solflare
- ✅ Modern UI: Built with Next.js 16, React 19, and Tailwind CSS
- ✅ Chess Board Interface: Visual chess board layout ready for game logic integration
- ✅ Game Controls: Wager settings, game creation/joining buttons
- ✅ Side Betting Section: UI for placing bets on ongoing matches
- ✅ Player Stats: Dashboard to display player statistics

### Future Enhancements
- Chess game logic implementation
- Anchor smart contracts for wagering and side bets
- Real-time multiplayer functionality
- Move validation and game state management
- Tournament system
- Leaderboards

## Tech Stack

- **Frontend**: Next.js 16 with App Router, React 19, TypeScript
- **Styling**: Tailwind CSS v4
- **Blockchain**: Solana (Devnet)
- **Wallet Integration**: @solana/wallet-adapter
- **Smart Contracts**: Anchor Framework (ready for implementation)

## Prerequisites

- Node.js 20+ and npm 10+
- Rust 1.92+ and Cargo (for future Anchor program development)
- A Solana wallet (Phantom or Solflare recommended)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/SerStakeAlot/SolMate.git
cd SolMate
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the production application
- `npm start` - Start the production server
- `npm run lint` - Run ESLint

## Project Structure

```
SolMate/
├── app/                      # Next.js app directory
│   ├── globals.css          # Global styles including wallet adapter styles
│   ├── layout.tsx           # Root layout with wallet provider
│   └── page.tsx             # Home page
├── components/              # React components
│   ├── ChessGame.tsx        # Main chess game interface
│   ├── WalletButton.tsx     # Wallet connection button
│   └── WalletProvider.tsx   # Solana wallet provider wrapper
├── lib/                     # Utility functions (future use)
├── public/                  # Static assets
├── next.config.js           # Next.js configuration
├── tailwind.config.js       # Tailwind CSS configuration
├── tsconfig.json            # TypeScript configuration
└── package.json             # Project dependencies
```

## Development Roadmap

### Phase 1: Foundation ✅
- [x] Set up Next.js with Solana wallet integration
- [x] Create basic UI components
- [x] Implement wallet connection

### Phase 2: Chess Logic (Next)
- [ ] Integrate chess.js for game logic
- [ ] Implement move validation
- [ ] Add drag-and-drop piece movement
- [ ] Game state management

### Phase 3: Smart Contracts
- [ ] Develop Anchor programs for wagering
- [ ] Implement escrow for game bets
- [ ] Create side betting mechanism
- [ ] Add game result verification

### Phase 4: Multiplayer
- [ ] WebSocket integration for real-time updates
- [ ] Matchmaking system
- [ ] Game invitations
- [ ] Spectator mode

### Phase 5: Features
- [ ] Tournament system
- [ ] Leaderboards
- [ ] Player profiles
- [ ] Chat system

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC

## Connect

Built on Solana • Powered by Anchor

