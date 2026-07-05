import { useEffect, useState } from "react";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";

export function Clock() {
  const t = useTheme();
  const mcfg = useStore((s) => s.mcfg);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const h24 = mcfg("clock", "h24", false);
  const seconds = mcfg("clock", "seconds", false);
  const showDate = mcfg("clock", "date", true);
  const d = new Date(now);
  const time = d.toLocaleTimeString([], { hour12: !h24, hour: "2-digit", minute: "2-digit", second: seconds ? "2-digit" : undefined });

  return (
    <div style={{ padding: 14, textAlign: "center" }}>
      <div style={{ fontFamily: t.mono, fontSize: 26, fontWeight: 700, letterSpacing: ".02em" }}>{time}</div>
      {showDate && (
        <div style={{ fontSize: 11.5, color: t.inkFaint, marginTop: 4 }}>
          {d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
        </div>
      )}
    </div>
  );
}
