# Winner Payout System Documentation

## Overview

This document explains how the winner determination and payout system works. Use this to debug if it breaks.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│    Backend      │────▶│   Solana Chain  │
│  (ChessGame)    │     │   (Railway)     │     │    (Escrow)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     │                        │                        │
     │ Detects checkmate      │ Records winner         │ Stores winner
     │ Shows modal            │ in SQLite DB           │ on-chain
     │ User clicks            │                        │
     │ "Claim Winnings"       │                        │
     └───────────────────────────────────────────────▶│
                              submit_result + confirm_payout
```

## Key Components

### 1. Backend: Server-Side Checkmate Detection
**File:** `backend/src/gameRoom.ts`

```typescript
// After each move, backend checks for checkmate using chess.js
const chess = new Chess(move.fen);
if (chess.isCheckmate()) {
  const winner = isWhitePlayer ? 'w' : 'b';
  this.endGame(roomId, winner, 'checkmate', io);
}
```

**Why this matters:** Records the CORRECT winner in the database immediately when game ends.

### 2. Backend: Winner Storage
**File:** `backend/src/statsStore.ts`

Winner is stored in `game_history` table with:
- `match_pubkey` - The Solana match account address
- `winner_wallet` - The wallet address of the winner

**API Endpoint:** `GET /api/match-winner/:matchPubkey`
Returns: `{ found: boolean, winnerWallet: string | null }`

### 3. Frontend: Victory Modal with Claim Button
**File:** `components/ChessGame.tsx` (~line 3340)

```typescript
<motion.button onClick={() => { handleSubmitResult(); }}>
  💰 CLAIM WINNINGS
</motion.button>
```

**Why manual button:** Auto-popup was being rejected on mobile when user tapped screen.

### 4. Frontend: Refund Page Logic
**File:** `app/refund/page.tsx`

```typescript
// Query backend for winner
const res = await fetch(`${BACKEND_URL}/api/match-winner/${pubkey}`);
const data = await res.json();

if (data.winnerWallet === publicKey) {
  isBackendWinner = true;  // Show "Claim Winnings"
} else if (data.winnerWallet) {
  isBackendLoser = true;   // Block refund, show "You Lost"
}
```

### 5. On-Chain: Escrow Program
**Program ID:** `H1Sn4JQvsZFx7HreZaQn4Poa3hkoS9iGnTwrtN2knrKV`

Key instructions:
- `submit_result(winner)` - Records winner on-chain, changes status to Finished
- `confirm_payout()` - Pays winner from escrow
- `abandon_match()` - Refunds both players (BLOCKED if winner is set)

**Critical constraint in abandon_match.rs:**
```rust
constraint = match_account.winner.is_none() @ EscrowError::WinnerAlreadyDeclared
```

## Flow Summary

### Happy Path (Winner Claims)
1. Player makes checkmate move
2. Backend detects checkmate → records winner in DB
3. Victory modal shows with "CLAIM WINNINGS" button
4. Winner clicks button → calls `submit_result` + `confirm_payout`
5. Winner receives pot (minus 10% fee)

### Backup Path (Claim from Refund Page)
1. Game ends, winner recorded in backend DB
2. Winner rejected/missed the wallet popup
3. Winner goes to `/refund` page
4. Page queries backend → sees user is winner
5. Shows "Claim Winnings" button
6. Calls `submit_result` + `confirm_payout`

### Loser Blocked
1. Loser goes to `/refund` page
2. Page queries backend → sees someone ELSE won
3. Shows "You Lost - No Refund" tag
4. Button is hidden, no action available

## Debugging Checklist

### "Wrong winner recorded"
- Check `backend/src/gameRoom.ts` - is `chess.isCheckmate()` detecting correctly?
- Check the FEN being passed: `new Chess(move.fen)`
- Winner should be the player who just moved (opponent is in checkmate)

### "Loser can still claim refund"
- Check `app/refund/page.tsx` - is `isBackendLoser` being set?
- Check backend URL: should be `https://solmate-production.up.railway.app`
- Test endpoint: `curl https://solmate-production.up.railway.app/api/match-winner/{MATCH_PUBKEY}`

### "Winner not recorded in backend"
- Check Railway logs for errors
- Verify `endGame()` is being called in `gameRoom.ts`
- Check `statsStore.recordGame()` is saving `matchPubkey` correctly

### "Claim Winnings button not visible"
- Check `components/ChessGame.tsx` around line 3340
- Verify `mode === 'wager'` and `isWinner` are true
- Check `payoutComplete` is false

## Quick Fix Commands

### Redeploy Backend
```bash
# Railway auto-deploys on push, or manually trigger from dashboard
git push origin main
```

### Check Backend Health
```bash
curl https://solmate-production.up.railway.app/health
```

### Check Winner for a Match
```bash
curl https://solmate-production.up.railway.app/api/match-winner/MATCH_PUBKEY_HERE
```

### Check On-Chain Match State
```bash
cd /workspaces/SolMate && npx ts-node check-match.ts
```

## Environment URLs

- **Frontend:** https://playsolmate.fun (Netlify)
- **Backend:** https://solmate-production.up.railway.app (Railway)
- **Escrow Program:** H1Sn4JQvsZFx7HreZaQn4Poa3hkoS9iGnTwrtN2knrKV (Solana Mainnet)

## Files to Check (in order)

1. `backend/src/gameRoom.ts` - Server-side checkmate detection
2. `backend/src/statsStore.ts` - Winner storage in DB
3. `backend/src/server.ts` - API endpoint `/api/match-winner`
4. `app/refund/page.tsx` - Refund page winner/loser logic
5. `components/ChessGame.tsx` - Victory modal and claim button
6. `utils/escrow.ts` - On-chain transaction functions

## Last Working Commit

```
6bc8153 - Fix winner/loser handling (Feb 3, 2026)
```

To restore if broken:
```bash
git checkout 6bc8153 -- backend/src/gameRoom.ts backend/src/statsStore.ts backend/src/server.ts app/refund/page.tsx components/ChessGame.tsx
git commit -m "Restore working winner payout system"
git push
```
