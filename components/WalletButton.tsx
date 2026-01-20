'use client';

import React, { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletName } from '@solana/wallet-adapter-base';

export const WalletButton: React.FC = () => {
  const { connected, publicKey, wallets, select, disconnect, connecting } = useWallet();
  const [showModal, setShowModal] = useState(false);

  const handleConnect = useCallback(() => {
    setShowModal(true);
  }, []);

  const handleSelectWallet = useCallback((walletName: WalletName) => {
    select(walletName);
    setShowModal(false);
  }, [select]);

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
    backgroundColor: '#252525',
    border: '1px solid #333',
    borderRadius: '12px',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
    marginBottom: '10px',
    textAlign: 'left',
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
    backgroundColor: '#000',
    color: '#fff',
    fontWeight: 600,
    borderRadius: '12px',
    padding: '10px 20px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    cursor: 'pointer',
    fontSize: '14px',
  };

  return (
    <>
      <div className="relative group" style={{ zIndex: 100, position: 'relative' }}>
        <div className="absolute -inset-0.5 bg-gradient-to-r from-solana-purple to-solana-green rounded-xl blur opacity-60 group-hover:opacity-100 transition duration-300 pointer-events-none" />
        {connected && publicKey ? (
          <button
            onClick={handleDisconnect}
            style={connectButtonStyle}
          >
            {shortenAddress(publicKey.toBase58())}
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting}
            style={connectButtonStyle}
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
              {wallets.map((wallet) => (
                <button
                  key={wallet.adapter.name}
                  style={walletButtonStyle}
                  onClick={() => handleSelectWallet(wallet.adapter.name)}
                >
                  {wallet.adapter.icon && (
                    <img 
                      src={wallet.adapter.icon} 
                      alt={wallet.adapter.name}
                      style={{ width: '32px', height: '32px', borderRadius: '8px' }}
                    />
                  )}
                  <span>{wallet.adapter.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
