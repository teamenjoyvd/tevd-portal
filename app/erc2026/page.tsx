"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Sora } from "next/font/google";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

const TEAL = "#3E7785";
const TEAL_DARK = "#2a5560";
const TEAL_BG = "rgba(62,119,133,0.05)";
const TEAL_BORDER = "rgba(62,119,133,0.15)";
const TEAL_NOTE_BG = "rgba(62,119,133,0.06)";

const GATHERING_POINT_URL = "https://maps.google.com/?q=бул.+Янко+Сакъзов+9,+1527+София";
const GLORY_HOTEL_URL = "https://maps.google.com/?q=Strada+Meziadului+56,+410265+Oradea,+Romania";
const ORADEA_ARENA_URL = "https://maps.google.com/?q=Oradea+Arena,+Oradea,+Romania";

const sections = [
  { id: "departure", icon: "🚌", label: "Тръгване",  time: "Петък, 12.06 — 02:00" },
  { id: "ses1",      icon: "1️⃣", label: "Сесия 1",   time: "Петък, 12.06 — вечер" },
  { id: "ses2",      icon: "2️⃣", label: "Сесия 2",   time: "Събота, 13.06 — сутрин" },
  { id: "ses3",      icon: "3️⃣", label: "Сесия 3",   time: "Събота, 13.06 — следобяд" },
  { id: "ses4",      icon: "4️⃣", label: "Сесия 4",   time: "Неделя, 14.06" },
  { id: "return",    icon: "🏠", label: "Връщане",   time: "Неделя — Понеделник" },
];

const Timeline = () => {
  const [open, setOpen] = useState<string | null>("departure");
  const toggle = (id: string) => setOpen(open === id ? null : id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      {sections.map((s, i) => (
        <div key={s.id}>
          <button
            onClick={() => toggle(s.id)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "14px 16px",
              background: open === s.id ? TEAL_BG : "transparent",
              border: "none",
              borderLeft: open === s.id ? `3px solid ${TEAL}` : "3px solid transparent",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.18s ease",
            }}
          >
            <span style={{ fontSize: "20px", minWidth: "28px" }}>{s.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: "var(--font-sora)",
                fontWeight: 600,
                fontSize: "15px",
                color: open === s.id ? TEAL : "var(--text-primary)",
                letterSpacing: "-0.01em",
              }}>
                {s.label}
              </div>
              <div style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: "12px",
                color: "var(--text-tertiary)",
                marginTop: "1px",
              }}>
                {s.time}
              </div>
            </div>
            <span style={{
              color: "var(--text-tertiary)",
              fontSize: "18px",
              transform: open === s.id ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.18s ease",
            }}>
              ▾
            </span>
          </button>

          {open === s.id && <SectionContent id={s.id} />}

          {i < sections.length - 1 && (
            <div style={{ height: "1px", background: "var(--border-default)", margin: "0 16px" }} />
          )}
        </div>
      ))}
    </div>
  );
};

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: "12px",
    padding: "6px 0",
    borderBottom: "1px solid var(--border-default)",
  }}>
    <div style={{
      fontFamily: "var(--font-dm-sans)",
      fontSize: "12px",
      color: "var(--text-tertiary)",
      flexShrink: 0,
    }}>{label}</div>
    <div style={{
      fontFamily: "var(--font-dm-sans)",
      fontSize: "13px",
      color: "var(--text-primary)",
      textAlign: "right",
      lineHeight: "1.4",
    }}>{value}</div>
  </div>
);

const MapsButton = ({ url, label }: { url: string; label: string }) => (
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    style={{
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
    }}
  >
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
    {label}
  </a>
);

const BusBlock = ({
  toVenue,
  fromVenue,
  toLabel = "Хотел → Зала",
  fromLabel = "Зала → Хотел",
}: {
  toVenue: string | null;
  fromVenue: string | null;
  toLabel?: string;
  fromLabel?: string;
}) => (
  <div style={{
    background: TEAL_BG,
    border: `1px solid ${TEAL_BORDER}`,
    borderRadius: "10px",
    padding: "12px 14px",
    marginTop: "4px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  }}>
    <div style={{
      fontFamily: "var(--font-sora)",
      fontSize: "10px",
      fontWeight: 700,
      color: TEAL,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
    }}>
      Автобус
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ fontFamily: "var(--font-dm-sans)", fontSize: "11px", color: "var(--text-tertiary)", letterSpacing: "0.04em" }}>
          {toLabel}
        </div>
        <div style={{ fontFamily: "var(--font-sora)", fontSize: "18px", fontWeight: 700, color: toVenue ? "var(--text-primary)" : "var(--text-tertiary)", marginTop: "2px" }}>
          {toVenue ?? "TBD"}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: "var(--font-dm-sans)", fontSize: "11px", color: "var(--text-tertiary)", letterSpacing: "0.04em" }}>
          {fromLabel}
        </div>
        <div style={{ fontFamily: "var(--font-sora)", fontSize: "18px", fontWeight: 700, color: fromVenue ? "var(--text-primary)" : "var(--text-tertiary)", marginTop: "2px" }}>
          {fromVenue === null ? "TBD" : (fromVenue ?? "—")}
        </div>
      </div>
    </div>
  </div>
);

const Note = ({ children }: { children: ReactNode }) => (
  <div style={{
    background: TEAL_NOTE_BG,
    borderLeft: `3px solid ${TEAL}`,
    borderRadius: "0 8px 8px 0",
    padding: "9px 12px",
    fontFamily: "var(--font-dm-sans)",
    fontSize: "13px",
    color: "var(--text-secondary)",
    lineHeight: "1.5",
    marginTop: "8px",
  }}>
    {children}
  </div>
);

const SectionContent = ({ id }: { id: string }) => {
  const inner: CSSProperties = {
    padding: "4px 16px 20px 56px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  };

  if (id === "departure") return (
    <div style={inner}>
      <Note>⏰ Бъдете на място между 01:45 и 01:55. Автобусът тръгва точно в 02:00.</Note>
      <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "0px" }}>
        <InfoRow label="Дата" value="Петък, 12 юни 2026" />
        <InfoRow label="Час" value="02:00" />
        <InfoRow label="Пътуване" value="~12 часа" />
        <InfoRow label="Очаквано пристигане" value="~14:00 ч., Oradea Arena" />
      </div>
    </div>
  );

  if (id === "ses1") return (
    <div style={inner}>
      <BusBlock toVenue="18:30" fromVenue="22:00" />
    </div>
  );

  if (id === "ses2") return (
    <div style={inner}>
      <BusBlock toVenue="09:15" fromVenue="13:50" />
    </div>
  );

  if (id === "ses3") return (
    <div style={inner}>
      <BusBlock toVenue="16:00" fromVenue="20:20" />
    </div>
  );

  if (id === "ses4") return (
    <div style={inner}>
      <BusBlock
        toVenue="09:15"
        fromVenue="16:00"
        toLabel="Хотел → Зала"
        fromLabel="Зала → София"
      />
      <Note>След сесията автобусът не се връща до хотела!</Note>
    </div>
  );

  if (id === "return") return (
    <div style={inner}>
      <Note>Пристигаме обратно на бул. Янко Сакъзов 9 — същото място, от което тръгнахме.</Note>
      <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "0px" }}>
        <InfoRow label="Тръгване от Орадя" value="Неделя, 14 юни — 16:00" />
        <InfoRow label="Пристигане в София" value="Понеделник, 15 юни — ~04:00" />
      </div>
    </div>
  );

  return null;
};

// ─── Location card ────────────────────────────────────────────────────────────

const LocationCard = ({
  label,
  name,
  address,
  mapsUrl,
  meta,
}: {
  label: string;
  name: string;
  address: string;
  mapsUrl: string;
  meta?: ReactNode;
}) => (
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
      {label}
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
        {name}
      </div>
      <div style={{
        fontFamily: "var(--font-dm-sans)",
        fontSize: "12px",
        color: "var(--text-secondary)",
        marginTop: "3px",
        lineHeight: 1.4,
      }}>
        {address}
      </div>
    </div>

    <div>
      <MapsButton url={mapsUrl} label="Google Maps" />
    </div>

    {meta && (
      <div style={{
        borderTop: `1px solid ${TEAL_BORDER}`,
        paddingTop: "10px",
        marginTop: "2px",
        display: "flex",
        flexDirection: "column",
        gap: "0px",
      }}>
        {meta}
      </div>
    )}
  </div>
);

const DistanceRow = ({ label, value }: { label: string; value: string }) => (
  <div style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    padding: "4px 0",
    borderBottom: `1px solid ${TEAL_BORDER}`,
  }}>
    <div style={{ fontFamily: "var(--font-dm-sans)", fontSize: "12px", color: "var(--text-tertiary)" }}>{label}</div>
    <div style={{ fontFamily: "var(--font-dm-sans)", fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>{value}</div>
  </div>
);

// ─── Translation card ────────────────────────────────────────────────────────

const TranslationCard = () => (
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
          style={{
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
          }}
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
          style={{
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
          }}
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

const QuickFacts = () => (
  <div style={{
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "0 16px",
    marginBottom: "24px",
  }}>
    <LocationCard
      label="Събирателен пункт"
      name="бул. Янко Сакъзов 9"
      address="София Център, 1527 София"
      mapsUrl={GATHERING_POINT_URL}
      meta={
        <>
          <div style={{
            display: "block",
            width: "100%",
            background: "rgba(230,92,0,0.08)",
            border: "1px solid rgba(230,92,0,0.25)",
            borderRadius: "20px",
            padding: "4px 10px",
            fontFamily: "var(--font-dm-sans)",
            fontSize: "12px",
            fontWeight: 600,
            color: "#c94400",
            whiteSpace: "normal",
            overflowWrap: "anywhere",
          }}>
            Товарене на багаж 01:45–01:55 · Автобусът тръгва в 02:00.
          </div>
        </>
      }
    />

    <LocationCard
      label="Хотел"
      name="Glory Hotel"
      address="Strada Meziadului 56, 410265 Oradea"
      mapsUrl={GLORY_HOTEL_URL}
      meta={
        <>
          <DistanceRow label="До зала" value="~30 мин. пеша" />
          <DistanceRow label="До център" value="~30 мин. пеша" />
          <DistanceRow label="Лидл / Кауфланд" value="~10–15 мин. пеша" />
          <div style={{ fontFamily: "var(--font-dm-sans)", fontSize: "12px", color: "var(--text-tertiary)", paddingTop: "6px" }}>
            Закуската е включена · 07:30 - 10:00.
          </div>
        </>
      }
    />

    <LocationCard
      label="Зала"
      name="Oradea Arena"
      address="Str. Cantemir 2, 410100 Oradea"
      mapsUrl={ORADEA_ARENA_URL}
      meta={
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            padding: "4px 0",
            borderBottom: `1px solid ${TEAL_BORDER}`,
          }}>
            <div style={{ fontFamily: "var(--font-dm-sans)", fontSize: "12px", color: "var(--text-tertiary)" }}>WiFi</div>
            <div style={{ fontFamily: "var(--font-dm-sans)", fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 }}>ERC 2026</div>
          </div>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            padding: "4px 0",
          }}>
            <div style={{ fontFamily: "var(--font-dm-sans)", fontSize: "12px", color: "var(--text-tertiary)" }}>Парола</div>
            <div style={{ fontFamily: "var(--font-dm-sans)", fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600, userSelect: "all" }}>Oradea2026!</div>
          </div>
        </div>
      }
    />

    <TranslationCard />
  </div>
);

export default function ERC2026() {
  return (
    <div
      className={sora.variable}
      style={{
        minHeight: "100vh",
        background: "var(--bg-global)",
        fontFamily: "var(--font-dm-sans)",
        maxWidth: "480px",
        margin: "0 auto",
      }}
    >
      {/* Hero */}
      <div style={{
        background: `linear-gradient(135deg, ${TEAL} 0%, ${TEAL_DARK} 100%)`,
        padding: "40px 20px 32px",
      }}>
        <div style={{
          display: "inline-block",
          background: "rgba(0,0,0,0.25)",
          color: "white",
          fontFamily: "var(--font-sora)",
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          padding: "4px 10px",
          borderRadius: "4px",
          marginBottom: "12px",
        }}>
          Орадя, Румъния
        </div>
        <h1 style={{
          fontFamily: "var(--font-sora)",
          fontSize: "36px",
          fontWeight: 800,
          color: "white",
          margin: "0 0 4px",
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}>
          ERC 2026
        </h1>
        <p style={{ fontFamily: "var(--font-sora)", fontSize: "14px", color: "rgba(255,255,255,0.7)", margin: "0 0 2px", fontWeight: 600, letterSpacing: "0.04em" }}>
          12 – 14 ЮНИ 2026
        </p>
      </div>

      {/* Location cards + translation */}
      <div style={{ padding: "24px 0 0" }}>
        <QuickFacts />
      </div>

      <div style={{ height: "1px", background: "var(--border-default)", margin: "0 16px 24px" }} />

      {/* Schedule */}
      <div style={{ padding: "0 16px 12px", fontFamily: "var(--font-sora)", fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
        Програма
      </div>

      <div style={{
        background: "var(--bg-card)",
        borderRadius: "16px",
        margin: "0 12px",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
      }}>
        <Timeline />
      </div>

      <div style={{ padding: "32px 20px 48px", textAlign: "center" }}>
        <a
          href="https://www.teamenjoyvd.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontFamily: "var(--font-dm-sans)", fontSize: "12px", color: "var(--text-tertiary)", textDecoration: "none" }}
        >
          teamenjoyvd.com
        </a>
      </div>
    </div>
  );
}
