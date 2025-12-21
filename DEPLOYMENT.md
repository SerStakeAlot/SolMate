# Deployment Guide

## Deploy to Vercel

The easiest way to deploy SolMate is using [Vercel](https://vercel.com):

1. Push your code to GitHub
2. Import your repository on Vercel
3. Vercel will automatically detect Next.js and configure the build settings
4. Add environment variables if needed (optional):
   - `NEXT_PUBLIC_SOLANA_NETWORK` - Set to `devnet`, `testnet`, or `mainnet-beta`
   - `NEXT_PUBLIC_SOLANA_RPC_ENDPOINT` - Custom RPC endpoint (optional)
5. Deploy!

## Deploy to Other Platforms

### Netlify
1. Connect your repository
2. Set build command: `npm run build`
3. Set publish directory: `.next`
4. Add environment variables as needed

### Self-Hosted
1. Build the application:
   ```bash
   npm run build
   ```
2. Start the production server:
   ```bash
   npm start
   ```
3. The app will be available at `http://localhost:3000`

### Docker (Optional)
Create a `Dockerfile` for containerized deployment:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Environment Configuration

For production deployments, ensure:
- Set `NEXT_PUBLIC_SOLANA_NETWORK` to appropriate network
- Use a reliable RPC endpoint (consider Helius, QuickNode, or Triton)
- Enable analytics and monitoring
- Configure proper CORS settings for your domain

## Anchor Programs (Future)

When deploying Anchor programs:
1. Build programs: `anchor build`
2. Deploy to devnet: `anchor deploy --provider.cluster devnet`
3. Update program IDs in your frontend configuration
4. Test thoroughly before mainnet deployment
