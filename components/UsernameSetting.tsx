'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { getUsername, setUsername, checkUsernameAvailable } from '@/utils/username';

interface UsernameSettingProps {
  onUsernameChange?: (username: string | null) => void;
}

export const UsernameSetting: React.FC<UsernameSettingProps> = ({ onUsernameChange }) => {
  const { publicKey, connected } = useWallet();
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingUsername, setIsFetchingUsername] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Fetch current username when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      setIsFetchingUsername(true);
      const walletAddress = publicKey.toBase58();
      console.log('Fetching username for wallet:', walletAddress);
      getUsername(walletAddress).then((username) => {
        console.log('Fetched username:', username);
        setCurrentUsername(username);
        setInputValue(username || '');
        onUsernameChange?.(username);
        setIsFetchingUsername(false);
      }).catch((err) => {
        console.error('Error fetching username:', err);
        setIsFetchingUsername(false);
      });
    } else {
      setCurrentUsername(null);
      setInputValue('');
      setIsFetchingUsername(false);
    }
  }, [connected, publicKey, onUsernameChange]);

  // Debounced username availability check
  useEffect(() => {
    // Skip check if still loading current username
    if (isFetchingUsername) {
      setIsAvailable(null);
      return;
    }
    
    // Skip check if no input or if it matches current username (case-insensitive)
    if (!inputValue || (currentUsername && inputValue.toLowerCase() === currentUsername.toLowerCase())) {
      setIsAvailable(null);
      return;
    }

    // Validate format first
    const usernameRegex = /^[a-zA-Z0-9_]{3,16}$/;
    if (!usernameRegex.test(inputValue)) {
      setIsAvailable(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setCheckingAvailability(true);
      const available = await checkUsernameAvailable(inputValue, publicKey?.toBase58());
      setIsAvailable(available);
      setCheckingAvailability(false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [inputValue, currentUsername, publicKey, isFetchingUsername]);

  const handleSave = useCallback(async () => {
    if (!publicKey || !inputValue) return;

    setIsLoading(true);
    setError(null);

    const result = await setUsername(publicKey.toBase58(), inputValue);

    if (result.success) {
      setCurrentUsername(result.username!);
      setIsEditing(false);
      onUsernameChange?.(result.username!);
    } else {
      setError(result.error || 'Failed to save username');
    }

    setIsLoading(false);
  }, [publicKey, inputValue, onUsernameChange]);

  const handleCancel = useCallback(() => {
    setInputValue(currentUsername || '');
    setIsEditing(false);
    setError(null);
    setIsAvailable(null);
  }, [currentUsername]);

  if (!connected) {
    return null;
  }

  const containerStyle: React.CSSProperties = {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '16px',
    padding: '16px',
    marginBottom: '16px',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px',
    display: 'block',
  };

  const displayStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  };

  const usernameStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 600,
    color: '#fff',
  };

  const editButtonStyle: React.CSSProperties = {
    backgroundColor: 'transparent',
    border: '1px solid #444',
    borderRadius: '12px',
    padding: '6px 12px',
    color: '#888',
    fontSize: '13px',
    cursor: 'pointer',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: '#1a1a1a',
    border: `1px solid ${error ? '#ff4444' : isAvailable === true ? '#44ff44' : '#333'}`,
    borderRadius: '12px',
    padding: '10px 12px',
    color: '#fff',
    fontSize: '16px',
    outline: 'none',
  };

  const buttonRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    marginTop: '12px',
  };

  const saveButtonStyle: React.CSSProperties = {
    flex: 1,
    backgroundColor: '#9945FF',
    border: 'none',
    borderRadius: '12px',
    padding: '10px',
    color: '#fff',
    fontWeight: 600,
    cursor: isLoading || isAvailable === false ? 'not-allowed' : 'pointer',
    opacity: isLoading || isAvailable === false ? 0.5 : 1,
  };

  const cancelButtonStyle: React.CSSProperties = {
    flex: 1,
    backgroundColor: 'transparent',
    border: '1px solid #444',
    borderRadius: '12px',
    padding: '10px',
    color: '#888',
    cursor: 'pointer',
  };

  const hintStyle: React.CSSProperties = {
    fontSize: '12px',
    color: error ? '#ff4444' : isAvailable === true ? '#44ff44' : '#666',
    marginTop: '6px',
  };

  return (
    <div style={containerStyle}>
      <span style={labelStyle}>Username</span>
      
      {isFetchingUsername ? (
        <div style={displayStyle}>
          <span style={{ color: '#666', fontStyle: 'italic' }}>Loading...</span>
        </div>
      ) : !isEditing ? (
        <div style={displayStyle}>
          <span style={usernameStyle}>
            {currentUsername || (
              <span style={{ color: '#666', fontStyle: 'italic' }}>Not set</span>
            )}
          </span>
          <button style={editButtonStyle} onClick={() => setIsEditing(true)}>
            {currentUsername ? 'Edit' : 'Set Username'}
          </button>
        </div>
      ) : (
        <div>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setError(null);
            }}
            placeholder="Enter username"
            style={inputStyle}
            maxLength={16}
            autoFocus
          />
          <div style={hintStyle}>
            {error ? (
              error
            ) : checkingAvailability ? (
              'Checking availability...'
            ) : isAvailable === true ? (
              '✓ Username available'
            ) : isAvailable === false ? (
              '✗ Username taken'
            ) : inputValue.length > 0 && inputValue.length < 3 ? (
              'Minimum 3 characters'
            ) : (
              '3-16 characters, letters, numbers, underscores'
            )}
          </div>
          <div style={buttonRowStyle}>
            <button
              style={saveButtonStyle}
              onClick={handleSave}
              disabled={isLoading || isAvailable === false || !inputValue}
            >
              {isLoading ? 'Saving...' : 'Save'}
            </button>
            <button style={cancelButtonStyle} onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
