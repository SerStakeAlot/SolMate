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

const liStyle = {
  padding: "8px 0",
  fontSize: "14px",
  color: "#a0a0b8",
  display: "flex" as const,
  alignItems: "baseline" as const,
  gap: "10px",
};

const bulletStyle = {
  color: "#9945ff",
  flexShrink: 0,
};

export default function TermsPage() {
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
          Terms of Service
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
              <span style={purpleNum}>1.</span> Acceptance of Terms
            </h2>
            <p style={pStyle}>
              By accessing or using SolMate, you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the application.
            </p>
          </section>

          <section
            style={sectionStyle}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
          >
            <h2 style={h2Style}>
              <span style={purpleNum}>2.</span> Description of Service
            </h2>
            <p style={pStyle}>
              SolMate is a decentralized chess application that allows users to play staked matches using SOL cryptocurrency on the Solana blockchain. Users can stake SOL, compete in chess matches, and winners receive payouts automatically through our smart contract.
            </p>
          </section>

          <section
            style={sectionStyle}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
          >
            <h2 style={h2Style}>
              <span style={purpleNum}>3.</span> Eligibility
            </h2>
            <p style={pStyle}>
              You must be at least 18 years old to use SolMate. By using this service, you represent that you are of legal age in your jurisdiction and that online gaming and cryptocurrency transactions are legal in your location.
            </p>
          </section>

          <section
            style={sectionStyle}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
          >
            <h2 style={h2Style}>
              <span style={purpleNum}>4.</span> Wallet & Cryptocurrency
            </h2>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              <li style={liStyle}>
                <span style={bulletStyle}>•</span>
                You are responsible for maintaining the security of your wallet
              </li>
              <li style={liStyle}>
                <span style={bulletStyle}>•</span>
                We never have access to your private keys
              </li>
              <li style={liStyle}>
                <span style={bulletStyle}>•</span>
                All transactions are final and irreversible on the blockchain
              </li>
              <li style={liStyle}>
                <span style={bulletStyle}>•</span>
                You are responsible for ensuring sufficient SOL balance for stakes and transaction fees
              </li>
            </ul>
          </section>

          <section
            style={sectionStyle}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
          >
            <h2 style={h2Style}>
              <span style={purpleNum}>5.</span> Staking & Payouts
            </h2>
            <p style={pSpacedStyle}>
              <strong style={strongStyle}>Stakes:</strong> Players stake SOL to participate in matches. Available stake tiers are 0.05, 0.1, 0.5 and 1 SOL.
            </p>
            <p style={pSpacedStyle}>
              <strong style={strongStyle}>Payouts:</strong> Winners receive 90% of the total stake pool. A 10% fee is retained for platform maintenance.
            </p>
            <p style={pStyle}>
              <strong style={strongStyle}>Escrow:</strong> All stakes are held in a secure smart contract until match completion.
            </p>
          </section>

          <section
            style={sectionStyle}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
          >
            <h2 style={h2Style}>
              <span style={purpleNum}>6.</span> Game Rules
            </h2>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              <li style={liStyle}>
                <span style={bulletStyle}>•</span>
                Standard chess rules apply
              </li>
              <li style={liStyle}>
                <span style={bulletStyle}>•</span>
                Matches have a 10-minute timer per player
              </li>
              <li style={liStyle}>
                <span style={bulletStyle}>•</span>
                Running out of time results in a loss
              </li>
              <li style={liStyle}>
                <span style={bulletStyle}>•</span>
                Disconnection or abandonment may result in forfeiture
              </li>
              <li style={liStyle}>
                <span style={bulletStyle}>•</span>
                Cheating or use of chess engines is prohibited
              </li>
            </ul>
          </section>

          <section
            style={sectionStyle}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
          >
            <h2 style={h2Style}>
              <span style={purpleNum}>7.</span> Prohibited Conduct
            </h2>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              <li style={liStyle}>
                <span style={bulletStyle}>•</span>
                Using chess engines or AI assistance during matches
              </li>
              <li style={liStyle}>
                <span style={bulletStyle}>•</span>
                Manipulating or exploiting the smart contract
              </li>
              <li style={liStyle}>
                <span style={bulletStyle}>•</span>
                Colluding with other players
              </li>
              <li style={liStyle}>
                <span style={bulletStyle}>•</span>
                Creating multiple accounts to manipulate matchmaking
              </li>
              <li style={liStyle}>
                <span style={bulletStyle}>•</span>
                Any activity that violates applicable laws
              </li>
            </ul>
          </section>

          <section
            style={sectionStyle}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
          >
            <h2 style={h2Style}>
              <span style={purpleNum}>8.</span> Risks
            </h2>
            <p style={pStyle}>
              You acknowledge that using cryptocurrency and blockchain applications involves risks including but not limited to: price volatility, smart contract bugs, network congestion, and regulatory changes. You use SolMate at your own risk.
            </p>
          </section>

          <section
            style={sectionStyle}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
          >
            <h2 style={h2Style}>
              <span style={purpleNum}>9.</span> Disclaimer of Warranties
            </h2>
            <p style={pStyle}>
              SolMate is provided &ldquo;as is&rdquo; without warranties of any kind. We do not guarantee uninterrupted service, accuracy of blockchain data, or freedom from bugs or errors.
            </p>
          </section>

          <section
            style={sectionStyle}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
          >
            <h2 style={h2Style}>
              <span style={purpleNum}>10.</span> Limitation of Liability
            </h2>
            <p style={pStyle}>
              To the maximum extent permitted by law, SolMate and its creators shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the service.
            </p>
          </section>

          <section
            style={sectionStyle}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
          >
            <h2 style={h2Style}>
              <span style={purpleNum}>11.</span> Modifications
            </h2>
            <p style={pStyle}>
              We reserve the right to modify these terms at any time. Continued use of SolMate after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section
            style={sectionStyle}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
          >
            <h2 style={h2Style}>
              <span style={purpleNum}>12.</span> Contact
            </h2>
            <p style={pStyle}>
              For questions about these Terms of Service, please contact us through our GitHub repository.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
