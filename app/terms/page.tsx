"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
      <Link 
        href="/"
        className="inline-flex items-center gap-2 text-neutral-400 hover:text-white mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </Link>

      <h1 className="text-3xl sm:text-4xl font-bold mb-2">Terms of Service</h1>
      <p className="text-neutral-500 mb-8">Last updated: January 14, 2026</p>

      <div className="prose prose-invert prose-neutral max-w-none space-y-6">
        <section className="glass-card rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
          <p className="text-neutral-300 leading-relaxed">
            By accessing or using SolMate, you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the application.
          </p>
        </section>

        <section className="glass-card rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-3">2. Description of Service</h2>
          <p className="text-neutral-300 leading-relaxed">
            SolMate is a decentralized chess application that allows users to play staked matches using SOL cryptocurrency on the Solana blockchain. Users can stake SOL, compete in chess matches, and winners receive payouts automatically through our smart contract.
          </p>
        </section>

        <section className="glass-card rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-3">3. Eligibility</h2>
          <p className="text-neutral-300 leading-relaxed">
            You must be at least 18 years old to use SolMate. By using this service, you represent that you are of legal age in your jurisdiction and that online gaming and cryptocurrency transactions are legal in your location.
          </p>
        </section>

        <section className="glass-card rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-3">4. Wallet & Cryptocurrency</h2>
          <ul className="text-neutral-300 space-y-2 list-disc list-inside">
            <li>You are responsible for maintaining the security of your wallet</li>
            <li>We never have access to your private keys</li>
            <li>All transactions are final and irreversible on the blockchain</li>
            <li>You are responsible for ensuring sufficient SOL balance for stakes and transaction fees</li>
          </ul>
        </section>

        <section className="glass-card rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-3">5. Staking & Payouts</h2>
          <p className="text-neutral-300 leading-relaxed mb-3">
            <strong className="text-white">Stakes:</strong> Players stake SOL to participate in matches. Available stake tiers are 0.5 SOL and 1 SOL.
          </p>
          <p className="text-neutral-300 leading-relaxed mb-3">
            <strong className="text-white">Payouts:</strong> Winners receive 90% of the total stake pool. A 10% fee is retained for platform maintenance.
          </p>
          <p className="text-neutral-300 leading-relaxed">
            <strong className="text-white">Escrow:</strong> All stakes are held in a secure smart contract until match completion.
          </p>
        </section>

        <section className="glass-card rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-3">6. Game Rules</h2>
          <ul className="text-neutral-300 space-y-2 list-disc list-inside">
            <li>Standard chess rules apply</li>
            <li>Matches have a 10-minute timer per player</li>
            <li>Running out of time results in a loss</li>
            <li>Disconnection or abandonment may result in forfeiture</li>
            <li>Cheating or use of chess engines is prohibited</li>
          </ul>
        </section>

        <section className="glass-card rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-3">7. Prohibited Conduct</h2>
          <ul className="text-neutral-300 space-y-2 list-disc list-inside">
            <li>Using chess engines or AI assistance during matches</li>
            <li>Manipulating or exploiting the smart contract</li>
            <li>Colluding with other players</li>
            <li>Creating multiple accounts to manipulate matchmaking</li>
            <li>Any activity that violates applicable laws</li>
          </ul>
        </section>

        <section className="glass-card rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-3">8. Risks</h2>
          <p className="text-neutral-300 leading-relaxed">
            You acknowledge that using cryptocurrency and blockchain applications involves risks including but not limited to: price volatility, smart contract bugs, network congestion, and regulatory changes. You use SolMate at your own risk.
          </p>
        </section>

        <section className="glass-card rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-3">9. Disclaimer of Warranties</h2>
          <p className="text-neutral-300 leading-relaxed">
            SolMate is provided "as is" without warranties of any kind. We do not guarantee uninterrupted service, accuracy of blockchain data, or freedom from bugs or errors.
          </p>
        </section>

        <section className="glass-card rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-3">10. Limitation of Liability</h2>
          <p className="text-neutral-300 leading-relaxed">
            To the maximum extent permitted by law, SolMate and its creators shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the service.
          </p>
        </section>

        <section className="glass-card rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-3">11. Modifications</h2>
          <p className="text-neutral-300 leading-relaxed">
            We reserve the right to modify these terms at any time. Continued use of SolMate after changes constitutes acceptance of the new terms.
          </p>
        </section>

        <section className="glass-card rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-3">12. Contact</h2>
          <p className="text-neutral-300 leading-relaxed">
            For questions about these Terms of Service, please contact us through our GitHub repository.
          </p>
        </section>
      </div>
    </main>
  );
}
