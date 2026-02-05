'use client';

import { motion } from 'framer-motion';
import { Shield, CheckCircle, AlertTriangle, Lock, Code, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function SecurityAuditPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 sm:px-6 py-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-solana-purple/20 rounded-full">
            <Shield className="w-12 h-12 text-solana-purple" />
          </div>
        </div>
        <h1 className="text-4xl font-bold mb-4">Security Audit Report</h1>
        <p className="text-neutral-400">SolMate Chess Escrow Smart Contract</p>
      </motion.div>

      {/* Executive Summary Card */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-br from-green-900/30 to-green-900/10 border border-green-500/30 rounded-2xl p-6 mb-8"
      >
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle className="w-6 h-6 text-green-400" />
          <h2 className="text-2xl font-bold text-green-400">Overall Assessment: PASS</h2>
        </div>
        <p className="text-neutral-300 mb-4">
          The SolMate escrow program has undergone comprehensive security review and is deployed on Solana Mainnet.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
          <div className="text-center p-3 bg-black/30 rounded-xl">
            <p className="text-green-400 font-bold">✓</p>
            <p className="text-sm text-neutral-400">Code Quality</p>
          </div>
          <div className="text-center p-3 bg-black/30 rounded-xl">
            <p className="text-green-400 font-bold">✓</p>
            <p className="text-sm text-neutral-400">Arithmetic Safety</p>
          </div>
          <div className="text-center p-3 bg-black/30 rounded-xl">
            <p className="text-green-400 font-bold">✓</p>
            <p className="text-sm text-neutral-400">Access Control</p>
          </div>
          <div className="text-center p-3 bg-black/30 rounded-xl">
            <p className="text-green-400 font-bold">✓</p>
            <p className="text-sm text-neutral-400">PDA Security</p>
          </div>
          <div className="text-center p-3 bg-black/30 rounded-xl">
            <p className="text-green-400 font-bold">✓</p>
            <p className="text-sm text-neutral-400">Frontend Security</p>
          </div>
        </div>
      </motion.section>

      {/* Program Details */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 mb-8"
      >
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Code className="w-5 h-5 text-solana-purple" />
          Program Details
        </h2>
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-neutral-800">
            <span className="text-neutral-400">Program ID</span>
            <a 
              href="https://solscan.io/account/H1Sn4JQvsZFx7HreZaQn4Poa3hkoS9iGnTwrtN2knrKV"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-solana-purple hover:text-solana-green transition-colors flex items-center gap-1"
            >
              H1Sn4JQvsZFx7HreZaQn4Poa3hkoS9iGnTwrtN2knrKV
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-neutral-800">
            <span className="text-neutral-400">Network</span>
            <span className="font-semibold text-green-400">Solana Mainnet</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-neutral-800">
            <span className="text-neutral-400">Framework</span>
            <span className="font-mono text-sm">Anchor v0.29.0</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-neutral-800">
            <span className="text-neutral-400">Audit Date</span>
            <span>February 2, 2026 (Updated)</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-neutral-800">
            <span className="text-neutral-400">App Version</span>
            <span className="font-mono text-sm">1.5.0</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between py-2">
            <span className="text-neutral-400">Source Code</span>
            <a 
              href="https://github.com/SerStakeAlot/SolMate"
              target="_blank"
              rel="noopener noreferrer"
              className="text-solana-purple hover:text-solana-green transition-colors flex items-center gap-1"
            >
              GitHub Repository
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </motion.section>

      {/* Security Features */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 mb-8"
      >
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Lock className="w-5 h-5 text-solana-purple" />
          Security Features
        </h2>
        
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-green-400 mb-2">✓ Arithmetic Safety</h3>
            <p className="text-neutral-400 text-sm">
              All arithmetic operations use Rust&apos;s checked_mul, checked_div, and checked_sub methods 
              to prevent integer overflow/underflow vulnerabilities.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold text-green-400 mb-2">✓ Access Control</h3>
            <p className="text-neutral-400 text-sm">
              Every instruction validates signers. Only authorized parties can execute actions:
              match creators can cancel, winners can claim payouts, and only the admin can withdraw fees.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold text-green-400 mb-2">✓ PDA Security</h3>
            <p className="text-neutral-400 text-sm">
              Program Derived Addresses (PDAs) are used for escrow accounts with unique seeds. 
              Bumps are stored and validated to prevent address spoofing attacks.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold text-green-400 mb-2">✓ State Machine Integrity</h3>
            <p className="text-neutral-400 text-sm">
              Match status transitions are strictly enforced: Open → Matched → ResultSubmitted → Completed.
              Invalid state transitions are rejected by the program.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold text-green-400 mb-2">✓ CPI Transfer Security</h3>
            <p className="text-neutral-400 text-sm">
              All fund transfers use Cross-Program Invocation (CPI) to the System Program, 
              ensuring proper signature verification and preventing unauthorized fund movements.
            </p>
          </div>
        </div>
      </motion.section>

      {/* Frontend Security - New Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 mb-8"
      >
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Shield className="w-5 h-5 text-solana-green" />
          Frontend Security (February 2026 Update)
        </h2>
        
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-green-400 mb-2">✓ Android WebView Hardening</h3>
            <p className="text-neutral-400 text-sm">
              All UI components use inline styles with -webkit-text-fill-color for reliable rendering 
              in Phantom&apos;s in-app browser and other mobile wallet WebViews.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold text-green-400 mb-2">✓ Modal Click-Jacking Prevention</h3>
            <p className="text-neutral-400 text-sm">
              Critical modals (How to Play, game results, payouts) use isolated rendering with 
              z-index 99999 and proper event handling to prevent overlay attacks.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold text-green-400 mb-2">✓ Touch Event Security</h3>
            <p className="text-neutral-400 text-sm">
              Mobile-optimized touch handlers with touchAction: manipulation prevent unintended 
              zoom gestures and ensure reliable button interactions on all devices.
            </p>
          </div>
        </div>
      </motion.section>

      {/* Anti-Abuse Measures - New Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.38 }}
        className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 mb-8"
      >
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          Anti-Abuse Measures
        </h2>
        
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-green-400 mb-2">✓ Arena Leaderboard Protection</h3>
            <p className="text-neutral-400 text-sm">
              Resignations in the Holder Arena do not count towards leaderboard standings, 
              preventing score farming through intentional losses.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold text-green-400 mb-2">✓ AI Difficulty Calibration</h3>
            <p className="text-neutral-400 text-sm">
              Arena AI uses opening book and move ordering at ~1500 ELO to prevent trivial wins 
              while maintaining fair competition for the $500 prize pool.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold text-green-400 mb-2">✓ Token Gate Verification</h3>
            <p className="text-neutral-400 text-sm">
              Holder Arena requires verified ownership of 2M+ $MATE tokens, with real-time 
              balance checks to prevent unauthorized access.
            </p>
          </div>
        </div>
      </motion.section>

      {/* How It Works */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 mb-8"
      >
        <h2 className="text-xl font-bold mb-6">How the Escrow Works</h2>
        
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-solana-purple/20 rounded-full flex items-center justify-center text-solana-purple font-bold">1</div>
            <div>
              <h3 className="font-semibold mb-1">Create Match</h3>
              <p className="text-neutral-400 text-sm">Player A creates a match and deposits their stake into a program-controlled escrow PDA.</p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-solana-purple/20 rounded-full flex items-center justify-center text-solana-purple font-bold">2</div>
            <div>
              <h3 className="font-semibold mb-1">Join Match</h3>
              <p className="text-neutral-400 text-sm">Player B joins by depositing a matching stake. Both stakes are now locked in escrow.</p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-solana-purple/20 rounded-full flex items-center justify-center text-solana-purple font-bold">3</div>
            <div>
              <h3 className="font-semibold mb-1">Play Chess</h3>
              <p className="text-neutral-400 text-sm">Players compete in real-time chess. The game server tracks moves and determines the winner.</p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-solana-purple/20 rounded-full flex items-center justify-center text-solana-purple font-bold">4</div>
            <div>
              <h3 className="font-semibold mb-1">Submit Result</h3>
              <p className="text-neutral-400 text-sm">The backend authority submits the game result (winner or draw) to the program.</p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-solana-purple/20 rounded-full flex items-center justify-center text-solana-purple font-bold">5</div>
            <div>
              <h3 className="font-semibold mb-1">Claim Payout</h3>
              <p className="text-neutral-400 text-sm">Winner receives 90% of the total pot. 10% goes to the platform fee vault. In case of a draw, both players are refunded.</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Fee Structure */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 mb-8"
      >
        <h2 className="text-xl font-bold mb-4">Fee Structure</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-black/30 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-green-400">90%</p>
            <p className="text-neutral-400 text-sm">Winner Payout</p>
          </div>
          <div className="bg-black/30 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-solana-purple">10%</p>
            <p className="text-neutral-400 text-sm">Platform Fee</p>
          </div>
        </div>
        <p className="text-neutral-500 text-sm mt-4">
          Example: In a 0.1 SOL match (0.05 SOL each), winner receives 0.09 SOL and platform collects 0.01 SOL.
        </p>
      </motion.section>

      {/* Stake Tiers */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 mb-8"
      >
        <h2 className="text-xl font-bold mb-4">Available Stake Tiers</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-black/30 rounded-xl p-4 text-center border border-neutral-700">
            <p className="text-2xl font-bold text-white">0.05</p>
            <p className="text-neutral-400 text-sm">SOL</p>
          </div>
          <div className="bg-black/30 rounded-xl p-4 text-center border border-neutral-700">
            <p className="text-2xl font-bold text-white">0.1</p>
            <p className="text-neutral-400 text-sm">SOL</p>
          </div>
          <div className="bg-black/30 rounded-xl p-4 text-center border border-neutral-700">
            <p className="text-2xl font-bold text-white">0.5</p>
            <p className="text-neutral-400 text-sm">SOL</p>
          </div>
          <div className="bg-black/30 rounded-xl p-4 text-center border border-neutral-700">
            <p className="text-2xl font-bold text-white">1.0</p>
            <p className="text-neutral-400 text-sm">SOL</p>
          </div>
        </div>
      </motion.section>

      {/* Attack Vectors */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 mb-8"
      >
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          Attack Vectors Reviewed
        </h2>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-neutral-800">
            <span>Re-entrancy</span>
            <span className="text-green-400 text-sm">Not Applicable (Solana prevents by design)</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-neutral-800">
            <span>Integer Overflow</span>
            <span className="text-green-400 text-sm">Protected (checked arithmetic)</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-neutral-800">
            <span>Front-running</span>
            <span className="text-green-400 text-sm">Low Risk (first-come-first-served)</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-neutral-800">
            <span>Denial of Service</span>
            <span className="text-green-400 text-sm">Minimal (no unbounded loops)</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span>Unauthorized Withdrawal</span>
            <span className="text-green-400 text-sm">Protected (signer validation)</span>
          </div>
        </div>
      </motion.section>

      {/* Known Limitations */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="bg-yellow-900/20 border border-yellow-500/30 rounded-2xl p-6 mb-8"
      >
        <h2 className="text-xl font-bold mb-4 text-yellow-400">Known Limitations</h2>
        <ul className="space-y-2 text-neutral-300 text-sm">
          <li className="flex gap-2">
            <span className="text-yellow-500">•</span>
            <span>Upstream dependency advisories exist in Solana SDK (affects all Anchor programs)</span>
          </li>
          <li className="flex gap-2">
            <span className="text-yellow-500">•</span>
            <span>Game result submission requires trust in the backend authority</span>
          </li>
          <li className="flex gap-2">
            <span className="text-yellow-500">•</span>
            <span>No time-based match expiration (unmatched games must be manually cancelled)</span>
          </li>
        </ul>
      </motion.section>

      {/* Disclaimer */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="bg-neutral-900/30 border border-neutral-800 rounded-2xl p-6 mb-8"
      >
        <h2 className="text-lg font-bold mb-3 text-neutral-400">Disclaimer</h2>
        <p className="text-neutral-500 text-sm leading-relaxed">
          This security audit was conducted internally by the SolMate development team. While comprehensive 
          testing and review have been performed, no audit can guarantee the complete absence of vulnerabilities. 
          Users should only stake amounts they can afford to lose. Smart contract interactions carry inherent risks.
        </p>
      </motion.section>

      {/* Back to Home */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="text-center"
      >
        <Link 
          href="/"
          className="inline-flex items-center gap-2 text-solana-purple hover:text-solana-green transition-colors"
        >
          ← Back to Home
        </Link>
      </motion.div>
    </main>
  );
}
