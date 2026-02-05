import { Connection, PublicKey } from '@solana/web3.js';

// SolMate Token Configuration
export const SOLMATE_TOKEN_MINT = '5CJN2E6dDU9XxDJnz3ZEELxPP8HsGTKPbsNVB2djpump';
export const TOKEN_SYMBOL = '$MATE';
export const TOKEN_DECIMALS = 6;

// SKR Token Configuration
export const SKR_TOKEN_MINT = 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3';
export const SKR_TOKEN_SYMBOL = '$SKR';
export const SKR_TOKEN_DECIMALS = 6;
export const SKR_MIN_BALANCE = 10_000 * Math.pow(10, SKR_TOKEN_DECIMALS); // 10K $SKR

// Minimum token balance required for Holder Arena access (in raw token units)
// 2 million tokens with 6 decimals = 2,000,000 * 10^6 = 2,000,000,000,000
export const HOLDER_ARENA_MIN_BALANCE = 2_000_000 * Math.pow(10, TOKEN_DECIMALS); // 2 million $MATE

// Token Program IDs
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

// Get associated token account address
async function getAssociatedTokenAddress(
  mint: PublicKey,
  owner: PublicKey,
  programId: PublicKey = TOKEN_PROGRAM_ID
): Promise<PublicKey> {
  const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
  );
  
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), programId.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  
  return address;
}

export interface TokenGateResult {
  hasAccess: boolean;
  balance: number;
  requiredBalance: number;
  error?: string;
  qualifyingToken?: 'MATE' | 'SKR' | null; // Which token granted access
  mateBalance?: number;
  skrBalance?: number;
}

/**
 * Check token balance for a specific mint
 */
async function checkTokenBalance(
  connection: Connection,
  walletPubkey: PublicKey,
  mintAddress: string
): Promise<number> {
  try {
    const mintPubkey = new PublicKey(mintAddress);
    
    // Try to get all token accounts for this wallet that hold the token
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPubkey,
      { mint: mintPubkey }
    );
    
    if (tokenAccounts.value.length === 0) {
      // Also try with Token-2022 program
      const token2022Accounts = await connection.getParsedTokenAccountsByOwner(
        walletPubkey,
        { mint: mintPubkey, programId: TOKEN_2022_PROGRAM_ID }
      ).catch(() => ({ value: [] }));
      
      if (token2022Accounts.value.length === 0) {
        return 0;
      }
      tokenAccounts.value.push(...token2022Accounts.value);
    }
    
    // Sum up balance from all accounts
    let totalBalance = 0;
    for (const account of tokenAccounts.value) {
      const parsedInfo = account.account.data.parsed?.info;
      if (parsedInfo) {
        const amount = parsedInfo.tokenAmount?.amount;
        if (amount) {
          totalBalance += parseInt(amount, 10);
        }
      }
    }
    
    return totalBalance;
  } catch (error) {
    console.error(`Error checking balance for mint ${mintAddress}:`, error);
    return 0;
  }
}

/**
 * Check if a wallet holds enough tokens for Holder Arena access
 * Supports both $MATE (2M required) and $SKR (100K required)
 */
export async function checkHolderArenaAccess(
  connection: Connection,
  walletAddress: string
): Promise<TokenGateResult> {
  try {
    const walletPubkey = new PublicKey(walletAddress);
    
    console.log('Checking token balances for wallet:', walletAddress);
    
    // Check both tokens in parallel
    const [mateBalance, skrBalance] = await Promise.all([
      checkTokenBalance(connection, walletPubkey, SOLMATE_TOKEN_MINT),
      checkTokenBalance(connection, walletPubkey, SKR_TOKEN_MINT)
    ]);
    
    console.log('$MATE balance (raw):', mateBalance, 'Required:', HOLDER_ARENA_MIN_BALANCE);
    console.log('$SKR balance (raw):', skrBalance, 'Required:', SKR_MIN_BALANCE);
    
    // Check if either token qualifies
    const hasMateAccess = mateBalance >= HOLDER_ARENA_MIN_BALANCE;
    const hasSkrAccess = skrBalance >= SKR_MIN_BALANCE;
    const hasAccess = hasMateAccess || hasSkrAccess;
    
    console.log('Has access:', hasAccess, '(MATE:', hasMateAccess, 'SKR:', hasSkrAccess, ')');
    
    return {
      hasAccess,
      balance: mateBalance, // Legacy field, keep for compatibility
      requiredBalance: HOLDER_ARENA_MIN_BALANCE,
      mateBalance,
      skrBalance,
      qualifyingToken: hasMateAccess ? 'MATE' : (hasSkrAccess ? 'SKR' : null),
    };
  } catch (error: any) {
    console.error('Token gate check error:', error);
    return {
      hasAccess: false,
      balance: 0,
      requiredBalance: HOLDER_ARENA_MIN_BALANCE,
      mateBalance: 0,
      skrBalance: 0,
      qualifyingToken: null,
      error: error.message || 'Failed to check token balance',
    };
  }
}

/**
 * Format token balance for display with token symbol
 */
export function formatTokenBalance(rawBalance: number, decimals: number = TOKEN_DECIMALS, symbol: string = TOKEN_SYMBOL): string {
  const balance = rawBalance / Math.pow(10, decimals);
  if (balance >= 1_000_000) {
    return `${(balance / 1_000_000).toFixed(2)}M ${symbol}`;
  }
  if (balance >= 1_000) {
    return `${(balance / 1_000).toFixed(2)}K ${symbol}`;
  }
  return `${balance.toFixed(0)} ${symbol}`;
}

/**
 * Format SKR token balance for display
 */
export function formatSkrBalance(rawBalance: number): string {
  return formatTokenBalance(rawBalance, SKR_TOKEN_DECIMALS, SKR_TOKEN_SYMBOL);
}

/**
 * Get minimum required tokens formatted for display
 */
export function getMinimumRequiredDisplay(decimals: number = TOKEN_DECIMALS): string {
  return formatTokenBalance(HOLDER_ARENA_MIN_BALANCE, decimals);
}

/**
 * Get minimum required SKR tokens formatted for display
 */
export function getSkrMinimumRequiredDisplay(): string {
  return formatTokenBalance(SKR_MIN_BALANCE, SKR_TOKEN_DECIMALS, SKR_TOKEN_SYMBOL);
}
