'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletName, WalletReadyState } from '@solana/wallet-adapter-base';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';

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

// MWA Detection - checks for solana mobile wallet support
const detectMWA = () => {
  if (typeof window === 'undefined') return { supported: false, detection: null };
  
  const win = window as any;
  const detection = {
    hasNavigator: typeof navigator !== 'undefined',
    userAgent: navigator?.userAgent || 'unknown',
    isMobile: isMobileDevice(),
    isAndroid: /android/i.test(navigator?.userAgent || ''),
    // Check for injected wallets
    hasSolanaWallet: !!win.solana,
    hasSolanaMobile: !!win.solanaMobile,
    hasPhantom: !!win.phantom?.solana,
    // Seeker-specific detection
    isSeeker: /seeker|solana\s*mobile/i.test(navigator?.userAgent || ''),
    hasSeedVault: !!win.seedVault,
    // Check wallet-standard
    hasWalletStandard: typeof win.navigator?.wallets !== 'undefined',
  };
  
  const supported = detection.isAndroid;
  
  console.log('[MWA] Detection:', detection);
  
  return { supported, detection };
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

// Main export - uses standard wallet adapter
export const WalletButton: React.FC = () => {
  return <StandardWalletButton />;
};

// Standard wallet-adapter based button
const StandardWalletButton: React.FC = () => {
  const { connected, publicKey, wallets, select, disconnect, connecting, connect, wallet } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('');
  const connectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsMobile(isMobileDevice());
    // Run MWA detection on mount and show on screen for mobile debugging
    const { supported, detection } = detectMWA();
    if (isMobileDevice()) {
      // v3 - Check ALL possible wallet injections
      const win = window as any;
      const injections = [];
      if (win.solana) injections.push('solana');
      if (win.phantom) injections.push('phantom');
      if (win.solanaMobile) injections.push('solanaMobile');
      if (win.seedVault) injections.push('seedVault');
      if (win.solflare) injections.push('solflare');
      if (win.backpack) injections.push('backpack');
      if (win.glow) injections.push('glow');
      
      const ua = navigator.userAgent.slice(0, 60);
      setDebugInfo(`v3 inject:[${injections.join(',')||'none'}] UA:${ua}`);
    }
  }, [wallets]);

  // Auto-close modal when connected and update debug
  useEffect(() => {
    if (connected && publicKey) {
      setShowModal(false);
      setConnectionStatus('');
      if (isMobile) {
        setDebugInfo(`CONNECTED: ${publicKey.toBase58().slice(0,8)}...`);
      }
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
      }
    }
  }, [connected, publicKey, isMobile]);

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

    // If already properly connected with a public key, just return
    if (connected && publicKey) {
      setDebugInfo(`Already connected: ${publicKey.toBase58().slice(0,8)}...`);
      return;
    }
    
    // If "connected" but no publicKey, we have a stale connection - disconnect first
    if (connected && !publicKey) {
      setDebugInfo('Stale connection detected, disconnecting...');
      try {
        await disconnect();
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (e) {
        console.log('Disconnect error (ignored):', e);
      }
    }

    // Update debug info
    if (isMobile) {
      setDebugInfo('Starting connection...');
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
    
    // On Android, check for injected wallet first (Seeker's embedded wallet)
    if (isMobile && /android/i.test(navigator.userAgent)) {
      const { detection } = detectMWA();
      
      // If there's an injected wallet (window.solana), use it directly
      if (detection?.hasSolanaWallet || detection?.hasPhantom) {
        setDebugInfo('Found injected wallet - connecting...');
        
        // Find the matching adapter (Phantom, etc)
        const injectedWallet = wallets.find(w => 
          w.readyState === WalletReadyState.Installed &&
          w.adapter.name !== 'Mobile Wallet Adapter'
        );
        
        if (injectedWallet) {
          setDebugInfo(`Using ${injectedWallet.adapter.name}...`);
          select(injectedWallet.adapter.name as WalletName);
          // Don't await - let it connect asynchronously
          connect().then(() => {
            setDebugInfo('Connected!');
          }).catch((e) => {
            setDebugInfo(`Error: ${e.message?.slice(0, 40)}`);
            setShowModal(true);
          });
          return;
        }
      }
      
      // No injected wallet - show modal for MWA or other options
      setDebugInfo(`No injected wallet. solana:${detection?.hasSolanaWallet} phantom:${detection?.hasPhantom}`);
      setShowModal(true);
      return;
    }
  }, [wallets, select, connect, disconnect, connected, publicKey, isMobile]);

  const handleSelectWallet = useCallback((walletName: WalletName) => {
    console.log('[WalletModal] Connecting with type:', walletName);
    setShowModal(false);
    
    const isMWA = walletName === 'Mobile Wallet Adapter';
    
    // For MWA on mobile, use transact() directly
    if (isMWA && isMobile) {
      setDebugInfo('MWA: Calling transact()...');
      
      // transact() will create a solana-wallet:// URL and navigate to it
      transact(async (wallet) => {
        setDebugInfo('MWA: transact callback, authorizing...');
        const authResult = await wallet.authorize({
          cluster: 'mainnet-beta',
          identity: {
            name: 'SolMate',
            uri: 'https://playsolmate.fun',
            icon: 'https://playsolmate.fun/images/chess-hero.png',
          },
        });
        setDebugInfo(`MWA: Auth success! ${authResult.accounts[0]?.address?.slice(0,8)}...`);
        return authResult;
      }).then((result: any) => {
        const addr = result?.accounts?.[0]?.address;
        setDebugInfo(`MWA: Done! ${addr?.slice(0,8) || 'no addr'}`);
        // Sync with wallet adapter
        select('Mobile Wallet Adapter' as WalletName);
        setTimeout(() => connect().catch(e => console.log('sync:', e)), 200);
      }).catch((error: any) => {
        const msg = error?.message || error?.code || String(error);
        setDebugInfo(`MWA error: ${msg.slice(0, 100)}`);
        console.log('[MWA] transact error:', error);
      });
      
      return;
    }
    
    // Select the wallet first
    select(walletName);
    
    // Update debug
    if (isMobile) {
      setDebugInfo(`Selected: ${walletName}, connecting...`);
    }
    
    // Connect asynchronously - don't await/block
    setTimeout(() => {
      connect().then(() => {
        console.log('Connected successfully!');
        if (isMobile) {
          setDebugInfo('Connected!');
        }
      }).catch((error: any) => {
        console.log('Connection error:', error?.message || error);
        if (isMobile) {
          setDebugInfo(`Error: ${error?.message?.slice(0, 50) || 'Failed'}`);
        }
        
        // If MWA failed, show guidance
        if (isMWA) {
          alert('Could not connect. Try:\n1. Open Phantom/Solflare first\n2. Return to SolMate\n3. Or use wallet\'s in-app browser');
        }
      });
    }, 100);
  }, [select, connect, isMobile]);

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
      {/* Debug info for mobile - remove after testing */}
      {debugInfo && (
        <div style={{
          position: 'fixed',
          bottom: '10px',
          left: '10px',
          right: '10px',
          backgroundColor: 'rgba(0,0,0,0.9)',
          color: '#14F195',
          padding: '8px',
          fontSize: '10px',
          fontFamily: 'monospace',
          zIndex: 999999,
          borderRadius: '4px',
          wordBreak: 'break-all',
        }}>
          {debugInfo}
        </div>
      )}
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
            <div>
              {/* On mobile, show options */}
              {isMobile && !isInWalletBrowser() && (
                <>
                  {/* MWA option for Seeker/Saga */}
                  <button
                    style={{
                      ...walletButtonStyle,
                      background: 'linear-gradient(135deg, rgba(153, 69, 255, 0.2), rgba(20, 241, 149, 0.2))',
                      borderColor: 'rgba(153, 69, 255, 0.4)',
                      marginBottom: '8px',
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
                      <span>Seeker / Saga Wallet</span>
                      <span style={{ fontSize: '11px', color: '#14F195' }}>For Solana Mobile devices</span>
                    </div>
                  </button>
                  
                  {/* Open in Phantom browser - fallback */}
                  <button
                    style={{
                      ...walletButtonStyle,
                      marginBottom: '16px',
                    }}
                    onClick={() => {
                      setDebugInfo('Opening Phantom browser...');
                      const currentUrl = encodeURIComponent(window.location.href);
                      window.location.href = `https://phantom.app/ul/browse/${currentUrl}`;
                    }}
                  >
                    <div style={{ 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: '8px',
                      background: '#AB9FF2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px'
                    }}>
                      👻
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span>Open in Phantom</span>
                      <span style={{ fontSize: '11px', color: '#888' }}>If Seeker doesn't work</span>
                    </div>
                  </button>
                </>
              )}
              
              {wallets
                .filter(w => w.adapter.name !== 'Mobile Wallet Adapter')
                .sort((a, b) => {
                  // Phantom always first
                  if (a.adapter.name === 'Phantom') return -1;
                  if (b.adapter.name === 'Phantom') return 1;
                  // Then Solflare
                  if (a.adapter.name === 'Solflare') return -1;
                  if (b.adapter.name === 'Solflare') return 1;
                  // Then installed wallets
                  const aInstalled = a.readyState === WalletReadyState.Installed || a.readyState === WalletReadyState.Loadable;
                  const bInstalled = b.readyState === WalletReadyState.Installed || b.readyState === WalletReadyState.Loadable;
                  if (aInstalled && !bInstalled) return -1;
                  if (!aInstalled && bInstalled) return 1;
                  return 0;
                })
                .map((wallet) => {
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
// Build 1770122147
