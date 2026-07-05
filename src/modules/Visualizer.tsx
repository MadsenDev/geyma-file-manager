import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { hexA } from "../theme/skins";

export function Visualizer() {
  const t = useTheme();
  const mcfg = useStore((s) => s.mcfg);
  const bars = mcfg("visualizer", "bars", 18);

  return (
    <div style={{ padding: 12, display: "flex", alignItems: "flex-end", gap: 3, height: 56 }}>
      {Array.from({ length: bars as number }).map((_, i) => (
        <span
          key={i}
          style={{
            flex: 1,
            height: "100%",
            borderRadius: 3,
            background: hexA(t.accent, 0.7),
            transformOrigin: "bottom",
            animation: `gy-eq ${0.7 + (i % 5) * 0.12}s ease-in-out infinite`,
            animationDelay: `${(i % 7) * 0.07}s`,
          }}
        />
      ))}
    </div>
  );
}
