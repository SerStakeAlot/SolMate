/**
 * Mobile Wallet Adapter (MWA) Utilities
 * 
 * This module provides MWA support for Seeker and other mobile wallets.
 * It works alongside the existing wallet-adapter, not replacing it.
 * 
 * To remove MWA support, simply delete this file and remove the MWA button from WalletButton.tsx
 */

import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { PublicKey, Transaction, VersionedTransaction, Connection } from '@solana/web3.js';

// APP Identity for MWA authorization
const APP_IDENTITY = {
  name: 'SolMate',
  uri: 'https://playsolmate.fun',
  icon: 'https://playsolmate.fun/images/solmate-logo.png',
};

// MWA connection state stored in memory
let mwaPublicKey: PublicKey | null = null;
let mwaAuthToken: string | null = null;

// Event emitter for MWA state changes
type MWAListener = (connected: boolean, publicKey: PublicKey | null) => void;
const listeners: Set<MWAListener> = new Set();

export function addMWAListener(listener: MWAListener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function notifyListeners() {
  listeners.forEach(listener => listener(!!mwaPublicKey, mwaPublicKey));
}

/**
 * Check if we're on a mobile device
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Check if MWA is likely available (Android device)
 */
export function isMWAAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  // MWA is primarily available on Android
  return /Android/i.test(navigator.userAgent);
}

/**
 * Get current MWA connection state
 */
export function getMWAState() {
  return {
    connected: !!mwaPublicKey,
    publicKey: mwaPublicKey,
  };
}

/**
 * Connect via MWA - opens the wallet app for authorization
 */
export async function connectMWA(): Promise<{ publicKey: PublicKey; authToken: string } | null> {
  console.log('[MWA] Starting connection...');
  
  try {
    const result = await transact(async (wallet) => {
      console.log('[MWA] Wallet session opened, authorizing...');
      
      // Request authorization
      const authResult = await wallet.authorize({
        cluster: 'mainnet-beta',
        identity: APP_IDENTITY,
      });
      
      console.log('[MWA] Authorization result:', authResult);
      
      if (authResult.accounts.length > 0) {
        const account = authResult.accounts[0];
        const pubkey = new PublicKey(account.address);
        
        return {
          publicKey: pubkey,
          authToken: authResult.auth_token,
        };
      }
      
      return null;
    });
    
    if (result) {
      mwaPublicKey = result.publicKey;
      mwaAuthToken = result.authToken;
      console.log('[MWA] Connected:', mwaPublicKey.toBase58());
      notifyListeners();
      return result;
    }
    
    return null;
  } catch (error: any) {
    console.error('[MWA] Connection error:', error);
    
    // Check for specific MWA errors
    if (error.message?.includes('No wallet found')) {
      throw new Error('No MWA-compatible wallet found. Please install Seeker, Phantom, or Solflare.');
    }
    
    throw error;
  }
}

/**
 * Disconnect MWA
 */
export function disconnectMWA() {
  mwaPublicKey = null;
  mwaAuthToken = null;
  console.log('[MWA] Disconnected');
  notifyListeners();
}

/**
 * Sign and send a transaction via MWA
 */
export async function signAndSendTransactionMWA(
  transaction: Transaction | VersionedTransaction,
  connection: Connection
): Promise<string> {
  if (!mwaPublicKey) {
    throw new Error('MWA not connected');
  }
  
  console.log('[MWA] Signing and sending transaction...');
  
  try {
    const signatures = await transact(async (wallet) => {
      // Reauthorize if we have a token
      if (mwaAuthToken) {
        try {
          await wallet.reauthorize({
            auth_token: mwaAuthToken,
            identity: APP_IDENTITY,
          });
        } catch (e) {
          // If reauthorize fails, do a full authorize
          console.log('[MWA] Reauthorize failed, doing full authorize');
          const authResult = await wallet.authorize({
            cluster: 'mainnet-beta',
            identity: APP_IDENTITY,
          });
          mwaAuthToken = authResult.auth_token;
        }
      } else {
        const authResult = await wallet.authorize({
          cluster: 'mainnet-beta',
          identity: APP_IDENTITY,
        });
        mwaAuthToken = authResult.auth_token;
      }
      
      // For MWA, we pass the transaction object directly - it handles serialization
      // Sign and send
      const result = await wallet.signAndSendTransactions({
        transactions: [transaction],
      });
      
      return result;
    });
    
    if (signatures && signatures.length > 0) {
      // The result is an array of base64-encoded signatures
      const signature = signatures[0];
      console.log('[MWA] Transaction sent:', signature);
      return signature;
    }
    
    throw new Error('No signature returned from wallet');
  } catch (error: any) {
    console.error('[MWA] Transaction error:', error);
    throw error;
  }
}

/**
 * Sign a message via MWA
 */
export async function signMessageMWA(message: Uint8Array): Promise<Uint8Array> {
  if (!mwaPublicKey) {
    throw new Error('MWA not connected');
  }
  
  console.log('[MWA] Signing message...');
  
  try {
    const signatures = await transact(async (wallet) => {
      // Reauthorize
      if (mwaAuthToken) {
        try {
          await wallet.reauthorize({
            auth_token: mwaAuthToken,
            identity: APP_IDENTITY,
          });
        } catch (e) {
          const authResult = await wallet.authorize({
            cluster: 'mainnet-beta',
            identity: APP_IDENTITY,
          });
          mwaAuthToken = authResult.auth_token;
        }
      }
      
      const result = await wallet.signMessages({
        addresses: [mwaPublicKey!.toBase58()],
        payloads: [message],
      });
      
      return result;
    });
    
    if (signatures && signatures.length > 0) {
      return signatures[0];
    }
    
    throw new Error('No signature returned from wallet');
  } catch (error: any) {
    console.error('[MWA] Sign message error:', error);
    throw error;
  }
}
