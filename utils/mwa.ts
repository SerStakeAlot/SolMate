/**
 * Mobile Wallet Adapter (MWA) Utilities
 * 
 * This module provides MWA support for Seeker and other mobile wallets.
 * It works alongside the existing wallet-adapter, not replacing it.
 * 
 * Includes origin attestation support for web dApps per MWA spec.
 * 
 * To remove MWA support, simply delete this file and remove the MWA button from WalletButton.tsx
 */

import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { PublicKey, Transaction, VersionedTransaction, Connection } from '@solana/web3.js';
import { 
  handleAttestationChallenge, 
  isAttestationChallenge, 
  extractAttestationChallenge 
} from './mwaAttestation';

// Helper to decode base64 to Uint8Array (MWA returns addresses as base64)
function base64ToUint8Array(base64: string): Uint8Array {
  // Handle both browser and Node.js environments
  if (typeof atob !== 'undefined') {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } else {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
}

// APP Identity for MWA authorization
const APP_IDENTITY = {
  name: 'SolMate',
  uri: 'https://playsolmate.fun',
  icon: 'https://playsolmate.fun/images/solmate-logo.png',
};

// Store attestation token for retries
let cachedAttestationToken: string | null = null;

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
 * Supports attestation flow for web dApps per MWA spec
 */
export async function connectMWA(
  attestToken?: string,
  maxRetries: number = 2
): Promise<{ publicKey: PublicKey; authToken: string } | null> {
  console.log('[MWA] Starting connection...', attestToken ? '(with attestation)' : '');
  console.log('[MWA] User agent:', navigator.userAgent);
  console.log('[MWA] App identity:', APP_IDENTITY);
  
  try {
    // Add a timeout wrapper since transact() can hang if no wallet responds
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('MWA connection timed out after 30s. Make sure you have a compatible wallet installed (Phantom, Solflare, or Seeker).')), 30000);
    });
    
    const connectPromise = transact(async (wallet) => {
      console.log('[MWA] Wallet session opened, authorizing...');
      console.log('[MWA] Wallet object:', wallet);
      
      // Build authorize params
      const authorizeParams: any = {
        cluster: 'mainnet-beta',
        identity: APP_IDENTITY,
      };
      
      // Include attestation token if we have one
      if (attestToken || cachedAttestationToken) {
        authorizeParams.attest_origin = attestToken || cachedAttestationToken;
        console.log('[MWA] Including attestation token in authorize request');
      }
      
      // Request authorization
      const authResult = await wallet.authorize(authorizeParams);
      
      console.log('[MWA] Authorization result:', authResult);
      console.log('[MWA] Accounts:', authResult.accounts);
      
      if (authResult.accounts.length > 0) {
        const account = authResult.accounts[0];
        console.log('[MWA] First account:', account);
        console.log('[MWA] Account address (base64):', account.address);
        
        // IMPORTANT: account.address is base64-encoded, need to decode to bytes
        const publicKeyBytes = base64ToUint8Array(account.address);
        console.log('[MWA] PublicKey bytes length:', publicKeyBytes.length);
        
        const pubkey = new PublicKey(publicKeyBytes);
        console.log('[MWA] PublicKey (base58):', pubkey.toBase58());
        
        return {
          publicKey: pubkey,
          authToken: authResult.auth_token,
        };
      }
      
      return null;
    });
    
    const result = await Promise.race([connectPromise, timeoutPromise]);
    
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
    console.error('[MWA] Error name:', error?.name);
    console.error('[MWA] Error message:', error?.message);
    console.error('[MWA] Error code:', error?.code);
    console.error('[MWA] Error data:', error?.data);
    
    // Check if this is an attestation challenge (ERROR_ATTEST_ORIGIN_ANDROID)
    if (isAttestationChallenge(error) && maxRetries > 0) {
      console.log('[MWA] Received attestation challenge, handling...');
      const challenge = extractAttestationChallenge(error);
      
      if (challenge) {
        try {
          const attestationToken = await handleAttestationChallenge(challenge);
          cachedAttestationToken = attestationToken;
          console.log('[MWA] Got attestation token, retrying authorization...');
          
          // Retry with attestation token
          return connectMWA(attestationToken, maxRetries - 1);
        } catch (attestError: any) {
          console.error('[MWA] Attestation handling failed:', attestError);
          throw new Error(`Attestation failed: ${attestError.message}`);
        }
      }
    }
    
    // Rethrow with more context
    const errorMessage = error?.message || 'Unknown error';
    
    if (errorMessage.includes('timed out')) {
      throw new Error('Connection timed out. Make sure Phantom, Solflare, or Seeker is installed and try again.');
    }
    
    if (errorMessage.includes('No wallet found') || errorMessage.includes('no wallet')) {
      throw new Error('No MWA-compatible wallet found. Please install Phantom, Solflare, or Seeker.');
    }
    
    if (errorMessage.includes('User rejected') || errorMessage.includes('cancelled')) {
      throw new Error('Connection cancelled by user.');
    }
    
    throw new Error(`MWA Error: ${errorMessage}`);
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
