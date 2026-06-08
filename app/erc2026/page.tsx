import { useState } from "react";

const sections = [
  { id: "departure", icon: "🚌", label: "Тръгване",   time: "Петък, 13.06 — 01:30" },
  { id: "travel",    icon: "🛣️",  label: "Пътуване",  time: "~12 часа" },
  { id: "arrival",   icon: "📍",  label: "Пристигане", time: "Петък, 13.06 — ~14:00" },
  { id: "checkin",   icon: "🏨",  label: "Хотел",      time: "Петък, 13.06" },
  { id: "ses1",      icon: "1️⃣", label: "Сесия 1",    time: "Петък, 13.06 — вечер" },
  { id: "ses2",      icon: "2️⃣", label: "Сесия 2",    time: "Събота, 14.06 — сутрин" },
  { id: "ses3",      icon: "3️⃣", label: "Сесия 3",    time: "Събота, 14.06 — следобяд" },
  { id: "ses4",      icon: "4️⃣", label: "Сесия 4",    time: "Неделя, 15.06" },
  { id: "return",    icon: "🏠",  label: "Връщане",    time: "Неделя — Понеделник" },
];

const Timeline = () => {
  const [open, setOpen] = useState("departure");
  const toggle = (id) => setOpen(open === id ? null : id);

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
                fontFamily: "'Sora', sans-serif",
                fontWeight: 600,
                fontSize: "15px",
                color: open === s.id ? "#e65c00" : "#1a1a1a",
                letterSpacing: "-0.01em",
              }}>
                {s.label}
              </div>
              <div style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "12px",
                color: "#888",
                marginTop: "1px",
              }}>
                {s.time}
              </div>
            </div>
            <span style={{
              color: "#bbb",
              fontSize: "18px",
              transform: open === s.id ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.18s ease",
            }}>
              ▾
            </span>
          </button>

          {open === s.id && <SectionContent id={s.id} />}

          {i < sections.length - 1 && (
            <div style={{ height: "1px", background: "rgba(0,0,0,0.06)", margin: "0 16px" }} />
          )}
        </div>
      ))}
    </div>
  );
};

const MapButton = ({ label, url }) => (
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
      fontFamily: "'DM Sans', sans-serif",
      fontSize: "13px",
      fontWeight: 600,
      textDecoration: "none",
      letterSpacing: "0.01em",
    }}
  >
    <span>📍</span> {label}
  </a>
);

const InfoRow = ({ icon, label, value }) => (
  <div style={{
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "8px 0",
    borderBottom: "1px solid rgba(0,0,0,0.05)",
  }}>
    <span style={{ fontSize: "16px", marginTop: "1px" }}>{icon}</span>
    <div>
      <div style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: "11px",
        color: "#999",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        fontWeight: 600,
      }}>{label}</div>
      <div style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: "14px",
        color: "#1a1a1a",
        marginTop: "2px",
        lineHeight: "1.4",
      }}>{value}</div>
    </div>
  </div>
);

const BusBlock = ({ toVenue, fromVenue }) => (
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
      fontFamily: "'Sora', sans-serif",
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
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "11px", color: "#999", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
          Хотел → Oradea Arena
        </div>
        <div style={{ fontFamily: "'Sora', sans-serif", fontSize: "16px", fontWeight: 700, color: toVenue ? "#1a1a1a" : "#ccc" }}>
          {toVenue || "TBD"}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "11px", color: "#999", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
          Oradea Arena → Хотел
        </div>
        <div style={{ fontFamily: "'Sora', sans-serif", fontSize: "16px", fontWeight: 700, color: fromVenue ? "#1a1a1a" : "#ccc" }}>
          {fromVenue || "TBD"}
        </div>
      </div>
    </div>
  </div>
);

const Note = ({ children }) => (
  <div style={{
    background: "rgba(230,92,0,0.06)",
    borderLeft: "3px solid #e65c00",
    borderRadius: "0 8px 8px 0",
    padding: "10px 12px",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "13px",
    color: "#555",
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
    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "13px", color: "#888", textAlign: "center" }}>
      Програмата предстои да бъде уточнена.<br />Страницата ще бъде обновена.
    </div>
  </div>
);

const SectionContent = ({ id }) => {
  const inner = {
    padding: "4px 16px 20px 56px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  };

  if (id === "departure") return (
    <div style={inner}>
      <InfoRow icon="📅" label="Дата и час" value="Петък, 13 юни 2026 — 01:30 ч." />
      <InfoRow icon="🚌" label="Място на тръгване" value="бул. Янко Сакъзов 9, София Център, 1527 София" />
      <div style={{ marginTop: "8px" }}>
        <MapButton
          label="Отвори в Google Maps"
          url="https://maps.google.com/?q=бул.+Янко+Сакъзов+9,+1527+София"
        />
      </div>
      <Note>⏰ Моля, бъдете на място поне 15 минути преди тръгване. Автобусът тръгва точно в 01:30 ч.</Note>
    </div>
  );

  if (id === "travel") return (
    <div style={inner}>
      <InfoRow icon="🛣️" label="Маршрут" value="София → Ботевград → Видин → Калафат → Крайова → Орадя" />
      <InfoRow icon="⏱️" label="Прибл. продължителност" value="~12 часа" />
      <InfoRow icon="🌄" label="Прибл. пристигане" value="Петък, 13 юни — около 14:00 ч." />
      <Note>🇷🇴 Пресичаме границата при Видин–Калафат. Румъния е в Шенген — няма граничен контрол.</Note>
    </div>
  );

  if (id === "arrival") return (
    <div style={inner}>
      <InfoRow icon="🏙️" label="Зала" value="Oradea Arena" />
      <InfoRow icon="📍" label="Дестинация" value="Орадя, Румъния" />
      <InfoRow icon="🕑" label="Очаквано пристигане" value="~14:00 ч., петък 13 юни" />
      <div style={{ marginTop: "8px" }}>
        <MapButton label="Орадя в Google Maps" url="https://maps.google.com/?q=Oradea+Arena,+Oradea,+Romania" />
      </div>
    </div>
  );

  if (id === "checkin") return (
    <div style={inner}>
      <InfoRow icon="🏨" label="Хотел" value="Предстои уточнение" />
      <InfoRow icon="🚶" label="До Oradea Arena" value="~30 минути пеша" />
      <InfoRow icon="🛍️" label="До центъра на града" value="~30 минути пеша" />
      <InfoRow icon="🛒" label="Lidl / Kaufland" value="~10–15 минути пеша" />
      <Note>🧳 Оставете багажа, починете малко — вечерта предстои първата сесия.</Note>
    </div>
  );

  if (id === "ses1") return (
    <div style={inner}>
      <InfoRow icon="📅" label="Дата" value="Петък, 13 юни 2026" />
      <BusBlock toVenue="18:30 ч." fromVenue={null} />
      <Note>🔔 Автобусът тръгва точно в 18:30 ч. от хотела. Не закъснявайте!</Note>
    </div>
  );

  if (id === "ses2") return (
    <div style={inner}>
      <InfoRow icon="📅" label="Дата" value="Събота, 14 юни 2026" />
      <BusBlock toVenue={null} fromVenue={null} />
      <TBDBlock />
    </div>
  );

  if (id === "ses3") return (
    <div style={inner}>
      <InfoRow icon="📅" label="Дата" value="Събота, 14 юни 2026" />
      <BusBlock toVenue={null} fromVenue={null} />
      <TBDBlock />
    </div>
  );

  if (id === "ses4") return (
    <div style={inner}>
      <InfoRow icon="📅" label="Дата" value="Неделя, 15 юни 2026" />
      <BusBlock toVenue={null} fromVenue={null} />
      <Note>🕓 Имайте предвид, че отпътуваме от Орадя в 16:00 ч.</Note>
    </div>
  );

  if (id === "return") return (
    <div style={inner}>
      <InfoRow icon="🕓" label="Тръгване от Орадя" value="Неделя, 15 юни — 16:00 ч." />
      <InfoRow icon="🛣️" label="Маршрут" value="Орадя → Крайова → Калафат → Видин → Ботевград → София" />
      <InfoRow icon="🌙" label="Прибл. пристигане в София" value="Понеделник, 16 юни — ~04:00 ч." />
      <Note>😴 Очаква се дълго пътуване — пригответе се с вода, закуска и нещо за четене.</Note>
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
      { icon: "📅", label: "Дати",       value: "13–15 юни 2026" },
      { icon: "🏙️", label: "Зала",        value: "Oradea Arena" },
      { icon: "🚌", label: "Тръгване",   value: "13.06 / 01:30" },
      { icon: "🏠", label: "Завръщане",  value: "16.06 / ~04:00" },
    ].map((f) => (
      <div key={f.label} style={{
        background: "rgba(230,92,0,0.05)",
        border: "1px solid rgba(230,92,0,0.15)",
        borderRadius: "10px",
        padding: "12px",
      }}>
        <div style={{ fontSize: "18px", marginBottom: "4px" }}>{f.icon}</div>
        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "11px",
          color: "#999",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontWeight: 600,
        }}>{f.label}</div>
        <div style={{
          fontFamily: "'Sora', sans-serif",
          fontSize: "14px",
          fontWeight: 600,
          color: "#1a1a1a",
          marginTop: "2px",
        }}>{f.value}</div>
      </div>
    ))}
  </div>
);

export default function ERC2026() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      <div style={{
        minHeight: "100vh",
        background: "#fafaf9",
        fontFamily: "'DM Sans', sans-serif",
        maxWidth: "480px",
        margin: "0 auto",
      }}>
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
              fontFamily: "'Sora', sans-serif",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "4px 10px",
              borderRadius: "4px",
              marginBottom: "12px",
            }}>
              Team EnjoyVD
            </div>
            <h1 style={{
              fontFamily: "'Sora', sans-serif",
              fontSize: "36px",
              fontWeight: 800,
              color: "white",
              margin: "0 0 4px",
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}>
              ERC 2026
            </h1>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "15px", color: "rgba(255,255,255,0.75)", margin: "0 0 6px" }}>
              Орадя, Румъния
            </p>
            <p style={{ fontFamily: "'Sora', sans-serif", fontSize: "13px", color: "rgba(255,255,255,0.55)", margin: 0, fontWeight: 600, letterSpacing: "0.04em" }}>
              13 – 15 ЮНИ 2026
            </p>
          </div>
        </div>

        <div style={{ padding: "24px 0 0" }}>
          <div style={{ padding: "0 16px 12px", fontFamily: "'Sora', sans-serif", fontSize: "11px", fontWeight: 700, color: "#bbb", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Накратко
          </div>
          <QuickFacts />
        </div>

        <div style={{ height: "1px", background: "rgba(0,0,0,0.07)", margin: "0 16px 24px" }} />

        <div style={{ padding: "0 16px 12px", fontFamily: "'Sora', sans-serif", fontSize: "11px", fontWeight: 700, color: "#bbb", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Програма
        </div>

        <div style={{
          background: "white",
          borderRadius: "16px",
          margin: "0 12px",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
        }}>
          <Timeline />
        </div>

        <div style={{ padding: "32px 20px 48px", textAlign: "center" }}>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "12px", color: "#ccc" }}>
            Team EnjoyVD · ERC 2026 · Орадя
          </div>
        </div>
      </div>
    </>
  );
}
