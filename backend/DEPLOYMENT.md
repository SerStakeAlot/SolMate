# SolMate Backend Deployment Guide

Deploy your game server for 24/7 availability on the Solana dApp Store.

## Quick Deploy Options

### Option 1: Railway (Recommended - Easiest)

1. **Create account** at [railway.app](https://railway.app)

2. **Deploy via GitHub:**
   ```bash
   # Push your code to GitHub first
   cd backend
   git add .
   git commit -m "Prepare for Railway deployment"
   git push origin main
   ```

3. **In Railway Dashboard:**
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your SolMate repository
   - Set root directory to `/backend`
   - Add environment variable: `CORS_ORIGIN=https://your-frontend-url.com`

4. **Get your URL:** Railway will give you a URL like `solmate-backend.up.railway.app`

**Cost:** ~$5/month for always-on

---

### Option 2: Render

1. **Create account** at [render.com](https://render.com)

2. **New Web Service:**
   - Connect GitHub repository
   - Set root directory: `backend`
   - Build command: `npm run build`
   - Start command: `npm start`

3. **Environment Variables:**
   ```
   CORS_ORIGIN=https://your-frontend-url.com
   NODE_ENV=production
   ```

**Cost:** Free tier available (spins down after 15min inactivity) or $7/mo for always-on

---

### Option 3: Fly.io (Best for Global Players)

1. **Install Fly CLI:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login and Deploy:**
   ```bash
   cd backend
   fly auth login
   fly launch --name solmate-backend
   fly secrets set CORS_ORIGIN=https://your-frontend-url.com
   fly deploy
   ```

**Cost:** ~$5/month, deploys to edge locations worldwide

---

## Frontend Configuration

After deploying, update your frontend to use the production backend URL:

1. **Create/update `.env.production`:**
   ```bash
   # In your main SolMate directory
   echo "NEXT_PUBLIC_BACKEND_URL=https://your-backend-url.com" > .env.production
   ```

2. **Update for dApp Store deployment:**
   The frontend will automatically use this URL when built for production.

---

## Vercel (Frontend Hosting)

For your Next.js frontend:

1. **Deploy to Vercel:**
   ```bash
   npm i -g vercel
   vercel
   ```

2. **Set environment variable in Vercel dashboard:**
   - `NEXT_PUBLIC_BACKEND_URL` = your Railway/Render/Fly URL

---

## Architecture Overview

```
┌─────────────────┐     WebSocket     ┌─────────────────┐
│  Next.js App    │◄─────────────────►│  Game Server    │
│  (Vercel)       │                   │  (Railway/Fly)  │
└────────┬────────┘                   └────────┬────────┘
         │                                     │
         │ RPC                                 │
         ▼                                     │
┌─────────────────┐                            │
│  Solana Devnet  │◄───────────────────────────┘
│  (Smart Contract)                   On-chain escrow
└─────────────────┘
```

---

## Health Monitoring

Your server includes a health endpoint: `GET /health`

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-14T12:00:00.000Z",
  "activePlayers": 5,
  "activeGames": 2,
  "hostedMatches": 3
}
```

Use this with monitoring services like:
- **UptimeRobot** (free)
- **Better Uptime**
- **Pingdom**

---

## Scaling for Production

When your game gets popular:

1. **Horizontal Scaling:** Railway and Fly.io support auto-scaling
2. **Redis for State:** Add Redis for shared state across instances
3. **Database:** Consider PostgreSQL for persistent player stats

---

## Estimated Costs

| Component | Service | Monthly Cost |
|-----------|---------|--------------|
| Backend | Railway/Fly | $5-10 |
| Frontend | Vercel | Free |
| Monitoring | UptimeRobot | Free |
| **Total** | | **~$5-10/month** |

---

## Quick Commands

```bash
# Railway
railway up

# Render
# (Use web dashboard)

# Fly.io
fly deploy
fly status
fly logs
```

---

## Need Help?

- Railway Docs: https://docs.railway.app
- Render Docs: https://render.com/docs
- Fly.io Docs: https://fly.io/docs

Telegram: @hotdogewketchup
