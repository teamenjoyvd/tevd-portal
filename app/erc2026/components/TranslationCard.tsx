import type { CSSProperties } from "react";

const TEAL = "#3E7785";
const TEAL_BG = "rgba(62,119,133,0.05)";
const TEAL_BORDER = "rgba(62,119,133,0.15)";

const BUTTON_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  padding: "6px 12px",
  border: `1px solid ${TEAL}`,
  borderRadius: "6px",
  color: TEAL,
  fontFamily: "var(--font-dm-sans)",
  fontSize: "12px",
  fontWeight: 600,
  textDecoration: "none",
  letterSpacing: "0.01em",
  background: "transparent",
};

export const TranslationCard = () => (
  <div style={{
    background: TEAL_BG,
    border: `1px solid ${TEAL_BORDER}`,
    borderRadius: "12px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  }}>
    <div style={{
      fontFamily: "var(--font-dm-sans)",
      fontSize: "10px",
      fontWeight: 700,
      color: TEAL,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
    }}>
      Симултанен превод
    </div>

    <div>
      <div style={{
        fontFamily: "var(--font-sora)",
        fontSize: "16px",
        fontWeight: 700,
        color: "var(--text-primary)",
        letterSpacing: "-0.01em",
        lineHeight: 1.2,
      }}>
        LiveVoice
      </div>
      <div style={{
        fontFamily: "var(--font-dm-sans)",
        fontSize: "12px",
        color: "var(--text-secondary)",
        marginTop: "3px",
        lineHeight: 1.4,
      }}>
        На всяка сесия ще има симултанен превод на български през приложението LiveVoice.
      </div>
      <div style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        background: "rgba(62,119,133,0.1)",
        borderRadius: "6px",
        padding: "6px 10px",
        marginTop: "8px",
        fontFamily: "var(--font-dm-sans)",
        fontSize: "12px",
      }}>
        <span style={{ color: "var(--text-tertiary)" }}>Код за достъп:</span>
        <strong style={{ fontFamily: "var(--font-sora)", color: TEAL, fontSize: "13px", fontWeight: 700, letterSpacing: "0.05em", userSelect: "all" }}>167818</strong>
      </div>
    </div>

    <div style={{
      borderTop: `1px solid ${TEAL_BORDER}`,
      paddingTop: "10px",
      marginTop: "2px",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    }}>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <a
          href="https://apps.apple.com/us/app/livevoice/id1457677556"
          target="_blank"
          rel="noopener noreferrer"
          style={BUTTON_STYLE}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
          </svg>
          App Store
        </a>
        <a
          href="https://play.google.com/store/apps/details?id=io.livevoice.client"
          target="_blank"
          rel="noopener noreferrer"
          style={BUTTON_STYLE}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 20.5v-17c0-.83.94-1.3 1.6-.8l14 8.5c.6.36.6 1.24 0 1.6l-14 8.5c-.66.5-1.6.03-1.6-.8z" />
          </svg>
          Google Play
        </a>
      </div>
      <a
        href="https://livevoice.io"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontFamily: "var(--font-dm-sans)",
          fontSize: "12px",
          color: TEAL,
          textDecoration: "none",
        }}
      >
        livevoice.io →
      </a>
    </div>
  </div>
);
