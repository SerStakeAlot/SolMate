# Solana Seeker Wallet Connection Guide

This guide explains how to enable wallet connections on the Solana Seeker phone's embedded browser.

## The Problem

The Solana Seeker phone has an embedded browser that **does not support** the standard Mobile Wallet Adapter (MWA) protocol. Specifically:

- ❌ Seeker browser doesn't handle `solana-wallet://` intent URLs
- ❌ MWA's WebSocket connection fails with "failed to connect to wallet websocket at ws://localhost"
- ❌ No wallet injection into `window` object (no `window.solana`, `window.phantom`, etc.)
- ❌ `navigator.wallets` (wallet-standard) remains empty - wallets don't register

This is a known limitation of WebView/embedded browsers on Android - they don't properly handle custom protocol schemes needed for MWA.

## The Solution: Two Options

### Option 1: Use Chrome Browser (Quick Fix)

**For Users:**
1. Open Chrome browser on your Seeker phone (not the built-in Seeker browser)
2. Navigate to `https://playsolmate.fun`
3. Click "Connect Wallet" and select "Seeker / Saga Wallet"
4. The MWA protocol will work correctly in Chrome

**For Site Admins:**
- No code changes needed
- Current implementation already works in Chrome
- Add a banner detecting Seeker browser and guiding users to Chrome (already implemented)

### Option 2: Enable Privy (Best UX - Recommended)

**What is Privy?**

Privy provides embedded, self-custodial wallets that work in **any browser**, including Seeker's embedded browser. This is what successful competitors like [playsolmates.app](https://playsolmates.app) use.

**Benefits:**
- ✅ Works in Seeker's embedded browser
- ✅ Works in ANY mobile browser or WebView
- ✅ Email/SMS/Social login - no seed phrase needed
- ✅ Self-custodial - user owns the keys
- ✅ Can still connect external wallets (Phantom, Solflare, etc.)
- ✅ Better onboarding for non-crypto users

**Setup Steps:**

1. **Create a Privy Account**
   - Go to [https://dashboard.privy.io](https://dashboard.privy.io)
   - Sign up for a free account
   - Create a new app

2. **Configure for Solana**
   - In your Privy dashboard, select your app
   - Navigate to Settings → Chains
   - Enable Solana (Mainnet)
   - Configure login methods (Email, SMS, Social, or Wallet-only)

3. **Get Your App ID**
   - In Settings → Basics, copy your **App ID**
   - It looks like: `clpk1234abcd5678efgh9012`

4. **Update Environment Variables**
   
   For local development (`.env.local`):
   ```bash
   NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id-here
   ```

   For production deployment (Netlify environment variables):
   ```bash
   NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id-here
   ```

5. **Deploy**
   - Commit and push your `.env.local` or Netlify configuration
   - The app will automatically detect Privy and enable embedded wallet support
   - Users on Seeker will now be able to connect wallets seamlessly

## How It Works

### Current Implementation (Standard Wallet Adapter)

```
User on Seeker → Clicks "Connect Wallet" → Tries MWA 
→ Browser attempts solana-wallet:// intent 
→ ❌ Seeker browser blocks/ignores intent 
→ WebSocket connection fails
```

### With Privy Enabled

```
User on Seeker → Clicks "Connect Wallet" → Privy modal appears
→ User logs in with email/SMS/social 
→ ✅ Embedded wallet created in browser 
→ Ready to sign transactions
```

### Technical Details

The app already has dual wallet provider support:

- **`WalletProvider.tsx`** - Standard Solana wallet adapter (Phantom, Solflare, MWA)
- **`PrivyWalletProvider.tsx`** - Privy embedded wallet provider
- **`CombinedWalletProvider.tsx`** - Automatically uses Privy if `NEXT_PUBLIC_PRIVY_APP_ID` is set

When Privy is enabled:
1. User sees Privy login modal (email, SMS, Google, Apple, or external wallet)
2. Privy creates an embedded self-custodial wallet in the browser
3. Private keys stored securely on user's device
4. Works in ANY browser environment (including Seeker's embedded browser)
5. MWA is registered via `@solana-mobile/wallet-standard-mobile` for compatibility

## User Experience Comparison

### Without Privy (Current)
1. User on Seeker clicks "Connect Wallet"
2. Sees warning: "Seeker browser not supported"
3. Must open Chrome or Phantom browser manually
4. Friction in onboarding

### With Privy (Recommended)
1. User on Seeker clicks "Connect Wallet"
2. Privy modal appears instantly
3. Logs in with email (no seed phrase needed)
4. Wallet ready in 30 seconds
5. Seamless experience on ANY device/browser

## Cost Considerations

**Privy Pricing:**
- **Free Tier**: Up to 1,000 monthly active wallets
- **Growth**: $0.02 per monthly active wallet (min $99/mo)
- **Enterprise**: Custom pricing

For a new app, the free tier is sufficient. As you grow past 1,000 monthly users, consider whether the improved conversion rate (due to better UX) justifies the cost.

## Testing

### Test Without Privy (Current Behavior)
1. Open site in Seeker browser
2. Click "Connect Wallet"
3. Select "Seeker / Saga Wallet"
4. See warning about browser limitations
5. Follow guidance to use Chrome

### Test With Privy
1. Set `NEXT_PUBLIC_PRIVY_APP_ID` in your environment
2. Restart the dev server: `npm run dev`
3. Open site in Seeker browser
4. Click "Connect Wallet"
5. See Privy login modal
6. Log in with email/SMS
7. ✅ Wallet connected successfully

## Recommended Approach

For production deployment:

1. **Short-term**: Current implementation with Seeker detection works
   - Users see clear guidance to use Chrome
   - No additional cost
   - Works for crypto-native users who already have wallets

2. **Long-term**: Enable Privy for best UX
   - Better onboarding for new users
   - Works everywhere (Seeker, mobile browsers, desktop)
   - Reduces friction significantly
   - Costs ~$100/mo after 1,000 users

## Support

If you encounter issues:

1. **Check browser**: MWA only works in full browsers (Chrome), not WebViews
2. **Check Privy setup**: Verify App ID is correct and app is configured for Solana
3. **Check network**: Some users report issues with local development - deploy to production for testing
4. **Check console**: Look for MWA or Privy error messages in browser dev tools

## References

- [Privy Documentation](https://docs.privy.io/)
- [Solana Mobile Wallet Adapter Docs](https://docs.solanamobile.com/developers/mobile-wallet-adapter)
- [MWA WebView Issue #1082](https://github.com/solana-mobile/mobile-wallet-adapter/issues/1082)
- [Privy Solana Support Announcement](https://privy.io/blog/solana-support)

## Summary

✅ **Current app works** - users can connect via Chrome browser
✅ **Privy integration is ready** - just needs App ID to activate
✅ **Better UX with Privy** - recommended for production
✅ **Clear guidance** - users see warnings and instructions in Seeker browser

**Action Items:**
- [ ] Test current implementation in Seeker browser (should show guidance)
- [ ] Create Privy account and get App ID (if you want embedded wallet support)
- [ ] Set `NEXT_PUBLIC_PRIVY_APP_ID` in Netlify environment variables
- [ ] Deploy and test on Seeker
