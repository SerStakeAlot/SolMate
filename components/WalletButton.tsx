'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletName, WalletReadyState } from '@solana/wallet-adapter-base';
import { usePrivy, useWallets } from '@privy-io/react-auth';

// Check if Privy is configured
const PRIVY_ENABLED = !!process.env.NEXT_PUBLIC_PRIVY_APP_ID;

// Detect if we're on a mobile device
const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Detect if we're in a mobile wallet's in-app browser
const isInWalletBrowser = () => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('phantom') || ua.includes('solflare') || ua.includes('backpack');
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

// Privy-based wallet button
const PrivyWalletButtonInner: React.FC = () => {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();

  // Find Solana wallet - check for address length typical of Solana (32-44 chars base58)
  const solanaWallet = wallets?.find((w: any) => 
    w.walletClientType === 'solana' || 
    (w.address && w.address.length >= 32 && w.address.length <= 44 && !w.address.startsWith('0x'))
  );
  const walletAddress = solanaWallet?.address;
  const connected = authenticated && !!walletAddress;

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const handleConnect = useCallback(async () => {
    if (!ready) return;
    try {
      console.log('Privy login triggered');
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

  if (!ready) {
    return (
      <button style={{ ...connectButtonStyle, opacity: 0.7 }} disabled>
        Loading...
      </button>
    );
  }

  return (
    <div className="relative group" style={{ zIndex: 100, position: 'relative' }}>
      {connected && walletAddress ? (
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
          {shortenAddress(walletAddress)}
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

// Standard wallet-adapter based button (fallback)
const StandardWalletButton: React.FC = () => {
  const { connected, publicKey, wallets, select, disconnect, connecting, connect, wallet } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const connectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  // Auto-close modal when connected
  useEffect(() => {
    if (connected) {
      setShowModal(false);
      setConnectionStatus('');
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
      }
    }
  }, [connected]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
      }
    };
  }, []);

  const handleConnect = useCallback(async () => {
    // Clear any previous timeout
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
    }

    // If in wallet browser (Phantom app, etc.), try to auto-detect the wallet
    if (isInWalletBrowser()) {
      console.log('In-wallet browser detected, trying to auto-connect...');
      setConnectionStatus('Connecting...');
      
      const installedWallet = wallets.find(w => 
        (w.readyState === WalletReadyState.Installed || 
         w.readyState === WalletReadyState.Loadable) &&
        w.adapter.name !== 'Mobile Wallet Adapter'
      );
      if (installedWallet) {
        try {
          select(installedWallet.adapter.name);
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Set a timeout to clear status
          connectTimeoutRef.current = setTimeout(() => {
            setConnectionStatus('');
          }, 8000);
          
          await connect();
          console.log('Auto-connected to:', installedWallet.adapter.name);
          setConnectionStatus('');
          return;
        } catch (error) {
          console.log('Auto-connect failed:', error);
          setConnectionStatus('');
        }
      }
    }
    
    // For all other cases (including Seeker native browser), just show the modal
    // This is more reliable than trying MWA auto-connect which can hang
    setShowModal(true);
  }, [wallets, select, connect]);

  const handleSelectWallet = useCallback(async (walletName: WalletName) => {
    console.log('Selected wallet:', walletName);
    setShowModal(false);
    
    // For MWA, show status and set a shorter timeout
    const isMWA = walletName === 'Mobile Wallet Adapter';
    if (isMWA) {
      setConnectionStatus('Opening wallet app...');
    }
    
    try {
      // Select the wallet first
      select(walletName);
      
      // Give the adapter a moment to initialize, then connect
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Set a timeout to abort if connection hangs
      if (isMWA) {
        connectTimeoutRef.current = setTimeout(() => {
          console.log('MWA connection timeout');
          setConnectionStatus('');
          alert('Could not open wallet app. Try opening Phantom first, then return to SolMate.');
        }, 5000); // 5 second timeout for MWA
      }
      
      // Now try to connect
      await connect();
      console.log('Connected successfully!');
      setConnectionStatus('');
      
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
      }
    } catch (error: any) {
      console.log('Connection error:', error?.message || error);
      setConnectionStatus('');
      
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
      }
      
      // If Mobile Wallet Adapter fails, guide user
      if (isMWA) {
        alert('Could not connect to wallet app.\n\nTry:\n1. Open Phantom app first\n2. Then come back to SolMate\n3. Or use Phantom\'s in-app browser to visit playsolmate.fun');
        return;
      }
      
      // If wallet not detected, try to open the wallet's website/app store
      const selectedWallet = wallets.find(w => w.adapter.name === walletName);
      if (selectedWallet?.adapter.readyState === WalletReadyState.NotDetected) {
        const url = selectedWallet.adapter.url;
        if (url) {
          window.open(url, '_blank');
        }
      }
    }
  }, [select, connect, wallets]);

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
            {connecting ? 'Connecting...' : connectionStatus || 'Connect Wallet'}
          </button>
        )}
        
        {/* Status indicator for MWA - tap anywhere to cancel */}
        {connectionStatus && !showModal && (
          <div 
            onClick={() => {
              setConnectionStatus('');
              if (connectTimeoutRef.current) {
                clearTimeout(connectTimeoutRef.current);
              }
              // Also try to disconnect/reset the wallet state
              try {
                disconnect();
              } catch (e) {
                // ignore
              }
            }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 999998,
              cursor: 'pointer',
            }}
          >
            <div style={{
              backgroundColor: 'rgba(153, 69, 255, 0.9)',
              color: '#fff',
              padding: '20px 32px',
              borderRadius: '16px',
              fontSize: '16px',
              textAlign: 'center',
              maxWidth: '280px',
            }}>
              <div style={{ marginBottom: '8px' }}>{connectionStatus}</div>
              <div style={{ fontSize: '13px', opacity: 0.8 }}>
                Tap anywhere to cancel
              </div>
            </div>
          </div>
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
            <div>
              {/* On mobile, show MWA option prominently */}
              {isMobile && !isInWalletBrowser() && (
                <button
                  style={{
                    ...walletButtonStyle,
                    background: 'linear-gradient(135deg, rgba(153, 69, 255, 0.2), rgba(20, 241, 149, 0.2))',
                    borderColor: 'rgba(153, 69, 255, 0.4)',
                    marginBottom: '16px',
                  }}
                  onClick={() => handleSelectWallet('Mobile Wallet Adapter' as WalletName)}
                >
                  <div style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #9945FF, #14F195)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px'
                  }}>
                    📱
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span>Open Wallet App</span>
                    <span style={{ fontSize: '11px', color: '#14F195' }}>Phantom, Solflare, etc.</span>
                  </div>
                </button>
              )}
              
              {wallets.filter(w => w.adapter.name !== 'Mobile Wallet Adapter').map((wallet) => {
                const isInstalled = wallet.readyState === WalletReadyState.Installed || 
                                    wallet.readyState === WalletReadyState.Loadable;
                return (
                  <button
                    key={wallet.adapter.name}
                    style={{
                      ...walletButtonStyle,
                      opacity: isInstalled ? 1 : 0.6,
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
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
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
                      {!isInstalled && (
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

// Main export - use Privy when configured, otherwise standard wallet adapter
export const WalletButton: React.FC = () => {
  if (PRIVY_ENABLED) {
    return <PrivyWalletButtonInner />;
  }
  return <StandardWalletButton />;
};
