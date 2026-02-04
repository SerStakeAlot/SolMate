/**
 * MWA Origin Attestation for Web dApps
 * 
 * This module implements the MWA spec's dApp identity verification for web browsers.
 * When a wallet returns ERROR_ATTEST_ORIGIN_ANDROID, we use this to:
 * 1. Load the wallet's attestation script in an iframe
 * 2. Get a signed attestation of our origin
 * 3. Retry the authorization with the attestation token
 * 
 * This establishes trust from the browser security sandbox to the wallet endpoint
 * via Trusted Web Activities (TWA).
 */

// Attestation script URL - hosted on the same domain as the dApp
// This is loaded in an iframe to get origin attestation
const ATTESTATION_SCRIPT_URL = '/mwa-attestation.html';

interface AttestationChallenge {
  context: string;
  challenge: string;
  attest_origin_uri: string;
}

interface AttestationToken {
  payload: {
    origin: string;
    h: string;
    timestamp: number;
    context: string;
  };
  signature: string;
  publicKey: string;
}

// Session secret for binding attestation to this dApp instance
let sessionSecret: Uint8Array | null = null;

/**
 * Generate a session secret for binding attestations
 */
function getSessionSecret(): Uint8Array {
  if (!sessionSecret) {
    sessionSecret = crypto.getRandomValues(new Uint8Array(32));
  }
  return sessionSecret;
}

/**
 * Convert ArrayBuffer to Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Compute SHA-256 hash
 */
async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  // Copy to a plain ArrayBuffer to satisfy TypeScript
  const buffer = new ArrayBuffer(dataBuffer.length);
  new Uint8Array(buffer).set(dataBuffer);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return arrayBufferToBase64(hashBuffer);
}

/**
 * Compute the hash binding (h) for attestation
 * Per MWA spec: h = SHA256("attest-origin" || decoded_challenge || session_secret)
 */
async function computeHashBinding(challenge: string): Promise<string> {
  const decodedChallenge = atob(challenge);
  const secret = getSessionSecret();
  const secretString = String.fromCharCode(...secret);
  const bindingInput = 'attest-origin' + decodedChallenge + secretString;
  return sha256(bindingInput);
}

/**
 * Load the attestation iframe and wait for it to be ready
 */
function loadAttestationIframe(uri: string): Promise<HTMLIFrameElement> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    
    const timeoutId = setTimeout(() => {
      document.body.removeChild(iframe);
      reject(new Error('Attestation iframe load timeout'));
    }, 10000);
    
    // Listen for ready message
    const handleMessage = (event: MessageEvent) => {
      if (event.source === iframe.contentWindow) {
        if (event.data?.m === 'attestation-ready' || event.data?.m === 'pong') {
          clearTimeout(timeoutId);
          window.removeEventListener('message', handleMessage);
          resolve(iframe);
        } else if (event.data?.m === 'error') {
          clearTimeout(timeoutId);
          window.removeEventListener('message', handleMessage);
          document.body.removeChild(iframe);
          reject(new Error(event.data.error || 'Attestation error'));
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    iframe.onload = () => {
      // Send a ping to check if the script is ready
      try {
        iframe.contentWindow?.postMessage({ m: 'ping' }, '*');
      } catch (e) {
        // If postMessage fails, the iframe might be cross-origin
        console.warn('[Attestation] Could not ping iframe:', e);
      }
    };
    
    iframe.onerror = () => {
      clearTimeout(timeoutId);
      window.removeEventListener('message', handleMessage);
      reject(new Error('Failed to load attestation iframe'));
    };
    
    document.body.appendChild(iframe);
    iframe.src = uri;
  });
}

/**
 * Request origin attestation from the iframe
 */
function requestAttestation(iframe: HTMLIFrameElement, h: string, context: string): Promise<AttestationToken> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Attestation request timeout'));
    }, 10000);
    
    const handleMessage = (event: MessageEvent) => {
      if (event.source === iframe.contentWindow) {
        if (event.data?.m === 'origin-attest-response') {
          clearTimeout(timeoutId);
          window.removeEventListener('message', handleMessage);
          resolve(event.data.attestation);
        } else if (event.data?.m === 'error') {
          clearTimeout(timeoutId);
          window.removeEventListener('message', handleMessage);
          reject(new Error(event.data.error || 'Attestation failed'));
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    // Send the attestation request
    // Per MWA spec: { m: "origin-attest", h: <hash_binding>, context: <context> }
    iframe.contentWindow?.postMessage({
      m: 'origin-attest',
      h,
      context,
    }, '*');
  });
}

/**
 * Handle ERROR_ATTEST_ORIGIN_ANDROID from wallet
 * 
 * This implements the full attestation flow per the MWA spec:
 * 1. Decode the challenge from the wallet
 * 2. Compute hash binding: h = SHA256("attest-origin" || challenge || session_secret)
 * 3. Load wallet's attestation script in iframe
 * 4. Request attestation with the hash binding
 * 5. Return the attestation token for retry
 */
export async function handleAttestationChallenge(
  challengeData: AttestationChallenge
): Promise<string> {
  console.log('[MWA Attestation] Received challenge:', challengeData);
  
  const { context, challenge, attest_origin_uri } = challengeData;
  
  // Determine which attestation URI to use
  // Prefer our own if wallet doesn't provide one, or if theirs fails
  let attestUri = attest_origin_uri || ATTESTATION_SCRIPT_URL;
  
  // If the wallet provides a URI but it's not reachable, fall back to ours
  if (attest_origin_uri && !attest_origin_uri.startsWith(window.location.origin)) {
    console.log('[MWA Attestation] Using wallet attestation URI:', attest_origin_uri);
  } else {
    attestUri = window.location.origin + ATTESTATION_SCRIPT_URL;
    console.log('[MWA Attestation] Using local attestation URI:', attestUri);
  }
  
  // Compute hash binding
  const h = await computeHashBinding(challenge);
  console.log('[MWA Attestation] Computed hash binding');
  
  // Load attestation iframe
  console.log('[MWA Attestation] Loading attestation iframe:', attestUri);
  const iframe = await loadAttestationIframe(attestUri);
  
  try {
    // Request attestation
    console.log('[MWA Attestation] Requesting attestation...');
    const attestation = await requestAttestation(iframe, h, context);
    console.log('[MWA Attestation] Got attestation:', attestation);
    
    // Encode attestation token for the wallet
    const attestToken = JSON.stringify(attestation);
    const encodedToken = btoa(attestToken);
    
    return encodedToken;
  } finally {
    // Clean up iframe
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  }
}

/**
 * Check if an error is an attestation challenge
 */
export function isAttestationChallenge(error: any): error is { data: AttestationChallenge } {
  return (
    error?.code === -100 || // ERROR_ATTEST_ORIGIN_ANDROID
    error?.message?.includes('ATTEST_ORIGIN') ||
    (error?.data?.context && error?.data?.challenge)
  );
}

/**
 * Extract attestation challenge data from error
 */
export function extractAttestationChallenge(error: any): AttestationChallenge | null {
  if (error?.data?.context && error?.data?.challenge) {
    return {
      context: error.data.context,
      challenge: error.data.challenge,
      attest_origin_uri: error.data.attest_origin_uri || '',
    };
  }
  return null;
}
