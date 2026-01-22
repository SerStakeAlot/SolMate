'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { 
  Connection, 
  PublicKey, 
  Transaction, 
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL 
} from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('H1Sn4JQvsZFx7HreZaQn4Poa3hkoS9iGnTwrtN2knrKV');
const ADMIN_PUBKEY = new PublicKey('7BKqimAdco1XsknW88N38qf4PgXGieWN8USPgKxcf87B');
const FEE_VAULT_PDA = new PublicKey('H3y5ST69e5QDVXZsWiNAiDgJfq7eW6GntkvyVxCmq5VX');
const RPC_URL = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://mainnet.helius-rpc.com/?api-key=7ca044d7-5942-4ace-a0d1-e874a6515ba8';

export default function AdminVaultPage() {
  const { publicKey, sendTransaction, connected } = useWallet();
  const [vaultBalance, setVaultBalance] = useState<number | null>(null);
  const [availableBalance, setAvailableBalance] = useState<number | null>(null);
  const [totalCollected, setTotalCollected] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const fetchVaultData = useCallback(async () => {
    try {
      const connection = new Connection(RPC_URL, 'confirmed');
      const accountInfo = await connection.getAccountInfo(FEE_VAULT_PDA);
      
      if (!accountInfo) {
        setVaultBalance(0);
        setAvailableBalance(0);
        setTotalCollected(0);
        return;
      }

      const balance = accountInfo.lamports / LAMPORTS_PER_SOL;
      const rentExempt = await connection.getMinimumBalanceForRentExemption(accountInfo.data.length);
      const available = (accountInfo.lamports - rentExempt) / LAMPORTS_PER_SOL;

      setVaultBalance(balance);
      setAvailableBalance(Math.max(0, available));

      // Parse total_collected from account data (8-byte discriminator + u64)
      if (accountInfo.data.length >= 16) {
        const totalCollectedLamports = accountInfo.data.readBigUInt64LE(8);
        setTotalCollected(Number(totalCollectedLamports) / LAMPORTS_PER_SOL);
      }
    } catch (error) {
      console.error('Error fetching vault data:', error);
      setStatus({ type: 'error', message: 'Failed to fetch vault data' });
    }
  }, []);

  useEffect(() => {
    fetchVaultData();
    const interval = setInterval(fetchVaultData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [fetchVaultData]);

  useEffect(() => {
    if (publicKey) {
      setIsAdmin(publicKey.equals(ADMIN_PUBKEY));
    } else {
      setIsAdmin(false);
    }
  }, [publicKey]);

  const handleWithdraw = async (withdrawAll: boolean) => {
    if (!publicKey || !isAdmin) return;

    setLoading(true);
    setStatus(null);
    setTxSignature(null);

    try {
      const connection = new Connection(RPC_URL, 'confirmed');
      
      // Calculate amount in lamports
      let amountLamports: bigint;
      if (withdrawAll) {
        amountLamports = BigInt(0); // 0 means withdraw all in the contract
      } else {
        const amount = parseFloat(withdrawAmount);
        if (isNaN(amount) || amount <= 0) {
          setStatus({ type: 'error', message: 'Please enter a valid amount' });
          setLoading(false);
          return;
        }
        if (amount > (availableBalance || 0)) {
          setStatus({ type: 'error', message: 'Amount exceeds available balance' });
          setLoading(false);
          return;
        }
        amountLamports = BigInt(Math.floor(amount * LAMPORTS_PER_SOL));
      }

      // Build withdraw instruction
      // Anchor discriminator for withdraw_fees
      const discriminator = Buffer.from([198, 212, 171, 109, 144, 215, 174, 89]);
      
      // Amount as u64 little-endian
      const amountBuffer = Buffer.alloc(8);
      amountBuffer.writeBigUInt64LE(amountLamports);
      
      const data = Buffer.concat([discriminator, amountBuffer]);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: FEE_VAULT_PDA, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data,
      });

      const transaction = new Transaction().add(instruction);
      
      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Send transaction
      const signature = await sendTransaction(transaction, connection);
      
      setStatus({ type: 'info', message: 'Transaction sent, confirming...' });
      
      // Confirm transaction
      await connection.confirmTransaction(signature, 'confirmed');
      
      setTxSignature(signature);
      setStatus({ type: 'success', message: `Withdrawal successful!` });
      setWithdrawAmount('');
      
      // Refresh vault data
      setTimeout(fetchVaultData, 2000);
      
    } catch (error: unknown) {
      console.error('Withdrawal error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus({ type: 'error', message: `Withdrawal failed: ${errorMessage}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-purple-400 mb-2">🔐 Fee Vault</h1>
          <p className="text-gray-400 text-sm">SolMate Platform Fee Management</p>
        </div>

        {/* Wallet Connection */}
        <div className="flex justify-center mb-8">
          <WalletMultiButton />
        </div>

        {/* Admin Check */}
        {connected && !isAdmin && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6 text-center">
            <p className="text-red-300">⚠️ Connected wallet is not the admin</p>
            <p className="text-sm text-gray-400 mt-1">
              Expected: {ADMIN_PUBKEY.toString().slice(0, 8)}...
            </p>
          </div>
        )}

        {connected && isAdmin && (
          <div className="bg-green-900/50 border border-green-500 rounded-lg p-4 mb-6 text-center">
            <p className="text-green-300">✅ Admin wallet connected</p>
          </div>
        )}

        {/* Vault Stats */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-purple-300">Vault Statistics</h2>
          
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-gray-700/50 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Fee Vault Address</p>
              <p className="font-mono text-sm text-white break-all">{FEE_VAULT_PDA.toString()}</p>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                <p className="text-gray-400 text-sm">Total Balance</p>
                <p className="text-2xl font-bold text-white">
                  {vaultBalance !== null ? vaultBalance.toFixed(4) : '...'} 
                  <span className="text-sm text-gray-400 ml-1">SOL</span>
                </p>
              </div>
              
              <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                <p className="text-gray-400 text-sm">Available</p>
                <p className="text-2xl font-bold text-green-400">
                  {availableBalance !== null ? availableBalance.toFixed(4) : '...'}
                  <span className="text-sm text-gray-400 ml-1">SOL</span>
                </p>
              </div>
              
              <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                <p className="text-gray-400 text-sm">All-Time Collected</p>
                <p className="text-2xl font-bold text-purple-400">
                  {totalCollected !== null ? totalCollected.toFixed(4) : '...'}
                  <span className="text-sm text-gray-400 ml-1">SOL</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Withdraw Section */}
        {connected && isAdmin && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-purple-300">Withdraw Fees</h2>
            
            {/* Custom Amount */}
            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">Custom Amount (SOL)</label>
              <div className="flex gap-3">
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.001"
                  min="0"
                  max={availableBalance || 0}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                  disabled={loading}
                />
                <button
                  onClick={() => handleWithdraw(false)}
                  disabled={loading || !withdrawAmount || availableBalance === 0}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
                >
                  {loading ? 'Processing...' : 'Withdraw'}
                </button>
              </div>
            </div>

            {/* Withdraw All Button */}
            <button
              onClick={() => handleWithdraw(true)}
              disabled={loading || availableBalance === 0}
              className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
            >
              {loading ? 'Processing...' : `Withdraw All (${availableBalance?.toFixed(4) || 0} SOL)`}
            </button>

            {/* Status Messages */}
            {status && (
              <div className={`mt-4 p-4 rounded-lg ${
                status.type === 'success' ? 'bg-green-900/50 border border-green-500 text-green-300' :
                status.type === 'error' ? 'bg-red-900/50 border border-red-500 text-red-300' :
                'bg-blue-900/50 border border-blue-500 text-blue-300'
              }`}>
                {status.message}
              </div>
            )}

            {/* Transaction Link */}
            {txSignature && (
              <div className="mt-4 p-4 bg-gray-700/50 rounded-lg">
                <p className="text-gray-400 text-sm mb-1">Transaction:</p>
                <a
                  href={`https://solscan.io/tx/${txSignature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 text-sm break-all"
                >
                  {txSignature}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Program: {PROGRAM_ID.toString().slice(0, 16)}...</p>
        </div>
      </div>
    </div>
  );
}
