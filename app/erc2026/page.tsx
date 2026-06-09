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

const sections = [
  { id: "departure", icon: "🚌", label: "Тръгване",   time: "Петък, 12.06 — 02:00" },
  { id: "travel",    icon: "🛣️",  label: "Пътуване",  time: "~12 часа" },
  { id: "arrival",   icon: "📍",  label: "Пристигане", time: "Петък, 12.06 — ~14:00" },
  { id: "checkin",   icon: "🏨",  label: "Хотел",      time: "Петък, 12.06" },
  { id: "ses1",      icon: "1️⃣", label: "Сесия 1",    time: "Петък, 12.06 — вечер" },
  { id: "ses2",      icon: "2️⃣", label: "Сесия 2",    time: "Събота, 13.06 — сутрин" },
  { id: "ses3",      icon: "3️⃣", label: "Сесия 3",    time: "Събота, 13.06 — следобяд" },
  { id: "ses4",      icon: "4️⃣", label: "Сесия 4",    time: "Неделя, 14.06" },
  { id: "return",    icon: "🏠",  label: "Връщане",    time: "Неделя — Понеделник" },
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
              background: open === s.id ? "rgba(230,92,0,0.08)" : "transparent",
              border: "none",
              borderLeft: open === s.id ? "3px solid #e65c00" : "3px solid transparent",
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
                color: open === s.id ? "#e65c00" : "var(--text-primary)",
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

const MapButton = ({ label, url }: { label: string; url: string }) => (
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "8px 14px",
      background: "#e65c00",
      color: "white",
      borderRadius: "8px",
      fontFamily: "var(--font-dm-sans)",
      fontSize: "13px",
      fontWeight: 600,
      textDecoration: "none",
      letterSpacing: "0.01em",
    }}
  >
    <span>📍</span> {label}
  </a>
);

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

const BusBlock = ({ toVenue, fromVenue }: { toVenue: string | null; fromVenue: string | null }) => (
  <div style={{
    background: "rgba(230,92,0,0.05)",
    border: "1px solid rgba(230,92,0,0.15)",
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
      color: "#e65c00",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      marginBottom: "2px",
    }}>
      🚌 Автобус
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontFamily: "var(--font-dm-sans)", fontSize: "11px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
          Хотел → Зала
        </div>
        <div style={{ fontFamily: "var(--font-sora)", fontSize: "16px", fontWeight: 700, color: toVenue ? "var(--text-primary)" : "var(--text-tertiary)" }}>
          {toVenue ?? "TBD"}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: "var(--font-dm-sans)", fontSize: "11px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
          Зала → Хотел
        </div>
        <div style={{ fontFamily: "var(--font-sora)", fontSize: "16px", fontWeight: 700, color: fromVenue ? "var(--text-primary)" : "var(--text-tertiary)" }}>
          {fromVenue ?? "TBD"}
        </div>
      </div>
    </div>
  </div>
);

const Note = ({ children }: { children: ReactNode }) => (
  <div style={{
    background: "rgba(230,92,0,0.06)",
    borderLeft: "3px solid #e65c00",
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
    opacity: 0.5,
  }}>
    <span style={{ fontSize: "28px" }}>🗓️</span>
    <div style={{ fontFamily: "var(--font-dm-sans)", fontSize: "13px", color: "var(--text-tertiary)", textAlign: "center" }}>
      Програмата предстои да бъде уточнена.<br />Страницата ще бъде обновена.
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
      <InfoRow icon="🚌" label="Място на тръгване" value="бул. Янко Сакъзов 9, София Център, 1527 София" />
      <div style={{ marginTop: "8px" }}>
        <MapButton
          label="Отвори в Google Maps"
          url="https://maps.google.com/?q=бул.+Янко+Сакъзов+9,+1527+София"
        />
      </div>
    </div>
  );

  if (id === "travel") return (
    <div style={inner}>
      <InfoRow icon="⏱️" label="Прибл. продължителност" value="~12 часа" />
      <InfoRow icon="🌄" label="Прибл. пристигане" value="Петък, 12 юни 2026 — около 14:00 ч." />
    </div>
  );

  if (id === "arrival") return (
    <div style={inner}>
      <InfoRow icon="🏙️" label="Зала" value="Oradea Arena" />
      <InfoRow icon="📍" label="Дестинация" value="Орадя, Румъния" />
      <InfoRow icon="🕑" label="Очаквано пристигане" value="~14:00 ч., петък 12 юни 2026" />
      <div style={{ marginTop: "8px" }}>
        <MapButton label="Oradea Arena в Google Maps" url="https://maps.google.com/?q=Oradea+Arena,+Oradea,+Romania" />
      </div>
    </div>
  );

  if (id === "checkin") return (
    <div style={inner}>
      <InfoRow icon="🏨" label="Хотел" value="Предстои уточнение" />
      <InfoRow icon="🚶" label="До Oradea Arena" value="~30 минути пеша" />
      <InfoRow icon="🛍️" label="До центъра на града" value="~30 минути пеша" />
      <InfoRow icon="🛒" label="Lidl / Kaufland" value="~10–15 минути пеша" />
      <Note>🧳 Настаняване, лека почивка и подготовка за вечерта — предстои първата сесия.</Note>
    </div>
  );

  if (id === "ses1") return (
    <div style={inner}>
      <InfoRow icon="📅" label="Дата" value="Петък, 12 юни 2026" />
      <BusBlock toVenue="18:30 ч." fromVenue="22:00 ч." />
      <Note>🔔 Автобусът тръгва точно в 18:30 ч. от хотела. Бъдете точни!</Note>
    </div>
  );

  if (id === "ses2") return (
    <div style={inner}>
      <InfoRow icon="📅" label="Дата" value="Събота, 14 юни 2026" />
      <BusBlock toVenue="09:15 ч." fromVenue="13:50 ч." />
      <TBDBlock />
    </div>
  );

  if (id === "ses3") return (
    <div style={inner}>
      <InfoRow icon="📅" label="Дата" value="Събота, 14 юни 2026" />
      <BusBlock toVenue="16:00 ч." fromVenue="18:30 ч." />
      <TBDBlock />
    </div>
  );

  if (id === "ses4") return (
    <div style={inner}>
      <InfoRow icon="📅" label="Дата" value="Неделя, 15 юни 2026" />
      <BusBlock toVenue="9:15 ч." fromVenue="N/A" />
      <Note>🕓 Имайте предвид, че отпътуваме от Орадя в 16:00 ч.</Note>
    </div>
  );

  if (id === "return") return (
    <div style={inner}>
      <InfoRow icon="🕓" label="Тръгване от Орадя" value="Неделя, 14 юни — 16:00 ч." />
      <InfoRow icon="🌙" label="Прибл. пристигане в София" value="Понеделник, 15 юни — ~04:00 ч." />
      <Note>😴 Очаква ни вълнуващо пътуване — пригответе се с вода, закуска и нещо за четене.</Note>
    </div>
  );

  return null;
};

const QuickFacts = () => (
  <div style={{
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    padding: "0 16px",
    marginBottom: "24px",
  }}>
    {[
      { icon: "📅", label: "Дати",       value: "12–14 юни 2026" },
      { icon: "🏙️", label: "Зала",        value: "Oradea Arena" },
      { icon: "🚌", label: "Тръгване",   value: "12.06 / 02:00" },
      { icon: "🏠", label: "Връщане",  value: "15.06 / ~04:00" },
    ].map((f) => (
      <div key={f.label} style={{
        background: "rgba(230,92,0,0.05)",
        border: "1px solid rgba(230,92,0,0.15)",
        borderRadius: "10px",
        padding: "12px",
      }}>
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
          color: "var(--text-primary)",
          marginTop: "2px",
        }}>{f.value}</div>
      </div>
    ))}
  </div>
);

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
      <div style={{
        background: "linear-gradient(135deg, #e65c00 0%, #c94400 40%, #7a1e00 100%)",
        padding: "40px 20px 32px",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: "-40px", right: "-40px",
          width: "160px", height: "160px", borderRadius: "50%",
          background: "rgba(255,255,255,0.12)",
        }} />
        <div style={{
          position: "absolute", bottom: "-20px", left: "-20px",
          width: "80px", height: "80px", borderRadius: "50%",
          background: "rgba(255,255,255,0.07)",
        }} />
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
          <p style={{ fontFamily: "var(--font-sora)", fontSize: "14px", color: "rgba(255,255,255,0.55)", margin: 0, fontWeight: 600, letterSpacing: "0.04em" }}>
            12 – 14 ЮНИ 2026
          </p>
        </div>
      </div>

      <div style={{ padding: "24px 0 0" }}>
        <div style={{ padding: "0 16px 12px", fontFamily: "var(--font-sora)", fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Накратко
        </div>
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
        <div style={{ fontFamily: "var(--font-dm-sans)", fontSize: "12px", color: "var(--text-tertiary)" }}>
          teamenjoyvd.com
        </div>
      </div>
    </div>
  );
}
