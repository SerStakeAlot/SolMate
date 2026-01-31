import { Connection, PublicKey } from '@solana/web3.js';

// SolMate Token Configuration
export const SOLMATE_TOKEN_MINT = '5CJN2E6dDU9XxDJnz3ZEELxPP8HsGTKPbsNVB2djpump';
export const TOKEN_SYMBOL = '$MATE';
export const TOKEN_DECIMALS = 6;

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
    
    console.log('Checking token balance for wallet:', walletAddress);
    console.log('Token mint:', SOLMATE_TOKEN_MINT);
    
    // Try to get all token accounts for this wallet that hold our token
    // This is more reliable than computing the ATA directly
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPubkey,
      { mint: mintPubkey }
    );
    
    console.log('Token accounts found:', tokenAccounts.value.length);
    
    if (tokenAccounts.value.length === 0) {
      // Also try with Token-2022 program (some pump.fun tokens use this)
      const token2022Accounts = await connection.getParsedTokenAccountsByOwner(
        walletPubkey,
        { mint: mintPubkey, programId: TOKEN_2022_PROGRAM_ID }
      ).catch(() => ({ value: [] }));
      
      if (token2022Accounts.value.length === 0) {
        console.log('No token accounts found for this mint');
        return {
          hasAccess: false,
          balance: 0,
          requiredBalance: HOLDER_ARENA_MIN_BALANCE,
        };
      }
      
      // Use Token-2022 accounts
      tokenAccounts.value.push(...token2022Accounts.value);
    }
    
    // Sum up balance from all accounts (usually just one)
    let totalBalance = 0;
    for (const account of tokenAccounts.value) {
      const parsedInfo = account.account.data.parsed?.info;
      if (parsedInfo) {
        const amount = parsedInfo.tokenAmount?.amount;
        if (amount) {
          totalBalance += parseInt(amount, 10);
          console.log('Account balance (raw):', amount);
        }
      }
    }
    
    console.log('Total balance (raw):', totalBalance);
    console.log('Required (raw):', HOLDER_ARENA_MIN_BALANCE);
    console.log('Has access:', totalBalance >= HOLDER_ARENA_MIN_BALANCE);
    
    return {
      hasAccess: totalBalance >= HOLDER_ARENA_MIN_BALANCE,
      balance: totalBalance,
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
