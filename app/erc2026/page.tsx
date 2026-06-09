"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Sora, DM_Sans } from "next/font/google";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600"],
  display: "swap",
});

const TEAL = "#3E7785";
const TEAL_BG = "rgba(62,119,133,0.05)";
const TEAL_BORDER = "rgba(62,119,133,0.15)";
const TEAL_NOTE_BG = "rgba(62,119,133,0.06)";

const sections = [
  { id: "departure", icon: "🚌", label: "Тръгване",  time: "Петък, 12.06 — 02:00" },
  { id: "checkin",   icon: "🏨", label: "Хотел",      time: "Петък, 12.06" },
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

const InfoRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <div style={{
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "8px 0",
    borderBottom: "1px solid var(--border-default)",
  }}>
    <span style={{ fontSize: "16px", marginTop: "1px" }}>{icon}</span>
    <div>
      <div style={{
        fontFamily: "var(--font-dm-sans)",
        fontSize: "11px",
        color: "var(--text-tertiary)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        fontWeight: 600,
      }}>{label}</div>
      <div style={{
        fontFamily: "var(--font-dm-sans)",
        fontSize: "14px",
        color: "var(--text-primary)",
        marginTop: "2px",
        lineHeight: "1.4",
      }}>{value}</div>
    </div>
  </div>
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
    marginTop: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  }}>
    <div style={{
      fontFamily: "var(--font-sora)",
      fontSize: "11px",
      fontWeight: 700,
      color: TEAL,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      marginBottom: "2px",
    }}>
      🚌 Автобус
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontFamily: "var(--font-dm-sans)", fontSize: "11px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
          {toLabel}
        </div>
        <div style={{ fontFamily: "var(--font-sora)", fontSize: "16px", fontWeight: 700, color: toVenue ? "var(--text-primary)" : "var(--text-tertiary)" }}>
          {toVenue ?? "TBD"}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: "var(--font-dm-sans)", fontSize: "11px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
          {fromLabel}
        </div>
        <div style={{ fontFamily: "var(--font-sora)", fontSize: "16px", fontWeight: 700, color: fromVenue ? "var(--text-primary)" : "var(--text-tertiary)" }}>
          {fromVenue ?? "—"}
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
    padding: "10px 12px",
    fontFamily: "var(--font-dm-sans)",
    fontSize: "13px",
    color: "var(--text-secondary)",
    lineHeight: "1.5",
    marginTop: "12px",
  }}>
    {children}
  </div>
);

const TBDBlock = () => (
  <div style={{
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    padding: "24px 0",
  }}>
    <span style={{ fontSize: "28px" }}>🗓️</span>
    <div style={{ fontFamily: "var(--font-dm-sans)", fontSize: "13px", color: "var(--text-tertiary)", textAlign: "center" }}>
      Програмата на сесията предстои уточнение.
    </div>
  </div>
);

const SectionContent = ({ id }: { id: string }) => {
  const inner: CSSProperties = {
    padding: "4px 16px 20px 56px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  };

  if (id === "departure") return (
    <div style={inner}>
      <Note>⏰ Моля, бъдете на място поне 15 минути преди тръгване. Автобусът тръгва точно в 02:00 ч.</Note>
      <InfoRow icon="📅" label="Дата и час" value="Петък, 12 юни 2026 — 02:00 ч." />
      <InfoRow icon="📍" label="Събирателен пункт" value="бул. Янко Сакъзов 9, София" />
      <InfoRow icon="⏱️" label="Прибл. пътуване" value="~12 часа" />
      <InfoRow icon="🌄" label="Очаквано пристигане" value="Орадя, ~14:00 ч." />
      <InfoRow icon="🏙️" label="Дестинация" value="Oradea Arena, Орадя, Румъния" />
    </div>
  );

  if (id === "checkin") return (
    <div style={inner}>
      <InfoRow icon="🏨" label="Хотел" value="Glory Hotel, Oradea" />
      <InfoRow icon="🚶" label="До Oradea Arena" value="~30 мин. пеша" />
      <InfoRow icon="🛍️" label="До центъра" value="~30 мин. пеша" />
      <InfoRow icon="🛒" label="Lidl / Kaufland" value="~10–15 мин. пеша" />
      <a
        href="https://maps.google.com/?q=Glory+Hotel+Oradea"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          marginTop: "8px",
          padding: "8px 14px",
          background: TEAL,
          color: "white",
          borderRadius: "8px",
          fontFamily: "var(--font-dm-sans)",
          fontSize: "13px",
          fontWeight: 600,
          textDecoration: "none",
          letterSpacing: "0.01em",
          alignSelf: "flex-start",
        }}
      >
        <span>📍</span> Glory Hotel в Google Maps
      </a>
      <Note>🧳 Настаняване, лека почивка и подготовка за вечерта — предстои първата сесия.</Note>
    </div>
  );

  if (id === "ses1") return (
    <div style={inner}>
      <BusBlock toVenue="18:30 ч." fromVenue="22:00 ч." />
      <Note>🔔 Автобусът тръгва точно в 18:30 ч. от хотела. Бъдете точни!</Note>
    </div>
  );

  if (id === "ses2") return (
    <div style={inner}>
      <BusBlock toVenue="09:15 ч." fromVenue="13:50 ч." />
      <TBDBlock />
    </div>
  );

  if (id === "ses3") return (
    <div style={inner}>
      <BusBlock toVenue="16:00 ч." fromVenue="18:30 ч." />
      <TBDBlock />
    </div>
  );

  if (id === "ses4") return (
    <div style={inner}>
      <BusBlock
        toVenue="09:15 ч."
        fromVenue={null}
        toLabel="Хотел → Зала"
        fromLabel="Зала → Събирателен пункт"
      />
      <Note>🕓 След сесията автобусът не се връща в хотела — отпътуваме директно от залата в 16:00 ч. Имайте багажа със себе!</Note>
    </div>
  );

  if (id === "return") return (
    <div style={inner}>
      <Note>📍 Пристигаме обратно на бул. Янко Сакъзов 9 — същото място, от което тръгнахме.</Note>
      <InfoRow icon="🕓" label="Тръгване от Орадя" value="Неделя, 14 юни — 16:00 ч." />
      <InfoRow icon="🌙" label="Прибл. пристигане в София" value="Понеделник, 15 юни — ~04:00 ч." />
      <Note>😴 Очаква ни вълнуващо пътуване — пригответе се с вода, закуска и нещо за четене.</Note>
    </div>
  );

  return null;
};

type QuickFact = { icon: string; label: string; value: string; url?: string; fullWidth?: boolean };

const QuickFacts = () => {
  const facts: QuickFact[] = [
    { icon: "📍", label: "Тръгване",   value: "бул. Янко Сакъзов 9",  url: "https://maps.google.com/?q=бул.+Янко+Сакъзов+9,+1527+София" },
    { icon: "📍", label: "Пристигане",  value: "бул. Янко Сакъзов 9",  url: "https://maps.google.com/?q=бул.+Янко+Сакъзов+9,+1527+София" },
    { icon: "🏨", label: "Хотел",      value: "Glory Hotel",             url: "https://maps.google.com/?q=Glory+Hotel+Oradea" },
    { icon: "🏙️", label: "Зала",       value: "Oradea Arena",            url: "https://maps.google.com/?q=Oradea+Arena,+Oradea,+Romania" },
    { icon: "🚌", label: "Събирателен пункт", value: "бул. Янко Сакъзов 9, 02:00 ч.", url: "https://maps.google.com/?q=бул.+Янко+Сакъзов+9,+1527+София", fullWidth: true },
  ];

  const baseCardStyle: CSSProperties = {
    background: TEAL_BG,
    border: `1px solid ${TEAL_BORDER}`,
    borderRadius: "10px",
    padding: "12px",
    textDecoration: "none",
    display: "block",
  };

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "10px",
      padding: "0 16px",
      marginBottom: "24px",
    }}>
      {facts.map((f) => {
        const style: CSSProperties = f.fullWidth
          ? { ...baseCardStyle, gridColumn: "1 / -1" }
          : baseCardStyle;

        const inner = (
          <>
            <div style={{ fontSize: "18px", marginBottom: "4px" }}>{f.icon}</div>
            <div style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "11px",
              color: "var(--text-tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: 600,
            }}>{f.label}</div>
            <div style={{
              fontFamily: "var(--font-sora)",
              fontSize: "14px",
              fontWeight: 600,
              color: f.url ? TEAL : "var(--text-primary)",
              marginTop: "2px",
            }}>{f.value}</div>
          </>
        );

        return f.url ? (
          <a key={f.label} href={f.url} target="_blank" rel="noopener noreferrer" style={style}>
            {inner}
          </a>
        ) : (
          <div key={f.label} style={style}>
            {inner}
          </div>
        );
      })}
    </div>
  );
};

export default function ERC2026() {
  return (
    <div
      className={`${sora.variable} ${dmSans.variable}`}
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
        background: `linear-gradient(135deg, ${TEAL} 0%, #2a5560 100%)`,
        padding: "40px 20px 32px",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "relative" }}>
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
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "13px", color: "rgba(255,255,255,0.5)", margin: 0, letterSpacing: "0.06em" }}>
            София ↔ Орадя
          </p>
        </div>
      </div>

      {/* Quick facts */}
      <div style={{ padding: "24px 0 0" }}>
        <QuickFacts />
      </div>

      <div style={{ height: "1px", background: "var(--border-default)", margin: "0 16px 24px" }} />

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
