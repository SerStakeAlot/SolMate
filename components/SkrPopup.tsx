"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { X } from "lucide-react";

// Popup expiry date — remove this component after March 6, 2026
const POPUP_EXPIRY = new Date("2026-03-06T23:59:59Z").getTime();
const STORAGE_KEY = "skr_popup_dismissed";

export default function SkrPopup() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Don't show if past expiry date
    if (Date.now() > POPUP_EXPIRY) return;

    // Don't show if user already dismissed
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) return;

    // Small delay so the homepage loads first
    const timer = setTimeout(() => setShow(true), 600);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  if (!show) return null;

  return (
    <div
      onClick={dismiss}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(8px)",
        animation: "skrFadeIn 0.3s ease-out",
        cursor: "pointer",
      }}
    >
      <style>{`
        @keyframes skrFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes skrSlideUp {
          from { opacity: 0; transform: scale(0.92) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          maxWidth: 420,
          width: "90vw",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow:
            "0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(153,69,255,0.15), 0 0 120px rgba(0,255,163,0.08)",
          border: "1px solid rgba(255,255,255,0.1)",
          animation: "skrSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Close button */}
        <button
          onClick={dismiss}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 10,
            background: "rgba(0,0,0,0.6)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "50%",
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.2s ease",
            color: "#fff",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.15)";
            e.currentTarget.style.transform = "scale(1.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(0,0,0,0.6)";
            e.currentTarget.style.transform = "scale(1)";
          }}
          aria-label="Close popup"
        >
          <X size={18} />
        </button>

        {/* SKR Image */}
        <Image
          src="/skr-image.jpg"
          alt="$SKR Meets the Board — High-stakes $SKR wagering is now fully integrated on Sol Mate"
          width={420}
          height={747}
          style={{
            width: "100%",
            height: "auto",
            display: "block",
          }}
          priority
        />
      </div>
    </div>
  );
}
