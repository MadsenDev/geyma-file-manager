import { tr } from "@/i18n";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { hexA } from "../theme/skins";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";
import { panelTitleStyle } from "./common";
export function Mood() {
  const t = useTheme();
  const path = useStore((s) => s.path);
  const entries = useStore((s) => s.entriesFor(path));
  const folders = entries.filter((e) => e.isDir).length;
  const looseFiles = entries.length - folders;
  const count = entries.length;
  let icon = ICONS.mood;
  let title = tr("ui.mood.content");
  let quip = tr("ui.mood.perfectly_fine_nothing_to_see_here");
  if (count === 0) {
    icon = ICONS.mood;
    title = tr("ui.mood.empty");
    quip = tr("ui.mood.a_blank_page_anything_could_happen_here");
  } else if (count > 24) {
    icon = ICONS.moodBusy;
    title = tr("ui.mood.bursting");
    quip = tr("ui.mood.this_folder_is_doing_a_lot_maybe_too_much");
  } else if (folders > 0 && looseFiles <= 2) {
    icon = ICONS.moodTidy;
    title = tr("ui.mood.organised");
    quip = tr("ui.mood.tidy_folders_barely_a_loose_file_impressive");
  }
  return (
    <div
      style={{
        padding: 12,
      }}
    >
      <div style={panelTitleStyle(t)}>{tr("ui.mood.folder_mood")}</div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 4px",
        }}
      >
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: hexA(t.accent, t.isDark ? 0.2 : 0.13),
            color: t.accent,
            display: "grid",
            placeItems: "center",
            flex: "none",
          }}
        >
          <Icon d={icon} size={20} />
        </span>
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 11,
              color: t.inkFaint,
            }}
          >
            {quip}
          </div>
        </div>
      </div>
    </div>
  );
}
