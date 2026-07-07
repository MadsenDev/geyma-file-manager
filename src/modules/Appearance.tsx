import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { ACCENTS, FONT_LABELS, hexA, SKIN_ORDER, SKINS, type FontKey } from "../theme/skins";
import { LAYOUT_PRESETS } from "../state/layout";
import { panelTitleStyle, ToggleRow } from "./common";

const TABS = [
  { id: "skins", label: "Skins" },
  { id: "style", label: "Style" },
  { id: "layout", label: "Layout" },
] as const;

export function Appearance() {
  const t = useTheme();
  const apTab = useStore((s) => s.apTab);
  const setApTab = useStore((s) => s.setApTab);

  return (
    <div>
      <div style={{ display: "flex", padding: "8px 10px 0" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setApTab(tab.id)}
            style={{
              flex: 1,
              padding: "7px 0",
              border: 0,
              borderBottom: `2px solid ${apTab === tab.id ? t.accent : "transparent"}`,
              background: "transparent",
              color: apTab === tab.id ? t.ink : t.inkFaint,
              fontWeight: apTab === tab.id ? 700 : 500,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div style={{ padding: 12 }}>
        {apTab === "skins" && <SkinsTab />}
        {apTab === "style" && <StyleTab />}
        {apTab === "layout" && <LayoutTab />}
      </div>
    </div>
  );
}

function SkinsTab() {
  const t = useTheme();
  const skin = useStore((s) => s.skin);
  const setSkin = useStore((s) => s.setSkin);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {SKIN_ORDER.map((id) => {
        const sk = SKINS[id];
        const active = skin === id;
        return (
          <button
            key={id}
            onClick={() => setSkin(id)}
            style={{
              textAlign: "left",
              border: `1.5px solid ${active ? sk.accent : t.border}`,
              borderRadius: 12,
              padding: 10,
              cursor: "pointer",
              background: sk.card,
              color: sk.ink,
            }}
          >
            <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: sk.bg, border: `1px solid ${sk.border}` }} />
              <span style={{ width: 14, height: 14, borderRadius: 4, background: sk.accent }} />
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{sk.name}</div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8.5, letterSpacing: ".08em", opacity: 0.6 }}>{sk.tag}</div>
          </button>
        );
      })}
    </div>
  );
}

function StyleTab() {
  const t = useTheme();
  const ov = useStore((s) => s.ov);
  const setOverride = useStore((s) => s.setOverride);
  const resetOverrides = useStore((s) => s.resetOverrides);
  const motion = useStore((s) => s.motion);
  const setMotion = useStore((s) => s.setMotion);
  const glow = useStore((s) => s.glow);
  const toggleGlow = useStore((s) => s.toggleGlow);
  const columns = useStore((s) => s.columns);
  const toggleColumn = useStore((s) => s.toggleColumn);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={panelTitleStyle(t)}>Accent</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "0 2px" }}>
          {ACCENTS.map((c) => (
            <button
              key={c}
              onClick={() => setOverride({ accent: c })}
              style={{
                width: 24,
                height: 24,
                borderRadius: 99,
                background: c,
                border: t.accent === c ? `2px solid ${t.ink}` : "2px solid transparent",
                cursor: "pointer",
              }}
            />
          ))}
        </div>
      </div>
      <div>
        <div style={panelTitleStyle(t)}>Font</div>
        <div style={{ display: "flex", gap: 4, background: hexA(t.ink, t.isDark ? 0.14 : 0.06), borderRadius: 8, padding: 3 }}>
          {FONT_LABELS.map((f) => (
            <button
              key={f.v}
              onClick={() => setOverride({ fontKey: f.v as FontKey })}
              style={{
                flex: 1,
                height: 28,
                border: 0,
                borderRadius: 6,
                background: t.fontKey === f.v ? t.card : "transparent",
                color: t.fontKey === f.v ? t.ink : t.inkSoft,
                fontWeight: t.fontKey === f.v ? 700 : 500,
                fontSize: 11.5,
                cursor: "pointer",
              }}
            >
              {f.l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div style={panelTitleStyle(t)}>Radius: {ov.radius ?? t.radius}px</div>
        <input
          type="range"
          min={0}
          max={20}
          value={ov.radius ?? t.radius}
          onChange={(e) => setOverride({ radius: Number(e.target.value) })}
          style={{ width: "100%", accentColor: t.accent }}
        />
      </div>
      <ToggleRow label="Icon monochrome" value={t.iconMono} onChange={(v) => setOverride({ iconMono: v })} t={t} />
      <ToggleRow label="Glow" value={glow} onChange={toggleGlow} t={t} />
      <div>
        <div style={panelTitleStyle(t)}>Motion</div>
        <div style={{ display: "flex", gap: 4, background: hexA(t.ink, t.isDark ? 0.14 : 0.06), borderRadius: 8, padding: 3 }}>
          {(["full", "subtle", "off"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMotion(m)}
              style={{ flex: 1, height: 28, border: 0, borderRadius: 6, background: motion === m ? t.card : "transparent", color: motion === m ? t.ink : t.inkSoft, fontWeight: motion === m ? 700 : 500, fontSize: 11.5, cursor: "pointer" }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div style={panelTitleStyle(t)}>List columns</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {["kind", "size", "modified"].map((c) => (
            <button
              key={c}
              onClick={() => toggleColumn(c)}
              style={{
                padding: "5px 10px",
                borderRadius: 99,
                border: `1px solid ${columns.includes(c) ? hexA(t.accent, 0.5) : t.border}`,
                background: columns.includes(c) ? hexA(t.accent, 0.14) : "transparent",
                color: columns.includes(c) ? t.accent : t.inkSoft,
                fontSize: 11,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <button onClick={resetOverrides} className="gy-soft" style={{ border: `1px solid ${t.border}`, background: "transparent", color: t.inkFaint, borderRadius: 8, padding: "7px", cursor: "pointer", fontSize: 11.5 }}>
        Reset style overrides
      </button>
    </div>
  );
}

function LayoutTab() {
  const t = useTheme();
  const applyPreset = useStore((s) => s.applyPreset);
  const resetLayout = useStore((s) => s.resetLayout);
  const centerSplit = useStore((s) => s.centerSplit);
  const toggleCenterSplit = useStore((s) => s.toggleCenterSplit);
  const editMode = useStore((s) => s.editMode);
  const toggleEditMode = useStore((s) => s.toggleEditMode);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={panelTitleStyle(t)}>Presets</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {LAYOUT_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.layout)}
              style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${t.border}`, background: "transparent", color: t.inkSoft, fontSize: 11.5, cursor: "pointer" }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
      <ToggleRow label="Split center pane" value={centerSplit} onChange={toggleCenterSplit} t={t} />
      <ToggleRow label="Edit layout mode" value={editMode} onChange={toggleEditMode} t={t} />
      <button onClick={resetLayout} className="gy-soft" style={{ border: `1px solid ${t.border}`, background: "transparent", color: t.inkFaint, borderRadius: 8, padding: "7px", cursor: "pointer", fontSize: 11.5 }}>
        Reset layout to default
      </button>
    </div>
  );
}
