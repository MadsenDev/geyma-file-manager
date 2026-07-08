import { tr } from "@/i18n";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { hexA } from "../theme/skins";
import { MODULE_NAMES } from "../state/layout";
import { MODULE_OPTIONS } from "../modules/options";
export function ModuleOptions() {
  const t = useTheme();
  const menu = useStore((state) => state.modMenu);
  const modCfg = useStore((state) => state.modCfg);
  const setModCfg = useStore((state) => state.setModCfg);
  const resetModCfg = useStore((state) => state.resetModCfg);
  const close = useStore((state) => state.closeModMenu);
  if (!menu) return null;
  const options = MODULE_OPTIONS[menu.id] || [];
  const height = 64 + options.length * 52 + (options.length ? 38 : 48);
  const x = Math.max(6, Math.min(menu.x, window.innerWidth - 246));
  const y = Math.max(6, Math.min(menu.y, window.innerHeight - height - 8));
  const valueFor = (key: string, defaultValue: string | number | boolean) =>
  modCfg[menu.id]?.[key] ?? defaultValue;
  return (
    <>
      <div
        onMouseDown={close}
        onContextMenu={(event) => {
          event.preventDefault();
          close();
        }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 128
        }} />
      
      <div
        role="dialog"
        aria-label={`${MODULE_NAMES[menu.id]} options`}
        className="gy-anim"
        style={{
          position: "fixed",
          left: x,
          top: y,
          zIndex: 130,
          width: 230,
          padding: 6,
          borderRadius: 12,
          background: t.card,
          border: `1px solid ${
          t.border}`,

          boxShadow: `0 16px 44px ${hexA("#000000", t.isDark ? 0.55 : 0.24)}`
        }}>
        
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "5px 7px 9px"
          }}>
          
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: t.ink
            }}>
            
            {MODULE_NAMES[menu.id]}
          </span>
          <span
            style={{
              fontFamily: t.mono,
              fontSize: 9.5,
              textTransform: "uppercase",
              letterSpacing: ".1em",
              color: t.inkFaint
            }}>
            
            {tr("ui.module_options.options")}
          </span>
        </div>

        {options.length === 0 &&
        <div
          style={{
            padding: "7px 8px 11px",
            fontSize: 12,
            color: t.inkFaint,
            lineHeight: 1.5
          }}>
          
            {tr(
            "ui.module_options.this_module_has_no_options_yet_you_can_still_mov"
          )}
          </div>
        }

        {options.map((option) => {
          const value = valueFor(option.key, option.defaultValue);
          if (option.type === "toggle") {
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setModCfg(menu.id, option.key, !value)}
                className="gy-soft"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  width: "100%",
                  border: 0,
                  background: "transparent",
                  padding: "8px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "inherit"
                }}>
                
                <span
                  style={{
                    fontSize: 12.5,
                    color: t.ink,
                    fontWeight: 500
                  }}>
                  
                  {option.label}
                </span>
                <span
                  style={{
                    width: 34,
                    height: 20,
                    borderRadius: 99,
                    background: value ? t.accent : hexA(t.ink, 0.18),
                    position: "relative",
                    flex: "none",
                    transition: "background .15s"
                  }}>
                  
                  <span
                    style={{
                      position: "absolute",
                      top: 2,
                      left: value ? 16 : 2,
                      width: 16,
                      height: 16,
                      borderRadius: 99,
                      background: "#fff",
                      transition: "left .15s",
                      boxShadow: "0 1px 3px rgba(0,0,0,.3)"
                    }} />
                  
                </span>
              </button>);

          }
          return (
            <div
              key={option.key}
              style={{
                padding: "6px 8px 4px"
              }}>
              
              <div
                style={{
                  fontSize: 11,
                  color: t.inkFaint,
                  marginBottom: 6,
                  fontWeight: 500
                }}>
                
                {option.label}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 3,
                  background: hexA(t.ink, t.isDark ? 0.14 : 0.06),
                  borderRadius: 8,
                  padding: 3
                }}>
                
                {option.options.map((choice) => {
                  const active = value === choice.value;
                  return (
                    <button
                      key={String(choice.value)}
                      type="button"
                      onClick={() =>
                      setModCfg(menu.id, option.key, choice.value)
                      }
                      style={{
                        flex: 1,
                        height: 26,
                        border: 0,
                        borderRadius: 6,
                        background: active ? t.card : "transparent",
                        color: active ? t.ink : t.inkSoft,
                        fontFamily: "inherit",
                        fontSize: 11.5,
                        fontWeight: active ? 700 : 500,
                        cursor: "pointer",
                        boxShadow: active ?
                        "0 1px 3px rgba(0,0,0,.12)" :
                        "none",
                        whiteSpace: "nowrap"
                      }}>
                      
                      {choice.label}
                    </button>);

                })}
              </div>
            </div>);

        })}

        {options.length > 0 &&
        <button
          type="button"
          onClick={() => resetModCfg(menu.id)}
          className="gy-soft"
          style={{
            marginTop: 6,
            width: "100%",
            border: 0,
            background: "transparent",
            padding: 7,
            borderRadius: 8,
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 11.5,
            fontWeight: 600,
            color: t.inkFaint
          }}>
          
            {tr("ui.module_options.reset_to_defaults")}
          </button>
        }
      </div>
    </>);

}