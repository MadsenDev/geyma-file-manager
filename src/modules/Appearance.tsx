import { tr } from "@/i18n";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import {
  ACCENTS,
  FONT_LABELS,
  hexA,
  SKIN_ORDER,
  SKINS,
  type FontKey } from
"../theme/skins";
import {
  LAYOUT_PRESETS,
  layoutSignature,
  mergeLayout,
  type Layout } from
"../state/layout";
import { panelTitleStyle, ToggleRow } from "./common";
const TABS = [
{
  id: "skins",
  label: tr("ui.appearance.skins")
},
{
  id: "style",
  label: tr("ui.appearance.style")
},
{
  id: "layout",
  label: tr("ui.appearance.layout")
}] as
const;
export function Appearance() {
  const t = useTheme();
  const apTab = useStore((s) => s.apTab);
  const setApTab = useStore((s) => s.setApTab);
  return (
    <div>
      <div
        style={{
          display: "flex",
          padding: "8px 10px 0"
        }}>
        
        {TABS.map((tab) =>
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
            cursor: "pointer"
          }}>
          
            {tab.label}
          </button>
        )}
      </div>
      <div
        style={{
          padding: 12
        }}>
        
        {apTab === "skins" && <SkinsTab />}
        {apTab === "style" && <StyleTab />}
        {apTab === "layout" && <LayoutTab />}
      </div>
    </div>);

}
function SkinsTab() {
  const t = useTheme();
  const skin = useStore((s) => s.skin);
  const setSkin = useStore((s) => s.setSkin);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8
      }}>
      
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
              color: sk.ink
            }}>
            
            <div
              style={{
                display: "flex",
                gap: 4,
                marginBottom: 6
              }}>
              
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  background: sk.bg,
                  border: `1px solid ${
                  sk.border}`

                }} />
              
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  background: sk.accent
                }} />
              
            </div>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 700
              }}>
              
              {sk.name}
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 8.5,
                letterSpacing: ".08em",
                opacity: 0.6
              }}>
              
              {sk.tag}
            </div>
          </button>);

      })}
    </div>);

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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14
      }}>
      
      <div>
        <div style={panelTitleStyle(t)}>{tr("ui.appearance.accent")}</div>
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            padding: "0 2px"
          }}>
          
          {ACCENTS.map((c) =>
          <button
            key={c}
            onClick={() =>
            setOverride({
              accent: c
            })
            }
            style={{
              width: 24,
              height: 24,
              borderRadius: 99,
              background: c,
              border:
              t.accent === c ? `2px solid ${

              t.ink}` :

              "2px solid transparent",
              cursor: "pointer"
            }} />

          )}
        </div>
      </div>
      <div>
        <div style={panelTitleStyle(t)}>{tr("ui.appearance.font")}</div>
        <div
          style={{
            display: "flex",
            gap: 4,
            background: hexA(t.ink, t.isDark ? 0.14 : 0.06),
            borderRadius: 8,
            padding: 3
          }}>
          
          {FONT_LABELS.map((f) =>
          <button
            key={f.v}
            onClick={() =>
            setOverride({
              fontKey: f.v as FontKey
            })
            }
            style={{
              flex: 1,
              height: 28,
              border: 0,
              borderRadius: 6,
              background: t.fontKey === f.v ? t.card : "transparent",
              color: t.fontKey === f.v ? t.ink : t.inkSoft,
              fontWeight: t.fontKey === f.v ? 700 : 500,
              fontSize: 11.5,
              cursor: "pointer"
            }}>
            
              {f.l}
            </button>
          )}
        </div>
      </div>
      <div>
        <div style={panelTitleStyle(t)}>
          {tr("ui.appearance.radius")}
          {ov.radius ?? t.radius}
          {"px"}
        </div>
        <input
          type="range"
          min={0}
          max={20}
          value={ov.radius ?? t.radius}
          onChange={(e) =>
          setOverride({
            radius: Number(e.target.value)
          })
          }
          style={{
            width: "100%",
            accentColor: t.accent
          }} />
        
      </div>
      <ToggleRow
        label={tr("ui.appearance.icon_monochrome")}
        value={t.iconMono}
        onChange={(v) =>
        setOverride({
          iconMono: v
        })
        }
        t={t} />
      
      <ToggleRow
        label={tr("ui.appearance.glow")}
        value={glow}
        onChange={toggleGlow}
        t={t} />
      
      <div>
        <div style={panelTitleStyle(t)}>{tr("ui.appearance.motion")}</div>
        <div
          style={{
            display: "flex",
            gap: 4,
            background: hexA(t.ink, t.isDark ? 0.14 : 0.06),
            borderRadius: 8,
            padding: 3
          }}>
          
          {(["full", "subtle", "off"] as const).map((m) =>
          <button
            key={m}
            onClick={() => setMotion(m)}
            style={{
              flex: 1,
              height: 28,
              border: 0,
              borderRadius: 6,
              background: motion === m ? t.card : "transparent",
              color: motion === m ? t.ink : t.inkSoft,
              fontWeight: motion === m ? 700 : 500,
              fontSize: 11.5,
              cursor: "pointer"
            }}>
            
              {m}
            </button>
          )}
        </div>
      </div>
      <div>
        <div style={panelTitleStyle(t)}>{tr("ui.appearance.list_columns")}</div>
        <div
          style={{
            display: "flex",
            gap: 5,
            flexWrap: "wrap"
          }}>
          
          {["kind", "size", "modified"].map((c) =>
          <button
            key={c}
            onClick={() => toggleColumn(c)}
            style={{
              padding: "5px 10px",
              borderRadius: 99,
              border: `1px solid ${columns.includes(c) ? hexA(t.accent, 0.5) : t.border}`,
              background: columns.includes(c) ?
              hexA(t.accent, 0.14) :
              "transparent",
              color: columns.includes(c) ? t.accent : t.inkSoft,
              fontSize: 11,
              cursor: "pointer",
              textTransform: "capitalize"
            }}>
            
              {c}
            </button>
          )}
        </div>
      </div>
      <button
        onClick={resetOverrides}
        className="gy-soft"
        style={{
          border: `1px solid ${
          t.border}`,

          background: "transparent",
          color: t.inkFaint,
          borderRadius: 8,
          padding: "7px",
          cursor: "pointer",
          fontSize: 11.5
        }}>
        
        {tr("ui.appearance.reset_style_overrides")}
      </button>
    </div>);

}
function PresetThumb({ layout }: {layout: Layout;}) {
  const t = useTheme();
  const has = (z: keyof Layout) => layout[z].length > 0;
  const soft = hexA(t.ink, t.isDark ? 0.18 : 0.13);
  const acc = hexA(t.accent, t.isDark ? 0.5 : 0.4);
  return (
    <div
      style={{
        width: "100%",
        height: 52,
        display: "flex",
        flexDirection: "column",
        gap: 3,
        padding: 4,
        boxSizing: "border-box",
        background: t.bg,
        border: `1px solid ${
        t.border}`,

        borderRadius: 6
      }}>
      
      {has("top") &&
      <div
        style={{
          height: 8,
          flex: "none",
          background: soft,
          borderRadius: 2
        }} />

      }
      <div
        style={{
          flex: 1,
          display: "flex",
          gap: 3,
          minHeight: 0
        }}>
        
        {has("left") &&
        <div
          style={{
            width: "22%",
            background: soft,
            borderRadius: 2
          }} />

        }
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 3
          }}>
          
          <div
            style={{
              flex: 1,
              background: acc,
              borderRadius: 2
            }} />
          
          {has("center2") &&
          <div
            style={{
              flex: 1,
              background: acc,
              borderRadius: 2
            }} />

          }
        </div>
        {has("right") &&
        <div
          style={{
            width: "26%",
            background: soft,
            borderRadius: 2
          }} />

        }
      </div>
      {has("bottom") &&
      <div
        style={{
          height: 7,
          flex: "none",
          background: soft,
          borderRadius: 2
        }} />

      }
    </div>);

}
function LayoutTab() {
  const t = useTheme();
  const layout = useStore((s) => s.layout);
  const applyPreset = useStore((s) => s.applyPreset);
  const resetLayout = useStore((s) => s.resetLayout);
  const centerSplit = useStore((s) => s.centerSplit);
  const toggleCenterSplit = useStore((s) => s.toggleCenterSplit);
  const editMode = useStore((s) => s.editMode);
  const toggleEditMode = useStore((s) => s.toggleEditMode);
  const curSig = layoutSignature(layout);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14
      }}>
      
      <div>
        <div style={panelTitleStyle(t)}>{tr("ui.appearance.presets")}</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8
          }}>
          
          {LAYOUT_PRESETS.map((p) => {
            const merged = mergeLayout(p.layout);
            const active = layoutSignature(merged) === curSig;
            return (
              <button
                key={p.id}
                onClick={() => applyPreset(p.layout)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 7,
                  padding: 7,
                  borderRadius: 12,
                  border: `1.5px solid ${active ? t.accent : t.border}`,
                  background: active ? hexA(t.accent, 0.14) : "transparent",
                  cursor: "pointer"
                }}>
                
                <PresetThumb layout={merged} />
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: active ? 700 : 600,
                    color: active ? t.accent : t.inkSoft,
                    textAlign: "left",
                    paddingLeft: 2
                  }}>
                  
                  {p.name}
                </span>
              </button>);

          })}
        </div>
      </div>
      <ToggleRow
        label={tr("ui.appearance.split_center_pane")}
        value={centerSplit}
        onChange={toggleCenterSplit}
        t={t} />
      
      <ToggleRow
        label={tr("ui.appearance.edit_layout_mode")}
        value={editMode}
        onChange={toggleEditMode}
        t={t} />
      
      <button
        onClick={resetLayout}
        className="gy-soft"
        style={{
          border: `1px solid ${
          t.border}`,

          background: "transparent",
          color: t.inkFaint,
          borderRadius: 8,
          padding: "7px",
          cursor: "pointer",
          fontSize: 11.5
        }}>
        
        {tr("ui.appearance.reset_layout_to_default")}
      </button>
    </div>);

}