"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
      <Link 
        href="/"
        className="inline-flex items-center gap-2 text-neutral-400 hover:text-white mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </Link>

      <h1 className="text-3xl sm:text-4xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-neutral-500 mb-8">Last updated: January 14, 2026</p>

      <div className="prose prose-invert prose-neutral max-w-none space-y-6">
        <section className="glass-card rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-3">1. Introduction</h2>
          <p className="text-neutral-300 leading-relaxed">
            SolMate ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our decentralized chess application on the Solana blockchain.
          </p>
        </section>

        <section className="glass-card rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-3">2. Information We Collect</h2>
          <p className="text-neutral-300 leading-relaxed mb-3">
            <strong className="text-white">Wallet Information:</strong> When you connect your Solana wallet, we can see your public wallet address. We never have access to your private keys or seed phrases.
          </p>
          <p className="text-neutral-300 leading-relaxed mb-3">
            <strong className="text-white">Game Data:</strong> We store game moves, match results, and stake amounts on-chain through our smart contract. This data is publicly visible on the Solana blockchain.
          </p>
          <p className="text-neutral-300 leading-relaxed">
            <strong className="text-white">Usage Data:</strong> We may collect anonymous usage statistics to improve our service, such as pages visited and features used.
          </p>
        </section>

        <section className="glass-card rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-3">3. How We Use Your Information</h2>
          <ul className="text-neutral-300 space-y-2 list-disc list-inside">
            <li>To facilitate chess matches and stake management</li>
            <li>To process SOL transactions through our escrow smart contract</li>
            <li>To match players based on skill level</li>
            <li>To improve and optimize our application</li>
          </ul>
        </section>

        <section className="glass-card rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-3">4. Blockchain Data</h2>
          <p className="text-neutral-300 leading-relaxed">
            All transactions on SolMate are recorded on the Solana blockchain. Blockchain data is immutable and publicly accessible. This includes stake deposits, game results, and payouts. By using SolMate, you acknowledge that this information will be permanently stored on-chain.
          </p>
        </section>

        <section className="glass-card rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-3">5. Third-Party Services</h2>
          <p className="text-neutral-300 leading-relaxed">
            We integrate with third-party wallet providers (Phantom, Solflare) for authentication. These services have their own privacy policies. We also use Solana RPC providers to interact with the blockchain.
          </p>
        </section>

        <section className="glass-card rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-3">6. Data Security</h2>
          <p className="text-neutral-300 leading-relaxed">
            We implement industry-standard security measures to protect your data. Our smart contract has been designed with security best practices. However, no system is 100% secure, and we cannot guarantee absolute security.
          </p>
        </section>

        <section className="glass-card rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-3">7. Your Rights</h2>
          <p className="text-neutral-300 leading-relaxed">
            You can disconnect your wallet at any time to stop using our service. Due to the nature of blockchain technology, on-chain data cannot be deleted. Off-chain data can be deleted upon request.
          </p>
        </section>

        <section className="glass-card rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-3">8. Contact Us</h2>
          <p className="text-neutral-300 leading-relaxed">
            If you have questions about this Privacy Policy, please contact us through our GitHub repository or support channels.
          </p>
        </section>
      </div>
    </main>
  );
}
