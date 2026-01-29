'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletName, WalletReadyState } from '@solana/wallet-adapter-base';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';

// Check if running on Android mobile
const isAndroid = () => {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
};

export const WalletButton: React.FC = () => {
  const { connected, publicKey, wallets, select, disconnect, connecting, connect, wallet } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const [isMobileAndroid, setIsMobileAndroid] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const [mwaPublicKey, setMwaPublicKey] = useState<string | null>(null);

  useEffect(() => {
    setIsMobileAndroid(isAndroid());
    // Log available wallets on mount
    console.log('Available wallets:', wallets.map(w => ({ 
      name: w.adapter.name, 
      readyState: w.readyState,
      url: w.adapter.url 
    })));
    
    // Check for wallet-standard wallets
    if (typeof window !== 'undefined') {
      // Check window.solana (legacy)
      if ((window as any).solana) {
        console.log('window.solana detected:', (window as any).solana);
      }
      // Check for wallet-standard registry
      const walletStandard = (window as any).navigator?.wallet?.wallets || 
                             (window as any).wallets || 
                             (window as any).solanaWallets;
      if (walletStandard) {
        console.log('Wallet-standard wallets:', walletStandard);
      }
    }
  }, [wallets]);

  // Diagnostic function to check what's available
  const runDiagnostics = useCallback(() => {
    const diagnostics: string[] = [];
    
    diagnostics.push(`UA: ${navigator.userAgent.substring(0, 80)}...`);
    diagnostics.push(`Wallets: ${wallets.length}`);
    
    wallets.forEach(w => {
      diagnostics.push(`  ${w.adapter.name}: ${w.readyState}`);
    });
    
    // Check window objects
    if ((window as any).solana) {
      const sol = (window as any).solana;
      diagnostics.push(`window.solana: ${sol.isPhantom ? 'Phantom' : sol.isSolflare ? 'Solflare' : 'Unknown'}`);
    } else {
      diagnostics.push('window.solana: NOT FOUND');
    }
    
    // Check if we're in a TWA
    if ((document as any).referrer?.includes('android-app://')) {
      diagnostics.push('Running in TWA: YES');
    } else {
      diagnostics.push('TWA: Likely NO');
    }
    
    const msg = diagnostics.join('\n');
    console.log('=== DIAGNOSTICS ===\n' + msg);
    alert(msg);
  }, [wallets]);

  const handleConnect = useCallback(() => {
    setShowModal(true);
    setConnectionStatus('');
  }, []);

  // Direct MWA connection for debugging - with timeout
  const handleDirectMWA = useCallback(async () => {
    setShowModal(false);
    setConnectionStatus('Connecting via MWA...');
    
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('MWA_TIMEOUT: No wallet responded after 8 seconds. Seeker may not support MWA web protocol.')), 8000);
    });
    
    try {
      console.log('Starting direct MWA transact...');
      
      // Check if getWallets API exists (wallet-standard)
      if (typeof window !== 'undefined' && (window as any).navigator?.wallets) {
        console.log('Wallet-standard wallets found:', (window as any).navigator.wallets);
      }
      
      // Race between transact and timeout
      const result = await Promise.race([
        transact(async (wallet) => {
          console.log('Inside transact callback, authorizing...');
          setConnectionStatus('Wallet found, authorizing...');
          const authorization = await wallet.authorize({
            identity: {
              name: 'SolMate',
              uri: 'https://playsolmate.fun',
              icon: 'https://playsolmate.fun/images/logo.png',
            },
            cluster: 'mainnet-beta',
          });
          console.log('Authorization result:', authorization);
          return authorization;
        }),
        timeoutPromise
      ]) as any;
      
      console.log('MWA transact result:', result);
      if (result?.accounts?.[0]?.address) {
        const address = result.accounts[0].address;
        // Convert Uint8Array to base58 if needed
        const addressStr = typeof address === 'string' ? address : 
          Array.from(address as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0')).join('');
        setMwaPublicKey(addressStr);
        setConnectionStatus(`Connected: ${addressStr.slice(0, 8)}...`);
      }
    } catch (error: any) {
      console.error('Direct MWA error:', error);
      const errorMsg = error?.message || String(error);
      if (errorMsg.includes('MWA_TIMEOUT')) {
        setConnectionStatus('No wallet found. Try Phantom app instead.');
      } else {
        setConnectionStatus(`Error: ${errorMsg.slice(0, 50)}`);
      }
    }
  }, []);

  // Effect to auto-connect when wallet is selected
  useEffect(() => {
    if (wallet && !connected && !connecting) {
      console.log('Wallet selected, attempting auto-connect:', wallet.adapter.name, 'readyState:', wallet.readyState);
      setConnectionStatus('Connecting...');
      
      // Add timeout for mobile wallet adapter which can hang in TWAs
      const timeoutId = setTimeout(() => {
        setConnectionStatus('Connection timed out - try Phantom or Solflare instead');
      }, 10000); // 10 second timeout
      
      connect()
        .then(() => {
          clearTimeout(timeoutId);
          console.log('Connected successfully!');
          setConnectionStatus('Connected!');
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          console.log('Auto-connect error:', error?.message || error, error);
          setConnectionStatus(`Error: ${error?.message || 'Connection failed'}`);
        });
    }
  }, [wallet, connected, connecting, connect]);

  const handleSelectWallet = useCallback(async (walletName: WalletName) => {
    console.log('Selected wallet:', walletName, 'isMobileAndroid:', isMobileAndroid);
    setShowModal(false);
    setConnectionStatus('Selecting wallet...');
    
    try {
      // Select the wallet - this will trigger the useEffect above to connect
      select(walletName);
      console.log('Wallet selected, waiting for connection...');
    } catch (error: any) {
      console.log('Selection error:', error?.message || error);
      setConnectionStatus(`Selection error: ${error?.message || 'Failed'}`);
      
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
    setConnectionStatus('');
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
        {/* Connection status for debugging */}
        {connectionStatus && !connected && (
          <div style={{ 
            position: 'absolute', 
            top: '100%', 
            left: '50%', 
            transform: 'translateX(-50%)',
            marginTop: '8px',
            fontSize: '10px', 
            color: connectionStatus.includes('Error') ? '#ff6b6b' : '#14F195',
            whiteSpace: 'nowrap',
            background: 'rgba(0,0,0,0.8)',
            padding: '4px 8px',
            borderRadius: '4px'
          }}>
            {connectionStatus}
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
            {isMobileAndroid && (
              <>
                <div style={{ fontSize: '11px', color: '#14F195', textAlign: 'center', marginBottom: '8px', padding: '8px', background: 'rgba(20, 241, 149, 0.1)', borderRadius: '8px' }}>
                  📱 {wallets.length} wallet(s) detected
                </div>
                {/* Direct Seeker/MWA button */}
                <button
                  onClick={handleDirectMWA}
                  style={{
                    ...walletButtonStyle,
                    border: '1px solid rgba(153, 69, 255, 0.6)',
                    background: 'rgba(153, 69, 255, 0.15)',
                    marginBottom: '8px',
                  }}
                >
                  <span style={{ fontSize: '24px' }}>🔐</span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span>Connect Seeker / MWA</span>
                    <span style={{ fontSize: '11px', color: '#9945FF' }}>Direct connection</span>
                  </div>
                </button>
                {/* Diagnostics button */}
                <button
                  onClick={runDiagnostics}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '12px',
                    background: 'rgba(255, 165, 0, 0.1)',
                    border: '1px solid rgba(255, 165, 0, 0.3)',
                    borderRadius: '8px',
                    color: '#ffa500',
                    marginBottom: '12px',
                    cursor: 'pointer',
                  }}
                >
                  🔍 Run Diagnostics
                </button>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '12px' }} />
              </>
            )}
            <div>
              {/* Show all wallets - wallet-standard will auto-detect Seeker if it injects itself */}
              {wallets.map((wallet) => {
                const isInstalled = wallet.readyState === WalletReadyState.Installed || 
                                    wallet.readyState === WalletReadyState.Loadable;
                const isMobileAdapter = wallet.adapter.name.includes('Mobile');
                
                return (
                  <button
                    key={wallet.adapter.name}
                    style={{
                      ...walletButtonStyle,
                      opacity: isInstalled ? 1 : 0.6,
                      // Highlight installed/detected wallets
                      ...(isInstalled && !isMobileAdapter ? { border: '1px solid rgba(20, 241, 149, 0.4)' } : {}),
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
                      e.currentTarget.style.borderColor = isInstalled && !isMobileAdapter ? 'rgba(20, 241, 149, 0.4)' : 'rgba(255, 255, 255, 0.12)';
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
                      {isInstalled && (
                        <span style={{ fontSize: '11px', color: '#14F195' }}>Detected ✓</span>
                      )}
                      {!isInstalled && isMobileAdapter && (
                        <span style={{ fontSize: '11px', color: '#ffd93d' }}>For native apps</span>
                      )}
                      {!isInstalled && !isMobileAdapter && (
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
