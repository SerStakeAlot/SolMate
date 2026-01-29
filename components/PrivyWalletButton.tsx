'use client';

import React, { useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

// This component uses Privy for wallet connection
// It provides the same interface expected by the rest of the app

export const PrivyWalletButton: React.FC = () => {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();

  // Get the first connected Solana wallet
  const solanaWallet = wallets?.find(w => (w as any).walletClientType === 'solana' || w.address?.length === 44);
  const publicKey = solanaWallet?.address ? new PublicKey(solanaWallet.address) : null;
  const connected = authenticated && !!publicKey;

  const handleConnect = useCallback(async () => {
    if (!ready) return;
    
    try {
      await login();
    } catch (error) {
      console.error('Privy login error:', error);
    }
  }, [ready, login]);

  const handleDisconnect = useCallback(async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Privy logout error:', error);
    }
  }, [logout]);

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const connectButtonStyle: React.CSSProperties = {
    position: 'relative',
    zIndex: 101,
    backgroundColor: 'transparent',
    color: '#fff',
    fontWeight: 600,
    borderRadius: '12px',
    padding: '10px 20px',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    cursor: 'pointer',
    fontSize: '14px',
    background: 'rgba(255, 255, 255, 0.04)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  };

  if (!ready) {
    return (
      <button style={{ ...connectButtonStyle, opacity: 0.5, cursor: 'not-allowed' }} disabled>
        Loading...
      </button>
    );
  }

  return (
    <div className="relative group" style={{ zIndex: 100, position: 'relative' }}>
      {connected && publicKey ? (
        <button
          onClick={handleDisconnect}
          style={connectButtonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          }}
        >
          {shortenAddress(publicKey.toBase58())}
        </button>
      ) : (
        <button
          onClick={handleConnect}
          style={connectButtonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #9945FF 0%, #14F195 100%)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          }}
        >
          Connect Wallet
        </button>
      )}
    </div>
  );
};

// Hook to get Privy wallet state in the same format as wallet-adapter
export function usePrivyWallet() {
  const { ready, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  
  const solanaWallet = wallets?.find(w => (w as any).walletClientType === 'solana' || w.address?.length === 44);
  const publicKey = solanaWallet?.address ? new PublicKey(solanaWallet.address) : null;
  const connected = authenticated && !!publicKey;
  
  // Create a signTransaction function compatible with wallet-adapter
  const signTransaction = useCallback(async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
    if (!solanaWallet) {
      throw new Error('No wallet connected');
    }
    
    // Privy's Solana wallet has a signTransaction method
    const signed = await (solanaWallet as any).signTransaction(tx);
    return signed as T;
  }, [solanaWallet]);

  const sendTransaction = useCallback(async (
    tx: Transaction,
    connection: any,
    options?: any
  ): Promise<string> => {
    if (!solanaWallet) {
      throw new Error('No wallet connected');
    }
    
    // Sign and send
    const signed = await signTransaction(tx);
    const signature = await connection.sendRawTransaction(signed.serialize(), options);
    return signature;
  }, [solanaWallet, signTransaction]);

  return {
    connected,
    connecting: !ready || !walletsReady,
    publicKey,
    wallet: solanaWallet ? {
      adapter: {
        name: 'Privy',
        publicKey,
      },
      readyState: connected ? 'Connected' : 'NotDetected',
    } : null,
    signTransaction: connected ? signTransaction : undefined,
    sendTransaction: connected ? sendTransaction : undefined,
  };
}
