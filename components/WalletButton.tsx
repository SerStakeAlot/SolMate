'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletName, WalletReadyState } from '@solana/wallet-adapter-base';
import { getPlayerStats, getUsername, PlayerStats } from '@/utils/username';
import { 
  connectMWA, 
  disconnectMWA, 
  getMWAState, 
  addMWAListener, 
  isMWAAvailable 
} from '@/utils/mwa';

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
  const [showDropdown, setShowDropdown] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const connectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // MWA state (separate from wallet-adapter)
  const [mwaConnected, setMwaConnected] = useState(false);
  const [mwaPublicKey, setMwaPublicKey] = useState<string | null>(null);
  const [mwaConnecting, setMwaConnecting] = useState(false);
  const [showMWAOption, setShowMWAOption] = useState(false);

  // Listen for MWA state changes
  useEffect(() => {
    const unsubscribe = addMWAListener((connected, pubkey) => {
      setMwaConnected(connected);
      setMwaPublicKey(pubkey?.toBase58() || null);
    });
    
    // Check if MWA is available on this device
    setShowMWAOption(isMWAAvailable());
    
    // Check initial state
    const { connected: initialConnected, publicKey: initialPubkey } = getMWAState();
    setMwaConnected(initialConnected);
    setMwaPublicKey(initialPubkey?.toBase58() || null);
    
    return unsubscribe;
  }, []);

  // Handle MWA connect
  const handleMWAConnect = useCallback(async () => {
    setMwaConnecting(true);
    setDebugInfo('MWA: Starting connection...');
    console.log('[WalletButton] Starting MWA connection');
    try {
      const result = await connectMWA();
      console.log('[WalletButton] MWA result:', result);
      if (result) {
        setDebugInfo(`MWA Connected: ${result.publicKey.toBase58().slice(0, 8)}...`);
        setShowModal(false);
      } else {
        setDebugInfo('MWA: No wallet responded. Is Phantom/Solflare installed?');
        // Keep modal open so user can see the message
      }
    } catch (error: any) {
      console.error('[WalletButton] MWA Connect error:', error);
      const errorMsg = error.message?.slice(0, 80) || 'Unknown error';
      setDebugInfo(`MWA Error: ${errorMsg}`);
      // Keep modal open so user can see the error
    } finally {
      setMwaConnecting(false);
    }
  }, []);

  // Handle MWA disconnect
  const handleMWADisconnect = useCallback(() => {
    disconnectMWA();
    setDebugInfo('MWA Disconnected');
  }, []);

  // Fetch player stats when connected (either wallet-adapter or MWA)
  useEffect(() => {
    const walletAddr = publicKey?.toBase58() || mwaPublicKey;
    if (walletAddr) {
      getPlayerStats(walletAddr).then(setPlayerStats);
      getUsername(walletAddr).then(setUsername);
    } else {
      setPlayerStats(null);
      setUsername(null);
    }
  }, [connected, publicKey, mwaConnected, mwaPublicKey]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setIsMobile(isMobileDevice());
    // Run MWA detection on mount and show on screen for mobile debugging
    const { supported, detection } = detectMWA();
    if (isMobileDevice()) {
      // v5 - Listen for wallet-standard registration events
      const win = window as any;
      
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
      setDebugInfo(`v5 ws:[${registeredWallets.join(',')||'wait'}] inj:[${injections.join(',')||'none'}] ${ua}`);
      
      // Listen for wallet registration events
      const walletStandard = win.navigator?.wallets;
      if (walletStandard?.on) {
        walletStandard.on('register', (wallet: any) => {
          console.log('[wallet-standard] Wallet registered:', wallet?.name);
          const { registeredWallets: updated } = checkWallets();
          setDebugInfo(`v5 REGISTERED: ${wallet?.name || 'unknown'} ws:[${updated.join(',')}]`);
        });
      }
      
      // Also check after a delay in case registration is slow
      setTimeout(() => {
        const { injections: inj2, registeredWallets: ws2 } = checkWallets();
        if (ws2.length > 0 || inj2.length > 0) {
          setDebugInfo(`v5 delayed ws:[${ws2.join(',')||'empty'}] inj:[${inj2.join(',')||'none'}]`);
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
      
      // No injected wallet - show modal for other options
      setDebugInfo(`No injected wallet. solana:${detection?.hasSolanaWallet} phantom:${detection?.hasPhantom}`);
      setShowModal(true);
      return;
    }
    
    // Desktop or iOS: show wallet selection modal
    setShowModal(true);
  }, [wallets, select, connect, disconnect, connected, publicKey, isMobile]);

  const handleSelectWallet = useCallback(async (walletName: WalletName) => {
    console.log('[WalletModal] Connecting with:', walletName);
    const debugLog = (window as any).mwaDebugLog || console.log;
    
    debugLog(`Selecting: ${walletName}`);
    setDebugInfo(`Connecting to ${walletName}...`);
    
    // Close modal FIRST to allow wallet bottom sheet to appear
    setShowModal(false);
    
    try {
      // Select the wallet
      debugLog(`Calling select()...`);
      select(walletName);
      
      // Small delay to let selection take effect
      await new Promise(r => setTimeout(r, 100));
      debugLog(`Selected, calling connect()...`);
      
      // Try to connect
      await connect();
      
      debugLog(`✅ Connect returned successfully`);
      setDebugInfo('Connected!');
    } catch (error: any) {
      const errorName = error?.name || 'Unknown';
      const errorCode = error?.code || '';
      const errorMsg = error?.message?.slice(0, 60) || 'Connection failed';
      
      debugLog(`❌ Error: [${errorName}${errorCode ? ':' + errorCode : ''}] ${errorMsg}`);
      console.error('[WalletModal] Connection error:', error);
      setDebugInfo(`Error: ${errorMsg}`);
      
      // Re-show modal on error so user can try again
      setTimeout(() => setShowModal(true), 500);
    }
  }, [select, connect]);

  const handleDisconnect = useCallback(() => {
    // Disconnect both wallet-adapter and MWA
    if (connected) {
      disconnect();
    }
    if (mwaConnected) {
      handleMWADisconnect();
    }
    setShowDropdown(false);
  }, [disconnect, connected, mwaConnected, handleMWADisconnect]);

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
    zIndex: 9999, // Lowered from 999999 to allow native wallet UI to appear on top
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

  // Determine effective connection state (wallet-adapter OR MWA)
  const effectiveConnected = connected && publicKey ? true : mwaConnected;
  const effectivePublicKey = publicKey?.toBase58() || mwaPublicKey;
  const isMWAConnection = !connected && mwaConnected;
  
  // Show connecting status when debug indicates we're connecting
  const isConnecting = debugInfo.includes('Connecting');

  return (
    <>
      {/* Floating status indicator when connecting (modal closed) 
          MOVED TO TOP to avoid blocking wallet bottom sheet on Android */}
      {isConnecting && !showModal && (
        <div style={{
          position: 'fixed',
          top: '80px', // Changed from bottom: 20px - wallet bottom sheet appears at bottom
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          border: '1px solid rgba(20, 241, 149, 0.5)',
          borderRadius: '12px',
          padding: '12px 20px',
          zIndex: 50, // Lowered significantly to not interfere with native UI
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: '#fff',
          fontSize: '14px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
          pointerEvents: 'none', // Allow clicks to pass through
        }}>
          <div style={{
            width: '16px',
            height: '16px',
            border: '2px solid #14F195',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <span>Waiting for wallet...</span>
        </div>
      )}
      
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      
      <div className="relative group" style={{ zIndex: 100, position: 'relative' }} ref={dropdownRef}>
        {effectiveConnected && effectivePublicKey ? (
          <>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
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
              {isMWAConnection && <span style={{ marginRight: '4px', fontSize: '12px' }}>📱</span>}
              <span>{username || shortenAddress(effectivePublicKey)}</span>
              {playerStats && (playerStats.gamesPlayed ?? 0) > 0 && (
                <span style={{ 
                  marginLeft: '8px', 
                  fontSize: '11px', 
                  color: '#888',
                  fontWeight: 400 
                }}>
                  {playerStats.gamesWon ?? 0}W-{playerStats.gamesLost ?? 0}L
                </span>
              )}
            </button>
            
            {/* Dropdown Menu */}
            {showDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                backgroundColor: '#1a1a1a',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                padding: '12px',
                minWidth: '200px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                zIndex: 1000,
              }}>
                {/* Wallet Address */}
                <div style={{ 
                  fontSize: '12px', 
                  color: '#888', 
                  marginBottom: '12px',
                  fontFamily: 'monospace'
                }}>
                  {isMWAConnection && <span style={{ color: '#14F195', marginRight: '4px' }}>MWA</span>}
                  {shortenAddress(effectivePublicKey)}
                </div>
                
                {/* Stats */}
                {playerStats && (
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '8px',
                    marginBottom: '12px',
                    padding: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '8px'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#4ade80' }}>
                        {playerStats.gamesWon ?? 0}
                      </div>
                      <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase' }}>Wins</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f87171' }}>
                        {playerStats.gamesLost ?? 0}
                      </div>
                      <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase' }}>Losses</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>
                        {playerStats.winRate ?? 0}%
                      </div>
                      <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase' }}>Win Rate</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ 
                        fontSize: '18px', 
                        fontWeight: 'bold', 
                        color: (playerStats.netProfit ?? 0) >= 0 ? '#4ade80' : '#f87171' 
                      }}>
                        {(playerStats.netProfit ?? 0) >= 0 ? '+' : ''}{(playerStats.netProfit ?? 0).toFixed(2)}
                      </div>
                      <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase' }}>SOL P/L</div>
                    </div>
                  </div>
                )}
                
                {/* Actions */}
                <button
                  onClick={() => { window.location.href = '/stats'; }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: 'rgba(153, 69, 255, 0.1)',
                    border: '1px solid rgba(153, 69, 255, 0.3)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '13px',
                    cursor: 'pointer',
                    marginBottom: '8px',
                  }}
                >
                  📊 View Full Stats
                </button>
                <button
                  onClick={() => { setShowDropdown(false); handleDisconnect(); }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: 'rgba(248, 113, 113, 0.1)',
                    border: '1px solid rgba(248, 113, 113, 0.3)',
                    borderRadius: '8px',
                    color: '#f87171',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Disconnect
                </button>
              </div>
            )}
          </>
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
            
            {/* Debug info display */}
            {debugInfo && (
              <div style={{
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                padding: '8px 12px',
                marginBottom: '16px',
                fontSize: '12px',
                color: debugInfo.includes('Error') || debugInfo.includes('No wallet') || debugInfo.includes('timed out')
                  ? '#f87171' 
                  : debugInfo.includes('Connected') 
                    ? '#4ade80' 
                    : '#fff',
                fontFamily: 'monospace',
                wordBreak: 'break-all',
              }}>
                {debugInfo}
              </div>
            )}
            
            {/* MWA browser requirement note - show only on Android */}
            {/android/i.test(navigator?.userAgent || '') && (
              <div style={{
                backgroundColor: 'rgba(20, 241, 149, 0.1)',
                border: '1px solid rgba(20, 241, 149, 0.3)',
                borderRadius: '8px',
                padding: '8px 12px',
                marginBottom: '16px',
                fontSize: '11px',
                color: '#14F195',
              }}>
                📱 On Seeker? Tap "<strong>Mobile Wallet Adapter</strong>" to use Seed Vault Wallet
              </div>
            )}
            
            <div>
              {/* On mobile, show Open in Phantom option */}
              {isMobile && !isInWalletBrowser() && (
                <>
                  {/* Open in Phantom browser - recommended for mobile */}
                  <button
                    style={{
                      ...walletButtonStyle,
                      marginBottom: '16px',
                      background: 'linear-gradient(135deg, rgba(171, 159, 242, 0.2), rgba(171, 159, 242, 0.1))',
                      borderColor: 'rgba(171, 159, 242, 0.4)',
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
                      <span style={{ fontSize: '11px', color: '#14F195' }}>Recommended for mobile</span>
                    </div>
                  </button>
                </>
              )}
              
              {/* Custom MWA button removed - using standard Mobile Wallet Adapter instead */}
              
              {wallets
                .filter(w => {
                  // Show Mobile Wallet Adapter ONLY on Android (don't filter it out)
                  if (w.adapter.name === 'Mobile Wallet Adapter') {
                    return /android/i.test(navigator?.userAgent || '');
                  }
                  return true;
                })
                .sort((a, b) => {
                  // Mobile Wallet Adapter first on Android (for Seeker/Seed Vault)
                  if (a.adapter.name === 'Mobile Wallet Adapter') return -1;
                  if (b.adapter.name === 'Mobile Wallet Adapter') return 1;
                  // Phantom next
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
