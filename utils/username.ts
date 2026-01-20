const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://solmate-production.up.railway.app';

export interface UsernameResult {
  success: boolean;
  username?: string;
  error?: string;
}

// Get username for a wallet address
export async function getUsername(walletAddress: string): Promise<string | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/username/${walletAddress}`);
    const data = await response.json();
    return data.username || null;
  } catch (error) {
    console.error('Error fetching username:', error);
    return null;
  }
}

// Get multiple usernames (batch lookup)
export async function getUsernames(walletAddresses: string[]): Promise<Record<string, string>> {
  if (walletAddresses.length === 0) return {};
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/usernames`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddresses }),
    });
    const data = await response.json();
    return data.usernames || {};
  } catch (error) {
    console.error('Error fetching usernames:', error);
    return {};
  }
}

// Check if username is available
export async function checkUsernameAvailable(username: string, currentWallet?: string): Promise<boolean> {
  try {
    const params = currentWallet ? `?wallet=${currentWallet}` : '';
    const response = await fetch(`${BACKEND_URL}/api/username/check/${encodeURIComponent(username)}${params}`);
    const data = await response.json();
    return data.available;
  } catch (error) {
    console.error('Error checking username:', error);
    return false;
  }
}

// Set username for a wallet
export async function setUsername(walletAddress: string, username: string): Promise<UsernameResult> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/username`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, username }),
    });
    const data = await response.json();
    
    if (data.success) {
      return { success: true, username: data.username };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('Error setting username:', error);
    return { success: false, error: 'Network error' };
  }
}

// Format display name: username if set, otherwise shortened wallet
export function formatDisplayName(walletAddress: string, username?: string | null): string {
  if (username) {
    return username;
  }
  return `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
}
