'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletName, WalletReadyState } from '@solana/wallet-adapter-base';

// Check if running on Android mobile
const isAndroid = () => {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
};

export const WalletButton: React.FC = () => {
  const { connected, publicKey, wallets, select, disconnect, connecting, connect, wallet } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const [isMobileAndroid, setIsMobileAndroid] = useState(false);

  useEffect(() => {
    setIsMobileAndroid(isAndroid());
  }, []);

  const handleConnect = useCallback(() => {
    setShowModal(true);
  }, []);

  // Effect to auto-connect when wallet is selected
  useEffect(() => {
    if (wallet && !connected && !connecting) {
      console.log('Wallet selected, attempting auto-connect:', wallet.adapter.name);
      connect().catch((error) => {
        console.log('Auto-connect error:', error?.message || error);
      });
    }
  }, [wallet, connected, connecting, connect]);

  const handleSelectWallet = useCallback(async (walletName: WalletName) => {
    console.log('Selected wallet:', walletName, 'isMobileAndroid:', isMobileAndroid);
    setShowModal(false);
    
    try {
      // Select the wallet - this will trigger the useEffect above to connect
      select(walletName);
      console.log('Wallet selected, waiting for connection...');
    } catch (error: any) {
      console.log('Selection error:', error?.message || error);
      
      // If wallet not detected, try to open the wallet's website/app store
      const selectedWallet = wallets.find(w => w.adapter.name === walletName);
      if (selectedWallet?.adapter.readyState === WalletReadyState.NotDetected) {
        const url = selectedWallet.adapter.url;
        if (url) {
          window.open(url, '_blank');
        }
      }
    }
  }, [select, wallets, isMobileAndroid]);

  const handleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  // Custom modal styles - inline to ensure they work on mobile Safari
  const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999999,
    padding: '20px',
    boxSizing: 'border-box',
  };

  const modalContainerStyle: React.CSSProperties = {
    backgroundColor: '#1a1a1a',
    border: '2px solid #9945FF',
    borderRadius: '16px',
    padding: '24px',
    width: '90%',
    maxWidth: '320px',
    position: 'relative',
  };

  const modalTitleStyle: React.CSSProperties = {
    color: '#ffffff',
    fontSize: '18px',
    fontWeight: 700,
    marginBottom: '20px',
    textAlign: 'center',
  };

  const walletButtonStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 16px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '12px',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
    marginBottom: '10px',
    textAlign: 'left',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
  };

  const closeButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: '12px',
    right: '12px',
    backgroundColor: '#333',
    border: 'none',
    borderRadius: '8px',
    width: '32px',
    height: '32px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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

  return (
    <>
      <div className="relative group" style={{ zIndex: 100, position: 'relative' }}>
        {connected && publicKey ? (
          <button
            onClick={handleDisconnect}
            style={connectButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1) inset, 0 0 20px rgba(153, 69, 255, 0.15)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.05) inset';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {shortenAddress(publicKey.toBase58())}
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting}
            style={{
              ...connectButtonStyle,
              ...(connecting ? { opacity: 0.7, cursor: 'not-allowed' } : {})
            }}
            onMouseEnter={(e) => {
              if (!connecting) {
                e.currentTarget.style.background = 'linear-gradient(135deg, #9945FF 0%, #14F195 100%)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(153, 69, 255, 0.4), 0 4px 16px rgba(20, 241, 149, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.15) inset';
                e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)';
              }
            }}
            onMouseLeave={(e) => {
              if (!connecting) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.05) inset';
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
              }
            }}
          >
            {connecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        )}
      </div>

      {/* Custom Wallet Modal */}
      {showModal && (
        <div 
          style={modalOverlayStyle}
          onClick={() => setShowModal(false)}
        >
          <div 
            style={modalContainerStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              style={closeButtonStyle}
              onClick={() => setShowModal(false)}
            >
              ✕
            </button>
            <div style={modalTitleStyle}>Connect Wallet</div>
            {isMobileAndroid && (
              <div style={{ fontSize: '11px', color: '#14F195', textAlign: 'center', marginBottom: '12px', padding: '8px', background: 'rgba(20, 241, 149, 0.1)', borderRadius: '8px' }}>
                📱 Mobile detected - tap your wallet
              </div>
            )}
            <div>
              {wallets.map((wallet) => {
                const isInstalled = wallet.readyState === WalletReadyState.Installed || 
                                    wallet.readyState === WalletReadyState.Loadable;
                // On Android, prioritize showing the Mobile Wallet Adapter
                const isMobileWallet = wallet.adapter.name.includes('Mobile');
                const showAsReady = isMobileAndroid && isMobileWallet ? true : isInstalled;
                
                return (
                  <button
                    key={wallet.adapter.name}
                    style={{
                      ...walletButtonStyle,
                      opacity: showAsReady ? 1 : 0.6,
                      ...(isMobileAndroid && isMobileWallet ? { border: '1px solid rgba(20, 241, 149, 0.4)' } : {}),
                    }}
                    onClick={() => handleSelectWallet(wallet.adapter.name)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.borderColor = 'rgba(153, 69, 255, 0.4)';
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1) inset, 0 0 20px rgba(153, 69, 255, 0.2)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                      e.currentTarget.style.borderColor = isMobileAndroid && isMobileWallet ? 'rgba(20, 241, 149, 0.4)' : 'rgba(255, 255, 255, 0.12)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.05) inset';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {wallet.adapter.icon && (
                      <img 
                        src={wallet.adapter.icon} 
                        alt={wallet.adapter.name}
                        style={{ width: '32px', height: '32px', borderRadius: '8px' }}
                      />
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span>{wallet.adapter.name}</span>
                      {isMobileAndroid && isMobileWallet && (
                        <span style={{ fontSize: '11px', color: '#14F195' }}>Recommended for Seeker</span>
                      )}
                      {!showAsReady && !isMobileWallet && (
                        <span style={{ fontSize: '11px', color: '#888' }}>Tap to install</span>
                      )}
                    </div>
                  </button>
                );
              })}
              {wallets.length === 0 && (
                <p style={{ color: '#888', textAlign: 'center', fontSize: '14px' }}>
                  No wallet detected. Please install Phantom or Solflare.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
