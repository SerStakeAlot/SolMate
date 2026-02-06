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

const PROGRAM_ID = new PublicKey('H1Sn4JQvsZFx7HreZaQn4Poa3hkoS9iGnTwrtN2knrKV');
const ADMIN_PUBKEY = new PublicKey('7BKqimAdco1XsknW88N38qf4PgXGieWN8USPgKxcf87B');
const FEE_VAULT_PDA = new PublicKey('H3y5ST69e5QDVXZsWiNAiDgJfq7eW6GntkvyVxCmq5VX');
const RPC_URL = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://mainnet.helius-rpc.com/?api-key=REDACTED_HELIUS_API_KEY';

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

          {/* Footer */}
          <div style={{ marginTop: '40px', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: '#3a3a50', fontFamily: "'Space Mono', monospace", margin: 0 }}>
              Program: {PROGRAM_ID.toString().slice(0, 16)}...
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
