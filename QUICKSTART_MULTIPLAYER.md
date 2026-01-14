# Quick Start - SolMate Multiplayer

## 🚀 Get Started in 3 Minutes

### Step 1: Install Dependencies

```bash
# Frontend dependencies
npm install

# Backend dependencies
cd backend && npm install && cd ..
```

### Step 2: Start Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
You should see:
```
🚀 SolMate backend server running on port 3001
📡 Socket.IO server ready for connections
🎮 Matchmaking system active
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```
Visit: http://localhost:3000

### Step 3: Play!

1. **Connect Wallet** (Phantom or Solflare)
2. **Click "Enter Arena"**
3. **Select "Multiplayer"** (purple card with ⚡)
4. **Choose Stake Tier** (0.5, 1, 5, or 10 SOL)
5. **Wait for Opponent** (open in 2 browser tabs to test)
6. **Play Chess!** (10 minutes per player)

## 🎮 Test Locally

Open two browser windows:
- Window 1: http://localhost:3000
- Window 2: http://localhost:3000 (incognito/private mode)

Both connect wallets → Both join multiplayer → Both select same tier → You're matched!

## 📊 Check Status

```bash
curl http://localhost:3001/health
```

Shows active players, games, and queue sizes.

## 🎯 Game Modes

### 1. Multiplayer (NEW!)
- Real-time matches
- 10-minute time control
- Auto-matchmaking by stake
- XP & ranking system

### 2. Host Match
- Create match on-chain
- Wait for opponent to join
- Uses Solana escrow

### 3. Join Match
- Browse lobby
- Join existing matches
- Uses Solana escrow

### 4. Practice
- Play vs AI
- No stakes
- No timer

## 🏆 Ranking System

- **Novice**: 0 XP (Start here)
- **Amateur**: 100+ XP
- **Intermediate**: 500+ XP
- **Advanced**: 1500+ XP
- **Expert**: 3000+ XP
- **Master**: 5000+ XP

Win games to earn XP!

## 🎲 Stake Tiers

All matches use fixed stakes:
- **Tier 0**: 0.5 SOL
- **Tier 1**: 1.0 SOL
- **Tier 2**: 5.0 SOL
- **Tier 3**: 10.0 SOL

## 🔧 Troubleshooting

### Backend won't start
```bash
cd backend
rm -rf node_modules
npm install
npm run dev
```

### Frontend won't connect
Check `.env.local`:
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

### Can't find opponent
- Need 2 players in same tier
- Try opening 2 browser windows
- Both must select same stake tier

### Moves not syncing
- Check both players are connected
- Look for Socket.IO errors in console
- Restart backend if needed

## 📚 More Documentation

- [MULTIPLAYER_SETUP.md](MULTIPLAYER_SETUP.md) - Detailed setup guide
- [backend/README.md](backend/README.md) - Backend API reference
- [BACKEND_IMPLEMENTATION.md](BACKEND_IMPLEMENTATION.md) - Implementation details
- [README.md](README.md) - Full project documentation

## 🎉 You're Ready!

The complete multiplayer system is now running. Enjoy real-time chess on Solana!
