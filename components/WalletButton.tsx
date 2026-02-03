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

// Detect if we're in Seeker browser (Solana Mobile)
const isSeekerBrowser = () => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  // Seeker identifies as Chrome on Android with Seeker-specific markers
  // More specific check to avoid false positives
  return /android/i.test(ua) && /seeker/i.test(ua);
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
  const [seekerGuidanceModal, setSeekerGuidanceModal] = useState(false);
  const connectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsMobile(isMobileDevice());
    // Run MWA detection on mount and show on screen for mobile debugging
    const { supported, detection } = detectMWA();
    if (isMobileDevice()) {
      // v6 - Enhanced wallet detection with Seeker-specific handling
      const win = window as any;
      const isSeeker = isSeekerBrowser();
      
      const checkWallets = () => {
        const injections = [];
        if (win.solana) injections.push('solana');
        if (win.phantom) injections.push('phantom');
        if (win.solanaMobile) injections.push('solanaMobile');
        if (win.seedVault) injections.push('seedVault');
        
        // Check wallet-standard registry
        const walletStandard = win.navigator?.wallets;
        let registeredWallets: string[] = [];
        if (walletStandard?.get) {
          try {
            const walletList = walletStandard.get();
            registeredWallets = walletList?.map((w: any) => w.name || 'unnamed') || [];
          } catch (e) {}
        }
        
        return { injections, registeredWallets };
      };
      
      // Initial check
      let { injections, registeredWallets } = checkWallets();
      const ua = navigator.userAgent.slice(0, 40);
      
      // Display Seeker-specific status
      if (isSeeker) {
        setDebugInfo(`v6 SEEKER ws:[${registeredWallets.join(',')||'none'}] inj:[${injections.join(',')||'none'}]`);
      } else {
        setDebugInfo(`v6 ws:[${registeredWallets.join(',')||'wait'}] inj:[${injections.join(',')||'none'}] ${ua}`);
      }
      
      // Listen for wallet registration events
      const walletStandard = win.navigator?.wallets;
      if (walletStandard?.on) {
        walletStandard.on('register', (wallet: any) => {
          console.log('[wallet-standard] Wallet registered:', wallet?.name);
          const { registeredWallets: updated } = checkWallets();
          setDebugInfo(`v6 REGISTERED: ${wallet?.name || 'unknown'} ws:[${updated.join(',')}]`);
        });
      }
      
      // Also check after a delay in case registration is slow
      setTimeout(() => {
        const { injections: inj2, registeredWallets: ws2 } = checkWallets();
        if (ws2.length > 0 || inj2.length > 0) {
          setDebugInfo(`v6 delayed ws:[${ws2.join(',')||'empty'}] inj:[${inj2.join(',')||'none'}]`);
        } else if (isSeeker && ws2.length === 0 && inj2.length === 0) {
          // Seeker browser with no wallets detected
          setDebugInfo('v6 SEEKER: No wallet injection. Use Chrome or enable Privy.');
        }
      }, 2000);
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
    
    // For MWA on mobile, provide Seeker-specific guidance
    if (isMWA && isMobile) {
      const isSeeker = isSeekerBrowser();
      
      // v7 - Detect Seeker and provide specific guidance
      if (isSeeker) {
        setDebugInfo('v7: Seeker detected - MWA not supported in embedded browser');
        
        // Show guidance modal for Seeker users
        setSeekerGuidanceModal(true);
        return;
      }
      
      // v7 - Try direct intent first for non-Seeker Android
      setDebugInfo('v7: Trying MWA intent...');
      
      // Generate a simple association URL like MWA does
      const testIntent = 'solana-wallet://v1/associate/local?association=test123&port=12345';
      
      // Try to open it
      const link = document.createElement('a');
      link.href = testIntent;
      link.click();
      
      // Wait a moment then check if we're still here (intent didn't work)
      setTimeout(() => {
        setDebugInfo('v7: Intent attempt completed, trying transact...');
        
        // Fall back to trying transact anyway
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
          select('Mobile Wallet Adapter' as WalletName);
          setTimeout(() => connect().catch(e => console.log('sync:', e)), 200);
        }).catch((error: any) => {
          const msg = error?.message || error?.code || String(error);
          setDebugInfo(`MWA fail: ${msg.slice(0, 80)}`);
          
          // Show error in status instead of alert
          setConnectionStatus('Connection failed - Try Chrome or Phantom browser');
          setTimeout(() => setConnectionStatus(''), 5000);
        });
      }, 1500);
      
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
      {/* Connection status message */}
      {connectionStatus && (
        <div style={{
          position: 'fixed',
          top: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(255, 193, 7, 0.95)',
          color: '#000',
          padding: '12px 24px',
          fontSize: '14px',
          fontWeight: 500,
          zIndex: 999999,
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          maxWidth: '90%',
          textAlign: 'center',
        }}>
          {connectionStatus}
        </div>
      )}
      
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
              {/* Seeker-specific warning banner */}
              {isMobile && isSeekerBrowser() && (
                <div style={{
                  padding: '12px',
                  marginBottom: '16px',
                  backgroundColor: 'rgba(255, 193, 7, 0.1)',
                  border: '1px solid rgba(255, 193, 7, 0.3)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#FFC107',
                  lineHeight: '1.4',
                }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>⚠️ Seeker Browser Limitation</div>
                  <div>Wallet connection doesn't work in Seeker's browser. Please:</div>
                  <div style={{ marginTop: '6px', paddingLeft: '12px' }}>
                    • Use Chrome browser instead<br/>
                    • Or tap "Open in Phantom" below
                  </div>
                </div>
              )}
              
              {/* On mobile, show options */}
              {isMobile && !isInWalletBrowser() && (
                <>
                  {/* MWA option for Seeker/Saga - with warning for Seeker browser */}
                  <button
                    style={{
                      ...walletButtonStyle,
                      background: isSeekerBrowser() 
                        ? 'rgba(255, 193, 7, 0.1)' 
                        : 'linear-gradient(135deg, rgba(153, 69, 255, 0.2), rgba(20, 241, 149, 0.2))',
                      borderColor: isSeekerBrowser() 
                        ? 'rgba(255, 193, 7, 0.3)' 
                        : 'rgba(153, 69, 255, 0.4)',
                      marginBottom: '8px',
                      opacity: isSeekerBrowser() ? 0.6 : 1,
                    }}
                    onClick={() => handleSelectWallet('Mobile Wallet Adapter' as WalletName)}
                  >
                    <div style={{ 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: '8px',
                      background: isSeekerBrowser() 
                        ? '#FFC107' 
                        : 'linear-gradient(135deg, #9945FF, #14F195)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px'
                    }}>
                      {isSeekerBrowser() ? '⚠️' : '📱'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span>Seeker / Saga Wallet</span>
                      <span style={{ fontSize: '11px', color: isSeekerBrowser() ? '#FFC107' : '#14F195' }}>
                        {isSeekerBrowser() ? 'Not available in Seeker browser' : 'For Solana Mobile devices'}
                      </span>
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

      {/* Seeker Guidance Modal */}
      {seekerGuidanceModal && (
        <div 
          style={modalOverlayStyle}
          onClick={() => setSeekerGuidanceModal(false)}
        >
          <div 
            style={{
              ...modalContainerStyle,
              maxWidth: '400px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              style={closeButtonStyle}
              onClick={() => setSeekerGuidanceModal(false)}
            >
              ✕
            </button>
            <div style={{
              ...modalTitleStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}>
              <span>⚠️</span>
              <span>Seeker Browser Limitation</span>
            </div>
            <div style={{ color: '#ccc', fontSize: '14px', lineHeight: '1.6' }}>
              <p style={{ marginBottom: '16px' }}>
                The Seeker browser doesn't support Mobile Wallet Adapter (MWA) connections.
              </p>
              <div style={{ 
                backgroundColor: 'rgba(153, 69, 255, 0.1)', 
                border: '1px solid rgba(153, 69, 255, 0.3)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
              }}>
                <div style={{ fontWeight: 600, color: '#14F195', marginBottom: '8px' }}>
                  ✅ Recommended Solutions:
                </div>
                <div style={{ paddingLeft: '12px' }}>
                  1. Open this site in <strong>Chrome browser</strong><br/>
                  2. Use <strong>Phantom's in-app browser</strong><br/>
                  3. Contact admin to enable Privy
                </div>
              </div>
              <button
                style={{
                  ...walletButtonStyle,
                  width: '100%',
                  background: 'linear-gradient(135deg, #9945FF, #14F195)',
                  borderColor: 'rgba(153, 69, 255, 0.5)',
                }}
                onClick={() => {
                  setSeekerGuidanceModal(false);
                  setShowModal(true); // Reopen main modal to show other options
                }}
              >
                Show Other Options
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
// Build 1770122147
