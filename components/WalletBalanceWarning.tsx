'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { AlertCircle, ExternalLink, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function WalletBalanceWarning() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!connected || !publicKey) {
      setBalance(null);
      setLoading(false);
      setDismissed(false);
      return;
    }

    const checkBalance = async () => {
      try {
        const bal = await connection.getBalance(publicKey);
        setBalance(bal / LAMPORTS_PER_SOL);
      } catch (error) {
        console.error('Error checking balance:', error);
      } finally {
        setLoading(false);
      }
    };

    checkBalance();
    
    // Check balance every 30 seconds
    const interval = setInterval(checkBalance, 30000);
    return () => clearInterval(interval);
  }, [connected, publicKey, connection]);

  if (!connected || loading || dismissed) {
    return null;
  }

  // Show warning if balance is low (less than 1 SOL on devnet)
  if (balance !== null && balance < 1) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-4 right-4 max-w-sm z-50"
        >
          <div className="glass-card rounded-2xl p-5 shadow-glow border border-yellow-500/20">
            <button
              onClick={() => setDismissed(true)}
              className="absolute top-3 right-3 text-neutral-500 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="flex-1 pr-4">
                <h3 className="font-semibold text-white mb-1">Low Balance</h3>
                <p className="text-sm text-neutral-400 mb-3">
                  Your wallet has <span className="text-yellow-400 font-mono">{balance.toFixed(4)} SOL</span>. You need at least 0.5 SOL to play.
                </p>
                <a
                  href="https://faucet.solana.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-solana-green hover:text-white transition-colors"
                >
                  Get Devnet SOL
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return null;
}
