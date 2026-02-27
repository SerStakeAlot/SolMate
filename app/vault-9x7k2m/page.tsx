'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';

const PROGRAM_ID = new PublicKey('79mzfYBWp6thaU5pYLJLpNBXCrSoZVVyttTHuWx732cr');
const LEGACY_PROGRAM_ID = new PublicKey('H1Sn4JQvsZFx7HreZaQn4Poa3hkoS9iGnTwrtN2knrKV');
const ADMIN_PUBKEY = new PublicKey('7BKqimAdco1XsknW88N38qf4PgXGieWN8USPgKxcf87B');
const FEE_VAULT_PDA = new PublicKey('F1KmjaEjWF83yrRyWsPJABDxPNtZ5dJurXSze6d8qdJ9');
const LEGACY_FEE_VAULT_PDA = new PublicKey('H3y5ST69e5QDVXZsWiNAiDgJfq7eW6GntkvyVxCmq5VX');
const RPC_URL = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';

// Token fee vault (separate PDA from SOL fee vault)
const [TOKEN_FEE_VAULT_PDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('token_fee_vault')],
  PROGRAM_ID
);

// Supported token mints
const MATE_MINT_ADDR = '5CJN2E6dDU9XxDJnz3ZEELxPP8HsGTKPbsNVB2djpump';
const TOKEN_MINTS: { label: string; mint: PublicKey; decimals: number; color: string }[] = [
  { label: '$MATE', mint: new PublicKey(MATE_MINT_ADDR), decimals: 6, color: '#00ffa3' },
  { label: '$SKR',  mint: new PublicKey('SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3'),  decimals: 6, color: '#00d4ff' },
];

/** MATE uses Token-2022, everything else uses standard Token program */
function getTokenProgram(mint: PublicKey): PublicKey {
  return mint.toBase58() === MATE_MINT_ADDR ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
}

// Particle field matching homepage
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;
    let w = (canvas.width = canvas.offsetWidth);
    let h = (canvas.height = canvas.offsetHeight);

    const particles = Array.from({ length: 40 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 2 + 0.5,
      o: Math.random() * 0.4 + 0.1,
    }));

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(153, 69, 255, ${p.o})`;
        ctx.fill();
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0, 255, 163, ${0.06 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    }
    draw();

    const resize = () => {
      if (!canvas) return;
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}

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
  const [rescueMatchPda, setRescueMatchPda] = useState<string>('');
  const [rescueRecipient, setRescueRecipient] = useState<string>(ADMIN_PUBKEY.toString());
  const [rescueLoading, setRescueLoading] = useState(false);
  const [rescueStatus, setRescueStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [rescueTxSignature, setRescueTxSignature] = useState<string | null>(null);
  const [rescueUseLegacy, setRescueUseLegacy] = useState(false);
  const [rescueMatchInfo, setRescueMatchInfo] = useState<{ balance: number; escrowBalance: number; status: string } | null>(null);

  // Token fee vault state
  const [tokenFeeBalances, setTokenFeeBalances] = useState<{ label: string; mint: string; balance: number; color: string }[]>([]);
  const [tokenWithdrawLoading, setTokenWithdrawLoading] = useState<string | null>(null);
  const [tokenFeeStatus, setTokenFeeStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [tokenFeeTxSignature, setTokenFeeTxSignature] = useState<string | null>(null);

  const fetchVaultData = useCallback(async () => {
    try {
      const connection = new Connection(RPC_URL, 'confirmed');
      const accountInfo = await connection.getAccountInfo(FEE_VAULT_PDA);
      
      if (!accountInfo) {
        setVaultBalance(0);
        setAvailableBalance(0);
        setTotalCollected(0);
      } else {
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
      }

      // Fetch token fee vault balances
      const tokenBalances: { label: string; mint: string; balance: number; color: string }[] = [];
      for (const token of TOKEN_MINTS) {
        try {
          const ata = getAssociatedTokenAddressSync(token.mint, TOKEN_FEE_VAULT_PDA, true, getTokenProgram(token.mint));
          const ataInfo = await connection.getTokenAccountBalance(ata);
          tokenBalances.push({
            label: token.label,
            mint: token.mint.toBase58(),
            balance: ataInfo.value.uiAmount || 0,
            color: token.color,
          });
        } catch {
          // ATA doesn't exist yet — no fees collected for this token
          tokenBalances.push({
            label: token.label,
            mint: token.mint.toBase58(),
            balance: 0,
            color: token.color,
          });
        }
      }
      setTokenFeeBalances(tokenBalances);
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

  const handleTokenWithdraw = async (mintAddress: string) => {
    if (!publicKey || !isAdmin) return;

    setTokenWithdrawLoading(mintAddress);
    setTokenFeeStatus(null);
    setTokenFeeTxSignature(null);

    try {
      const connection = new Connection(RPC_URL, 'confirmed');
      const mint = new PublicKey(mintAddress);

      // Derive accounts
      const tokenProg = getTokenProgram(mint);
      const feeVaultAta = getAssociatedTokenAddressSync(mint, TOKEN_FEE_VAULT_PDA, true, tokenProg);
      const adminAta = getAssociatedTokenAddressSync(mint, publicKey, false, tokenProg);

      // Check if admin ATA exists; if not, we need to create it
      const adminAtaInfo = await connection.getAccountInfo(adminAta);

      const transaction = new Transaction();

      // Create admin ATA if it doesn't exist
      if (!adminAtaInfo) {
        const createAtaIx = new TransactionInstruction({
          keys: [
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: adminAta, isSigner: false, isWritable: true },
            { pubkey: publicKey, isSigner: false, isWritable: false },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: tokenProg, isSigner: false, isWritable: false },
          ],
          programId: ASSOCIATED_TOKEN_PROGRAM_ID,
          data: Buffer.alloc(0),
        });
        transaction.add(createAtaIx);
      }

      // Build withdraw_token_fees instruction
      // Discriminator: sha256('global:withdraw_token_fees')[0..8]
      const discriminator = Buffer.from([148, 11, 90, 7, 99, 98, 153, 104]);
      // amount = 0 means withdraw all
      const amountBuffer = Buffer.alloc(8);
      amountBuffer.writeBigUInt64LE(BigInt(0));
      const data = Buffer.concat([discriminator, amountBuffer]);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: mint, isSigner: false, isWritable: false },                        // mint
          { pubkey: TOKEN_FEE_VAULT_PDA, isSigner: false, isWritable: false },         // fee_vault_authority
          { pubkey: feeVaultAta, isSigner: false, isWritable: true },                  // fee_vault_token_account
          { pubkey: adminAta, isSigner: false, isWritable: true },                     // admin_token_account
          { pubkey: publicKey, isSigner: true, isWritable: true },                     // admin
          { pubkey: tokenProg, isSigner: false, isWritable: false },            // token_program
        ],
        programId: PROGRAM_ID,
        data,
      });

      transaction.add(instruction);

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signature = await sendTransaction(transaction, connection);
      setTokenFeeStatus({ type: 'info', message: 'Transaction sent, confirming...' });

      await connection.confirmTransaction(signature, 'confirmed');

      const tokenLabel = TOKEN_MINTS.find(t => t.mint.toBase58() === mintAddress)?.label || 'tokens';
      setTokenFeeTxSignature(signature);
      setTokenFeeStatus({ type: 'success', message: `${tokenLabel} fees withdrawn successfully!` });

      setTimeout(fetchVaultData, 2000);
    } catch (error: unknown) {
      console.error('Token fee withdrawal error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTokenFeeStatus({ type: 'error', message: `Token withdrawal failed: ${errorMessage}` });
    } finally {
      setTokenWithdrawLoading(null);
    }
  };

  const handleLookupMatch = async () => {
    if (!rescueMatchPda) return;
    setRescueMatchInfo(null);
    try {
      const matchPubkey = new PublicKey(rescueMatchPda);
      const programId = rescueUseLegacy ? LEGACY_PROGRAM_ID : PROGRAM_ID;
      const connection = new Connection(RPC_URL, 'confirmed');

      // Fetch match account
      const matchInfo = await connection.getAccountInfo(matchPubkey);
      if (!matchInfo) {
        setRescueStatus({ type: 'error', message: 'Match account not found on-chain' });
        return;
      }

      // Derive escrow PDA
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('escrow'), matchPubkey.toBuffer()],
        programId
      );
      const escrowInfo = await connection.getAccountInfo(escrowPda);

      // Parse status byte from match data (offset 8 = discriminator, then fields...)
      // Match struct: discriminator(8) + player_a(32) + player_b(32) + stake_tier(1) + status(1)
      const statusByte = matchInfo.data.length > 73 ? matchInfo.data[73] : -1;
      const statusLabels: Record<number, string> = { 0: 'WaitingForOpponent', 1: 'Active', 2: 'Finished', 3: 'Cancelled', 4: 'Abandoned' };

      setRescueMatchInfo({
        balance: matchInfo.lamports / LAMPORTS_PER_SOL,
        escrowBalance: escrowInfo ? escrowInfo.lamports / LAMPORTS_PER_SOL : 0,
        status: statusLabels[statusByte] || `Unknown(${statusByte})`,
      });
      setRescueStatus({ type: 'info', message: `Match found. Escrow: ${escrowPda.toBase58()}` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setRescueStatus({ type: 'error', message: `Lookup failed: ${msg}` });
    }
  };

  const handleAdminRescue = async () => {
    if (!publicKey || !isAdmin || !rescueMatchPda) return;

    setRescueLoading(true);
    setRescueStatus(null);
    setRescueTxSignature(null);

    try {
      const connection = new Connection(RPC_URL, 'confirmed');
      const matchPubkey = new PublicKey(rescueMatchPda);
      const recipientPubkey = new PublicKey(rescueRecipient || ADMIN_PUBKEY.toString());
      const programId = rescueUseLegacy ? LEGACY_PROGRAM_ID : PROGRAM_ID;

      // Derive escrow PDA
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('escrow'), matchPubkey.toBuffer()],
        programId
      );

      // Anchor discriminator for admin_rescue: sha256('global:admin_rescue')[0..8]
      const discriminator = Buffer.from([255, 99, 87, 225, 241, 205, 235, 5]);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: matchPubkey, isSigner: false, isWritable: true },    // match_account
          { pubkey: escrowPda, isSigner: false, isWritable: true },      // escrow
          { pubkey: recipientPubkey, isSigner: false, isWritable: true },// recipient
          { pubkey: publicKey, isSigner: true, isWritable: true },       // admin
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
        ],
        programId,
        data: discriminator,
      });

      const transaction = new Transaction().add(instruction);
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signature = await sendTransaction(transaction, connection);
      setRescueStatus({ type: 'info', message: 'Transaction sent, confirming...' });

      await connection.confirmTransaction(signature, 'confirmed');

      setRescueTxSignature(signature);
      setRescueStatus({ type: 'success', message: 'Admin rescue successful! Match account closed and funds recovered.' });
      setRescueMatchPda('');
      setRescueMatchInfo(null);

      setTimeout(fetchVaultData, 2000);
    } catch (error: unknown) {
      console.error('Admin rescue error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setRescueStatus({ type: 'error', message: `Rescue failed: ${errorMessage}` });
    } finally {
      setRescueLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .vault-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 20px;
          padding: 32px 28px;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          overflow: hidden;
        }
        .vault-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(153,69,255,0.3), transparent);
          opacity: 0;
          transition: opacity 0.4s;
        }
        .vault-card:hover {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.1);
          transform: translateY(-2px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .vault-card:hover::before {
          opacity: 1;
        }
        .vault-stat-box {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          padding: 20px;
          text-align: center;
          transition: all 0.3s;
        }
        .vault-stat-box:hover {
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.1);
        }
        .vault-input {
          flex: 1;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          padding: 14px 18px;
          color: #e8e8f0;
          font-size: 15px;
          font-family: 'Space Mono', monospace;
          outline: none;
          transition: all 0.3s;
        }
        .vault-input:focus {
          border-color: rgba(153,69,255,0.4);
          box-shadow: 0 0 20px rgba(153,69,255,0.1);
        }
        .vault-input::placeholder {
          color: #3a3a50;
        }
        .btn-vault {
          padding: 14px 28px;
          background: linear-gradient(135deg, #9945ff 0%, #7b2fdb 100%);
          border: none;
          border-radius: 14px;
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          font-family: 'Outfit', sans-serif;
          cursor: pointer;
          transition: all 0.3s ease;
          letter-spacing: 0.02em;
        }
        .btn-vault:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 30px rgba(153,69,255,0.3);
        }
        .btn-vault:disabled {
          background: rgba(255,255,255,0.04);
          color: #6b6b80;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
        .btn-withdraw-all {
          width: 100%;
          padding: 16px;
          background: rgba(0,255,163,0.08);
          border: 1px solid rgba(0,255,163,0.2);
          border-radius: 14px;
          color: #00ffa3;
          font-size: 15px;
          font-weight: 700;
          font-family: 'Outfit', sans-serif;
          cursor: pointer;
          transition: all 0.3s ease;
          letter-spacing: 0.02em;
        }
        .btn-withdraw-all:hover {
          background: rgba(0,255,163,0.15);
          border-color: rgba(0,255,163,0.4);
          transform: translateY(-1px);
          box-shadow: 0 8px 30px rgba(0,255,163,0.15);
        }
        .btn-withdraw-all:disabled {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.06);
          color: #6b6b80;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
        .btn-rescue {
          width: 100%;
          padding: 16px;
          background: rgba(255,107,107,0.08);
          border: 1px solid rgba(255,107,107,0.2);
          border-radius: 14px;
          color: #ff6b6b;
          font-size: 15px;
          font-weight: 700;
          font-family: 'Outfit', sans-serif;
          cursor: pointer;
          transition: all 0.3s ease;
          letter-spacing: 0.02em;
        }
        .btn-rescue:hover {
          background: rgba(255,107,107,0.15);
          border-color: rgba(255,107,107,0.4);
          transform: translateY(-1px);
          box-shadow: 0 8px 30px rgba(255,107,107,0.15);
        }
        .btn-rescue:disabled {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.06);
          color: #6b6b80;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
        .btn-lookup {
          padding: 14px 20px;
          background: rgba(59,130,246,0.1);
          border: 1px solid rgba(59,130,246,0.25);
          border-radius: 14px;
          color: #60a5fa;
          font-size: 13px;
          font-weight: 700;
          font-family: 'Outfit', sans-serif;
          cursor: pointer;
          transition: all 0.3s ease;
          white-space: nowrap;
        }
        .btn-lookup:hover {
          background: rgba(59,130,246,0.2);
          border-color: rgba(59,130,246,0.4);
        }
        .btn-lookup:disabled {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.06);
          color: #6b6b80;
          cursor: not-allowed;
        }
        .toggle-btn {
          padding: 8px 16px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          font-family: 'Space Mono', monospace;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          color: #6b6b80;
        }
        .toggle-btn.active {
          background: rgba(153,69,255,0.12);
          border-color: rgba(153,69,255,0.3);
          color: #9945ff;
        }
        .btn-token-withdraw {
          padding: 10px 20px;
          background: rgba(0,212,255,0.08);
          border: 1px solid rgba(0,212,255,0.2);
          border-radius: 12px;
          color: #00d4ff;
          font-size: 13px;
          font-weight: 700;
          font-family: 'Outfit', sans-serif;
          cursor: pointer;
          transition: all 0.3s ease;
          white-space: nowrap;
        }
        .btn-token-withdraw:hover {
          background: rgba(0,212,255,0.15);
          border-color: rgba(0,212,255,0.4);
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(0,212,255,0.15);
        }
        .btn-token-withdraw:disabled {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.06);
          color: #6b6b80;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
      `}</style>

      <div
        style={{
          minHeight: '100vh',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: "'Outfit', sans-serif",
          color: '#e8e8f0',
        }}
      >
        <ParticleField />

        {/* Ambient glow effects matching homepage */}
        <div
          style={{
            position: 'absolute',
            top: '-15%',
            right: '-10%',
            width: '500px',
            height: '500px',
            background: 'radial-gradient(circle, rgba(153,69,255,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-10%',
            left: '-10%',
            width: '400px',
            height: '400px',
            background: 'radial-gradient(circle, rgba(0,255,163,0.05) 0%, transparent 70%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            maxWidth: '720px',
            margin: '0 auto',
            padding: '60px 24px 100px',
          }}
        >
          {/* Page Header */}
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div
              style={{
                fontSize: '48px',
                marginBottom: '16px',
                filter: 'drop-shadow(0 0 20px rgba(153,69,255,0.3))',
              }}
            >
              🔐
            </div>
            <h1
              style={{
                fontSize: 'clamp(32px, 5vw, 44px)',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                marginBottom: '10px',
                marginTop: 0,
                lineHeight: 1.1,
              }}
            >
              <span style={{ color: '#e8e8f0' }}>Fee </span>
              <span
                style={{
                  background: 'linear-gradient(135deg, #9945ff 0%, #00ffa3 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Vault
              </span>
            </h1>
            <p
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: '13px',
                color: '#6b6b80',
                marginTop: 0,
              }}
            >
              SolMate Platform Fee Management
            </p>
          </div>

          {/* Wallet Connection */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
            <WalletMultiButton />
          </div>

          {/* Admin Check */}
          {connected && !isAdmin && (
            <div
              className="vault-card"
              style={{
                background: 'rgba(239,68,68,0.06)',
                borderColor: 'rgba(239,68,68,0.2)',
                textAlign: 'center',
                marginBottom: '20px',
                padding: '20px 28px',
              }}
            >
              <p style={{ color: '#f87171', fontSize: '15px', margin: 0, fontWeight: 600 }}>⚠️ Connected wallet is not the admin</p>
              <p style={{ fontSize: '12px', color: '#6b6b80', fontFamily: "'Space Mono', monospace", marginTop: '6px', marginBottom: 0 }}>
                Expected: {ADMIN_PUBKEY.toString().slice(0, 8)}...
              </p>
            </div>
          )}

          {connected && isAdmin && (
            <div
              className="vault-card"
              style={{
                background: 'rgba(0,255,163,0.04)',
                borderColor: 'rgba(0,255,163,0.2)',
                textAlign: 'center',
                marginBottom: '20px',
                padding: '20px 28px',
              }}
            >
              <p style={{ color: '#00ffa3', fontSize: '15px', margin: 0, fontWeight: 600 }}>✅ Admin wallet connected</p>
            </div>
          )}

          {/* Vault Stats */}
          <div className="vault-card" style={{ marginBottom: '20px' }}>
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 700,
                marginBottom: '20px',
                marginTop: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#9945ff',
                  boxShadow: '0 0 12px rgba(153,69,255,0.5)',
                  display: 'inline-block',
                }}
              />
              Vault Statistics
            </h2>

            {/* Fee Vault Address */}
            <div className="vault-stat-box" style={{ textAlign: 'left', marginBottom: '16px' }}>
              <p style={{ fontSize: '11px', color: '#6b6b80', fontFamily: "'Space Mono', monospace", marginBottom: '6px', marginTop: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Fee Vault Address
              </p>
              <p
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: '12px',
                  color: '#a0a0b8',
                  wordBreak: 'break-all',
                  margin: 0,
                  lineHeight: 1.7,
                }}
              >
                {FEE_VAULT_PDA.toString()}
              </p>
            </div>

            {/* Stat Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div className="vault-stat-box">
                <p style={{ fontSize: '11px', color: '#6b6b80', fontFamily: "'Space Mono', monospace", marginBottom: '8px', marginTop: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Total Balance
                </p>
                <p style={{ fontSize: '22px', fontWeight: 700, color: '#e8e8f0', margin: 0, fontFamily: "'Space Mono', monospace" }}>
                  {vaultBalance !== null ? vaultBalance.toFixed(4) : '...'}
                </p>
                <p style={{ fontSize: '11px', color: '#6b6b80', marginTop: '4px', marginBottom: 0 }}>SOL</p>
              </div>

              <div className="vault-stat-box">
                <p style={{ fontSize: '11px', color: '#6b6b80', fontFamily: "'Space Mono', monospace", marginBottom: '8px', marginTop: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Available
                </p>
                <p style={{ fontSize: '22px', fontWeight: 700, color: '#00ffa3', margin: 0, fontFamily: "'Space Mono', monospace" }}>
                  {availableBalance !== null ? availableBalance.toFixed(4) : '...'}
                </p>
                <p style={{ fontSize: '11px', color: '#6b6b80', marginTop: '4px', marginBottom: 0 }}>SOL</p>
              </div>

              <div className="vault-stat-box">
                <p style={{ fontSize: '11px', color: '#6b6b80', fontFamily: "'Space Mono', monospace", marginBottom: '8px', marginTop: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  All-Time
                </p>
                <p style={{ fontSize: '22px', fontWeight: 700, color: '#9945ff', margin: 0, fontFamily: "'Space Mono', monospace" }}>
                  {totalCollected !== null ? totalCollected.toFixed(4) : '...'}
                </p>
                <p style={{ fontSize: '11px', color: '#6b6b80', marginTop: '4px', marginBottom: 0 }}>SOL</p>
              </div>
            </div>
          </div>

          {/* Withdraw Section */}
          {connected && isAdmin && (
            <div className="vault-card">
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  marginBottom: '20px',
                  marginTop: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#00ffa3',
                    boxShadow: '0 0 12px rgba(0,255,163,0.5)',
                    display: 'inline-block',
                  }}
                />
                Withdraw Fees
              </h2>

              {/* Custom Amount */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#6b6b80', fontFamily: "'Space Mono', monospace", marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Custom Amount (SOL)
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.001"
                    min="0"
                    max={availableBalance || 0}
                    disabled={loading}
                    className="vault-input"
                  />
                  <button
                    onClick={() => handleWithdraw(false)}
                    disabled={loading || !withdrawAmount || availableBalance === 0}
                    className="btn-vault"
                  >
                    {loading ? 'Processing...' : 'Withdraw'}
                  </button>
                </div>
              </div>

              {/* Withdraw All Button */}
              <button
                onClick={() => handleWithdraw(true)}
                disabled={loading || availableBalance === 0}
                className="btn-withdraw-all"
              >
                {loading ? 'Processing...' : `Withdraw All (${availableBalance?.toFixed(4) || 0} SOL)`}
              </button>

              {/* Status Messages */}
              {status && (
                <div
                  style={{
                    marginTop: '16px',
                    padding: '16px 20px',
                    borderRadius: '14px',
                    fontSize: '14px',
                    lineHeight: 1.6,
                    ...(status.type === 'success'
                      ? { background: 'rgba(0,255,163,0.06)', border: '1px solid rgba(0,255,163,0.2)', color: '#00ffa3' }
                      : status.type === 'error'
                      ? { background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }
                      : { background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa' }),
                  }}
                >
                  {status.message}
                </div>
              )}

              {/* Transaction Link */}
              {txSignature && (
                <div
                  className="vault-stat-box"
                  style={{ textAlign: 'left', marginTop: '12px' }}
                >
                  <p style={{ fontSize: '11px', color: '#6b6b80', fontFamily: "'Space Mono', monospace", marginBottom: '6px', marginTop: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Transaction
                  </p>
                  <a
                    href={`https://solscan.io/tx/${txSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: '#9945ff',
                      fontSize: '12px',
                      fontFamily: "'Space Mono', monospace",
                      wordBreak: 'break-all',
                      textDecoration: 'none',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#b366ff')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#9945ff')}
                  >
                    {txSignature}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Admin Rescue Section */}
          {connected && isAdmin && (
            <>
            {/* Token Fee Vault Section */}
            <div className="vault-card" style={{ marginTop: '20px' }}>
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  marginBottom: '8px',
                  marginTop: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#00d4ff',
                    boxShadow: '0 0 12px rgba(0,212,255,0.5)',
                    display: 'inline-block',
                  }}
                />
                Token Fee Vault
              </h2>
              <p style={{ fontSize: '12px', color: '#6b6b80', fontFamily: "'Space Mono', monospace", marginTop: '0', marginBottom: '20px' }}>
                10% fees collected from $MATE and $SKR wager matches
              </p>

              {/* Token Fee Vault Address */}
              <div className="vault-stat-box" style={{ textAlign: 'left', marginBottom: '16px' }}>
                <p style={{ fontSize: '11px', color: '#6b6b80', fontFamily: "'Space Mono', monospace", marginBottom: '6px', marginTop: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Token Fee Vault PDA
                </p>
                <p
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: '12px',
                    color: '#a0a0b8',
                    wordBreak: 'break-all',
                    margin: 0,
                    lineHeight: 1.7,
                  }}
                >
                  {TOKEN_FEE_VAULT_PDA.toBase58()}
                </p>
              </div>

              {/* Token Balances */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {tokenFeeBalances.map((token) => (
                  <div
                    key={token.mint}
                    className="vault-stat-box"
                    style={{
                      textAlign: 'left',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px 20px',
                    }}
                  >
                    <div>
                      <p style={{ fontSize: '11px', color: '#6b6b80', fontFamily: "'Space Mono', monospace", marginBottom: '6px', marginTop: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        {token.label} Fees
                      </p>
                      <p style={{ fontSize: '22px', fontWeight: 700, color: token.color, margin: 0, fontFamily: "'Space Mono', monospace" }}>
                        {token.balance.toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleTokenWithdraw(token.mint)}
                      disabled={token.balance === 0 || tokenWithdrawLoading !== null}
                      className="btn-token-withdraw"
                    >
                      {tokenWithdrawLoading === token.mint ? 'Processing...' : `Withdraw All`}
                    </button>
                  </div>
                ))}

                {tokenFeeBalances.length === 0 && (
                  <p style={{ fontSize: '13px', color: '#6b6b80', fontFamily: "'Space Mono', monospace", textAlign: 'center', margin: '12px 0' }}>
                    Loading token balances...
                  </p>
                )}
              </div>

              {/* Token Fee Status */}
              {tokenFeeStatus && (
                <div
                  style={{
                    marginTop: '16px',
                    padding: '16px 20px',
                    borderRadius: '14px',
                    fontSize: '14px',
                    lineHeight: 1.6,
                    wordBreak: 'break-all',
                    ...(tokenFeeStatus.type === 'success'
                      ? { background: 'rgba(0,255,163,0.06)', border: '1px solid rgba(0,255,163,0.2)', color: '#00ffa3' }
                      : tokenFeeStatus.type === 'error'
                      ? { background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }
                      : { background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa' }),
                  }}
                >
                  {tokenFeeStatus.message}
                </div>
              )}

              {/* Token Fee Tx Link */}
              {tokenFeeTxSignature && (
                <div className="vault-stat-box" style={{ textAlign: 'left', marginTop: '12px' }}>
                  <p style={{ fontSize: '11px', color: '#6b6b80', fontFamily: "'Space Mono', monospace", marginBottom: '6px', marginTop: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Transaction
                  </p>
                  <a
                    href={`https://solscan.io/tx/${tokenFeeTxSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: '#00d4ff',
                      fontSize: '12px',
                      fontFamily: "'Space Mono', monospace",
                      wordBreak: 'break-all',
                      textDecoration: 'none',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#66e0ff')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#00d4ff')}
                  >
                    {tokenFeeTxSignature}
                  </a>
                </div>
              )}
            </div>
            <div className="vault-card" style={{ marginTop: '20px' }}>
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  marginBottom: '8px',
                  marginTop: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#ff6b6b',
                    boxShadow: '0 0 12px rgba(255,107,107,0.5)',
                    display: 'inline-block',
                  }}
                />
                Admin Rescue
              </h2>
              <p style={{ fontSize: '12px', color: '#6b6b80', fontFamily: "'Space Mono', monospace", marginTop: '0', marginBottom: '20px' }}>
                Recover stuck escrow funds from any match. Closes the match account and sends SOL to the recipient.
              </p>

              {/* Program Toggle */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#6b6b80', fontFamily: "'Space Mono', monospace", marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Program
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className={`toggle-btn ${!rescueUseLegacy ? 'active' : ''}`}
                    onClick={() => { setRescueUseLegacy(false); setRescueMatchInfo(null); }}
                  >
                    Current ({PROGRAM_ID.toString().slice(0, 6)}...)
                  </button>
                  <button
                    className={`toggle-btn ${rescueUseLegacy ? 'active' : ''}`}
                    onClick={() => { setRescueUseLegacy(true); setRescueMatchInfo(null); }}
                  >
                    Legacy ({LEGACY_PROGRAM_ID.toString().slice(0, 6)}...)
                  </button>
                </div>
              </div>

              {/* Match PDA Input */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#6b6b80', fontFamily: "'Space Mono', monospace", marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Match Account PDA
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input
                    type="text"
                    value={rescueMatchPda}
                    onChange={(e) => { setRescueMatchPda(e.target.value.trim()); setRescueMatchInfo(null); }}
                    placeholder="Enter match PDA pubkey..."
                    disabled={rescueLoading}
                    className="vault-input"
                    style={{ fontSize: '12px' }}
                  />
                  <button
                    onClick={handleLookupMatch}
                    disabled={!rescueMatchPda || rescueLoading}
                    className="btn-lookup"
                  >
                    Lookup
                  </button>
                </div>
              </div>

              {/* Match Info Display */}
              {rescueMatchInfo && (
                <div className="vault-stat-box" style={{ marginBottom: '16px', textAlign: 'left' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <p style={{ fontSize: '11px', color: '#6b6b80', fontFamily: "'Space Mono', monospace", margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Status</p>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#e8e8f0', margin: 0, fontFamily: "'Space Mono', monospace" }}>{rescueMatchInfo.status}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', color: '#6b6b80', fontFamily: "'Space Mono', monospace", margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Match Rent</p>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#e8e8f0', margin: 0, fontFamily: "'Space Mono', monospace" }}>{rescueMatchInfo.balance.toFixed(4)} SOL</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', color: '#6b6b80', fontFamily: "'Space Mono', monospace", margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Escrow</p>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: rescueMatchInfo.escrowBalance > 0 ? '#ff6b6b' : '#00ffa3', margin: 0, fontFamily: "'Space Mono', monospace" }}>
                        {rescueMatchInfo.escrowBalance.toFixed(4)} SOL
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Recipient Input */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#6b6b80', fontFamily: "'Space Mono', monospace", marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Recipient Wallet (defaults to admin)
                </label>
                <input
                  type="text"
                  value={rescueRecipient}
                  onChange={(e) => setRescueRecipient(e.target.value.trim())}
                  placeholder={ADMIN_PUBKEY.toString()}
                  disabled={rescueLoading}
                  className="vault-input"
                  style={{ fontSize: '12px', width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              {/* Rescue Button */}
              <button
                onClick={handleAdminRescue}
                disabled={rescueLoading || !rescueMatchPda}
                className="btn-rescue"
              >
                {rescueLoading ? 'Processing Rescue...' : `🚨 Execute Admin Rescue`}
              </button>

              {/* Rescue Status */}
              {rescueStatus && (
                <div
                  style={{
                    marginTop: '16px',
                    padding: '16px 20px',
                    borderRadius: '14px',
                    fontSize: '14px',
                    lineHeight: 1.6,
                    wordBreak: 'break-all',
                    ...(rescueStatus.type === 'success'
                      ? { background: 'rgba(0,255,163,0.06)', border: '1px solid rgba(0,255,163,0.2)', color: '#00ffa3' }
                      : rescueStatus.type === 'error'
                      ? { background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }
                      : { background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa' }),
                  }}
                >
                  {rescueStatus.message}
                </div>
              )}

              {/* Rescue Tx Link */}
              {rescueTxSignature && (
                <div className="vault-stat-box" style={{ textAlign: 'left', marginTop: '12px' }}>
                  <p style={{ fontSize: '11px', color: '#6b6b80', fontFamily: "'Space Mono', monospace", marginBottom: '6px', marginTop: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Rescue Transaction
                  </p>
                  <a
                    href={`https://solscan.io/tx/${rescueTxSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: '#ff6b6b',
                      fontSize: '12px',
                      fontFamily: "'Space Mono', monospace",
                      wordBreak: 'break-all',
                      textDecoration: 'none',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#ff9999')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#ff6b6b')}
                  >
                    {rescueTxSignature}
                  </a>
                </div>
              )}
            </div>
          </>
          )}

          {/* Footer */}
          <div style={{ marginTop: '40px', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: '#3a3a50', fontFamily: "'Space Mono', monospace", margin: '0 0 4px' }}>
              Program: {PROGRAM_ID.toString()}
            </p>
            <p style={{ fontSize: '11px', color: '#2a2a3a', fontFamily: "'Space Mono', monospace", margin: 0 }}>
              Legacy: {LEGACY_PROGRAM_ID.toString()}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
