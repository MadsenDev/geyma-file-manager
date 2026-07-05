import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";
import { iconButtonStyle } from "./common";

export function Nav() {
  const t = useTheme();
  const goBack = useStore((s) => s.goBack);
  const goForward = useStore((s) => s.goForward);
  const goUp = useStore((s) => s.goUp);
  const canBack = useStore((s) => s.canBack());
  const canForward = useStore((s) => s.canForward());
  const canUp = useStore((s) => s.canUp());

  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "0 4px" }}>
      <button onClick={goBack} disabled={!canBack} title="Back" className="gy-soft" style={{ ...iconButtonStyle(t), opacity: canBack ? 1 : 0.35, pointerEvents: canBack ? "auto" : "none" }}>
        <Icon d={ICONS.chevronLeft} size={15} />
      </button>
      <button onClick={goForward} disabled={!canForward} title="Forward" className="gy-soft" style={{ ...iconButtonStyle(t), opacity: canForward ? 1 : 0.35, pointerEvents: canForward ? "auto" : "none" }}>
        <Icon d={ICONS.chevronRight} size={15} />
      </button>
      <button onClick={goUp} disabled={!canUp} title="Up" className="gy-soft" style={{ ...iconButtonStyle(t), opacity: canUp ? 1 : 0.35, pointerEvents: canUp ? "auto" : "none" }}>
        <Icon d={ICONS.chevronUp} size={15} />
      </button>
    </div>
  );
}
