import { Connection, PublicKey } from '@solana/web3.js';

// SolMate Token Configuration
export const SOLMATE_TOKEN_MINT = '5CJN2E6dDU9XxDJnz3ZEELxPP8HsGTKPbsNVB2djpump';
export const TOKEN_SYMBOL = '$MATE';
export const TOKEN_DECIMALS = 6;

// Minimum token balance required for Holder Arena access (in raw token units)
// 1 million tokens with 6 decimals = 1,000,000 * 10^6 = 1,000,000,000,000
export const HOLDER_ARENA_MIN_BALANCE = 1_000_000 * Math.pow(10, TOKEN_DECIMALS); // 1 million $MATE

// Token Program ID (SPL Token)
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

// Get associated token account address
async function getAssociatedTokenAddress(
  mint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
  );
  
  const [address] = await PublicKey.findProgramAddress(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  
  return address;
}

export interface TokenGateResult {
  hasAccess: boolean;
  balance: number;
  requiredBalance: number;
  error?: string;
}

/**
 * Check if a wallet holds enough SolMate tokens for Holder Arena access
 */
export async function checkHolderArenaAccess(
  connection: Connection,
  walletAddress: string
): Promise<TokenGateResult> {
  try {
    const walletPubkey = new PublicKey(walletAddress);
    const mintPubkey = new PublicKey(SOLMATE_TOKEN_MINT);
    
    // Get the associated token account
    const tokenAccount = await getAssociatedTokenAddress(mintPubkey, walletPubkey);
    
    // Try to get the token account info
    const accountInfo = await connection.getAccountInfo(tokenAccount);
    
    if (!accountInfo) {
      // No token account exists - user has 0 tokens
      return {
        hasAccess: false,
        balance: 0,
        requiredBalance: HOLDER_ARENA_MIN_BALANCE,
      };
    }
    
    // Parse the token account data to get balance
    // SPL Token account layout: mint (32) + owner (32) + amount (8) + ...
    const data = accountInfo.data;
    const balance = Number(data.readBigUInt64LE(64));
    
    return {
      hasAccess: balance >= HOLDER_ARENA_MIN_BALANCE,
      balance,
      requiredBalance: HOLDER_ARENA_MIN_BALANCE,
    };
  } catch (error: any) {
    console.error('Token gate check error:', error);
    return {
      hasAccess: false,
      balance: 0,
      requiredBalance: HOLDER_ARENA_MIN_BALANCE,
      error: error.message || 'Failed to check token balance',
    };
  }
}

/**
 * Format token balance for display with $MATE symbol
 */
export function formatTokenBalance(rawBalance: number, decimals: number = TOKEN_DECIMALS): string {
  const balance = rawBalance / Math.pow(10, decimals);
  if (balance >= 1_000_000) {
    return `${(balance / 1_000_000).toFixed(2)}M ${TOKEN_SYMBOL}`;
  }
  if (balance >= 1_000) {
    return `${(balance / 1_000).toFixed(2)}K ${TOKEN_SYMBOL}`;
  }
  return `${balance.toFixed(0)} ${TOKEN_SYMBOL}`;
}

/**
 * Get minimum required tokens formatted for display
 */
export function getMinimumRequiredDisplay(decimals: number = TOKEN_DECIMALS): string {
  return formatTokenBalance(HOLDER_ARENA_MIN_BALANCE, decimals);
}
export function getMinimumRequiredDisplay(decimals: number = 6): string {
  return formatTokenBalance(HOLDER_ARENA_MIN_BALANCE, decimals);
}
