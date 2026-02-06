"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const sectionStyle = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "16px",
  padding: "24px 28px",
  marginBottom: "12px",
  transition: "all 0.2s",
};

const h2Style = {
  fontSize: "16px",
  fontWeight: 700 as const,
  color: "#e8e8f0",
  marginBottom: "12px",
  marginTop: 0,
};

const pStyle = {
  fontSize: "14px",
  color: "#a0a0b8",
  lineHeight: 1.7,
  margin: 0,
};

const pSpacedStyle = {
  ...pStyle,
  marginBottom: "12px",
};

const strongStyle = {
  color: "#e8e8f0",
  fontWeight: 700 as const,
};

const purpleNum = {
  color: "#9945ff",
};

export default function PrivacyPage() {
  return (
    <main
      style={{
        background: "#07070e",
        minHeight: "100vh",
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "700px",
          margin: "0 auto",
          padding: "40px 20px 80px",
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            color: "#6b6b80",
            fontSize: "14px",
            fontWeight: 600,
            marginBottom: "32px",
            textDecoration: "none",
            transition: "color 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#e8e8f0")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#6b6b80")}
        >
          <ArrowLeft style={{ width: "16px", height: "16px" }} />
          Back to Home
        </Link>

        <h1
          style={{
            fontSize: "36px",
            fontWeight: 800,
            color: "#e8e8f0",
            letterSpacing: "-0.03em",
            marginBottom: "8px",
            marginTop: 0,
          }}
        >
          Privacy Policy
        </h1>
        <p
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: "12px",
            color: "#444",
            marginBottom: "40px",
            marginTop: 0,
          }}
        >
          Last updated: January 14, 2026
        </p>

        <div>
          <section
            style={sectionStyle}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
          >
            <h2 style={h2Style}>
              <span style={purpleNum}>1.</span> Introduction
            </h2>
            <p style={pStyle}>
              SolMate (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our decentralized chess application on the Solana blockchain.
            </p>
          </section>

          <section
            style={sectionStyle}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
          >
            <h2 style={h2Style}>
              <span style={purpleNum}>2.</span> Information We Collect
            </h2>
            <p style={pSpacedStyle}>
              <strong style={strongStyle}>Wallet Information:</strong> When you connect your Solana wallet, we can see your public wallet address. We never have access to your private keys or seed phrases.
            </p>
            <p style={pSpacedStyle}>
              <strong style={strongStyle}>Game Data:</strong> We store game moves, match results, and stake amounts on-chain through our smart contract. This data is publicly visible on the Solana blockchain.
            </p>
            <p style={pStyle}>
              <strong style={strongStyle}>Usage Data:</strong> We may collect anonymous usage statistics to improve our service, such as pages visited and features used.
            </p>
          </section>

          <section
            style={sectionStyle}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
          >
            <h2 style={h2Style}>
              <span style={purpleNum}>3.</span> How We Use Your Information
            </h2>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              <li style={{ padding: "8px 0", fontSize: "14px", color: "#a0a0b8", display: "flex", alignItems: "baseline", gap: "10px" }}>
                <span style={{ color: "#9945ff", flexShrink: 0 }}>•</span>
                To facilitate chess matches and stake management
              </li>
              <li style={{ padding: "8px 0", fontSize: "14px", color: "#a0a0b8", display: "flex", alignItems: "baseline", gap: "10px" }}>
                <span style={{ color: "#9945ff", flexShrink: 0 }}>•</span>
                To process SOL transactions through our escrow smart contract
              </li>
              <li style={{ padding: "8px 0", fontSize: "14px", color: "#a0a0b8", display: "flex", alignItems: "baseline", gap: "10px" }}>
                <span style={{ color: "#9945ff", flexShrink: 0 }}>•</span>
                To match players based on skill level
              </li>
              <li style={{ padding: "8px 0", fontSize: "14px", color: "#a0a0b8", display: "flex", alignItems: "baseline", gap: "10px" }}>
                <span style={{ color: "#9945ff", flexShrink: 0 }}>•</span>
                To improve and optimize our application
              </li>
            </ul>
          </section>

          <section
            style={sectionStyle}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
          >
            <h2 style={h2Style}>
              <span style={purpleNum}>4.</span> Blockchain Data
            </h2>
            <p style={pStyle}>
              All transactions on SolMate are recorded on the Solana blockchain. Blockchain data is immutable and publicly accessible. This includes stake deposits, game results, and payouts. By using SolMate, you acknowledge that this information will be permanently stored on-chain.
            </p>
          </section>

          <section
            style={sectionStyle}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
          >
            <h2 style={h2Style}>
              <span style={purpleNum}>5.</span> Third-Party Services
            </h2>
            <p style={pStyle}>
              We integrate with third-party wallet providers (Phantom, Solflare) for authentication. These services have their own privacy policies. We also use Solana RPC providers to interact with the blockchain.
            </p>
          </section>

          <section
            style={sectionStyle}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
          >
            <h2 style={h2Style}>
              <span style={purpleNum}>6.</span> Data Security
            </h2>
            <p style={pStyle}>
              We implement industry-standard security measures to protect your data. Our smart contract has been designed with security best practices. However, no system is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section
            style={sectionStyle}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
          >
            <h2 style={h2Style}>
              <span style={purpleNum}>7.</span> Your Rights
            </h2>
            <p style={pStyle}>
              You can disconnect your wallet at any time to stop using our service. Due to the nature of blockchain technology, on-chain data cannot be deleted. Off-chain data can be deleted upon request.
            </p>
          </section>

          <section
            style={sectionStyle}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
          >
            <h2 style={h2Style}>
              <span style={purpleNum}>8.</span> Contact Us
            </h2>
            <p style={pStyle}>
              If you have questions about this Privacy Policy, please contact us through our GitHub repository or support channels.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
