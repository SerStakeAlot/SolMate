/**
 * Native MWA Bridge - Interface for Android WebView native MWA
 * 
 * When running in the SolMate Android app (WebView), the NativeMwa
 * JavaScript interface is injected, allowing direct communication
 * with the native Mobile Wallet Adapter.
 */

// Type definitions for the native bridge
interface NativeMwaResult {
  success: boolean;
  publicKey?: string;
  publicKeyBase64?: string;
  accountLabel?: string;
  walletName?: string;
  signedTransaction?: string;
  signature?: string;
  signatureBase64?: string;
  error?: string;
}

interface NativeMwaConnectionStatus {
  connected: boolean;
  publicKey?: string;
  accountLabel?: string;
}

// The native bridge interface (injected by Android WebView)
interface NativeMwaBridge {
  isAvailable(): boolean;
  getConnectionStatus(): string; // Returns JSON string
  connect(cluster: string, appName: string, appUri: string, appIcon: string): string; // Returns JSON string
  disconnect(): string; // Returns JSON string
  signTransaction(transactionBase64: string): string; // Returns JSON string
  signAndSendTransaction(transactionBase64: string): string; // Returns JSON string
}

declare global {
  interface Window {
    NativeMwa?: NativeMwaBridge;
    isNativeMwaAvailable?: boolean;
    nativeMwaVersion?: string;
  }
}

/**
 * Check if native MWA bridge is available
 */
export function isNativeMwaAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window.NativeMwa && window.NativeMwa.isAvailable && window.NativeMwa.isAvailable());
}

/**
 * Wait for native MWA bridge to be ready
 */
export function waitForNativeMwa(timeout: number = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    if (isNativeMwaAvailable()) {
      resolve(true);
      return;
    }

    // Listen for the nativeMwaReady event
    const handler = () => {
      window.removeEventListener('nativeMwaReady', handler);
      resolve(true);
    };
    window.addEventListener('nativeMwaReady', handler);

    // Also poll in case event was missed
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (isNativeMwaAvailable()) {
        clearInterval(interval);
        window.removeEventListener('nativeMwaReady', handler);
        resolve(true);
      } else if (Date.now() - startTime >= timeout) {
        clearInterval(interval);
        window.removeEventListener('nativeMwaReady', handler);
        resolve(false);
      }
    }, 100);
  });
}

/**
 * Get the current connection status
 */
export function getNativeMwaStatus(): NativeMwaConnectionStatus | null {
  if (!isNativeMwaAvailable()) return null;
  
  try {
    const resultJson = window.NativeMwa!.getConnectionStatus();
    return JSON.parse(resultJson) as NativeMwaConnectionStatus;
  } catch (e) {
    console.error('[NativeMwa] Failed to get status:', e);
    return null;
  }
}

/**
 * Connect to wallet using native MWA
 */
export async function connectNativeMwa(
  cluster: string = 'mainnet-beta',
  appName: string = 'SolMate',
  appUri: string = 'https://playsolmate.fun',
  appIcon: string = 'https://playsolmate.fun/images/solmate-logo.png'
): Promise<NativeMwaResult> {
  console.log('[NativeMwa] Connecting...', { cluster, appName });
  
  if (!isNativeMwaAvailable()) {
    return { success: false, error: 'Native MWA bridge not available' };
  }

  try {
    // The native call is blocking, so we wrap it in a promise
    // to avoid blocking the UI thread
    const resultJson = await new Promise<string>((resolve) => {
      // Use setTimeout to allow UI to update before blocking call
      setTimeout(() => {
        const result = window.NativeMwa!.connect(cluster, appName, appUri, appIcon);
        resolve(result);
      }, 100);
    });
    
    const result = JSON.parse(resultJson) as NativeMwaResult;
    console.log('[NativeMwa] Connect result:', result);
    return result;
  } catch (e) {
    console.error('[NativeMwa] Connect error:', e);
    return { success: false, error: String(e) };
  }
}

/**
 * Disconnect from wallet
 */
export function disconnectNativeMwa(): NativeMwaResult {
  if (!isNativeMwaAvailable()) {
    return { success: false, error: 'Native MWA bridge not available' };
  }

  try {
    const resultJson = window.NativeMwa!.disconnect();
    return JSON.parse(resultJson) as NativeMwaResult;
  } catch (e) {
    console.error('[NativeMwa] Disconnect error:', e);
    return { success: false, error: String(e) };
  }
}

/**
 * Sign a transaction
 * @param transactionBase64 - Base64 encoded serialized transaction
 */
export async function signTransactionNativeMwa(transactionBase64: string): Promise<NativeMwaResult> {
  console.log('[NativeMwa] Signing transaction...');
  
  if (!isNativeMwaAvailable()) {
    return { success: false, error: 'Native MWA bridge not available' };
  }

  try {
    const resultJson = await new Promise<string>((resolve) => {
      setTimeout(() => {
        const result = window.NativeMwa!.signTransaction(transactionBase64);
        resolve(result);
      }, 100);
    });
    
    const result = JSON.parse(resultJson) as NativeMwaResult;
    console.log('[NativeMwa] Sign result:', result);
    return result;
  } catch (e) {
    console.error('[NativeMwa] Sign error:', e);
    return { success: false, error: String(e) };
  }
}

/**
 * Sign and send a transaction
 * @param transactionBase64 - Base64 encoded serialized transaction
 */
export async function signAndSendTransactionNativeMwa(transactionBase64: string): Promise<NativeMwaResult> {
  console.log('[NativeMwa] Sign and send transaction...');
  
  if (!isNativeMwaAvailable()) {
    return { success: false, error: 'Native MWA bridge not available' };
  }

  try {
    const resultJson = await new Promise<string>((resolve) => {
      setTimeout(() => {
        const result = window.NativeMwa!.signAndSendTransaction(transactionBase64);
        resolve(result);
      }, 100);
    });
    
    const result = JSON.parse(resultJson) as NativeMwaResult;
    console.log('[NativeMwa] Sign and send result:', result);
    return result;
  } catch (e) {
    console.error('[NativeMwa] Sign and send error:', e);
    return { success: false, error: String(e) };
  }
}

/**
 * Convert a transaction to base64 for native signing
 */
export function transactionToBase64(transaction: { serialize(): Uint8Array }): string {
  const serialized = transaction.serialize();
  // Convert Uint8Array to base64
  let binary = '';
  const bytes = new Uint8Array(serialized);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 back to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
