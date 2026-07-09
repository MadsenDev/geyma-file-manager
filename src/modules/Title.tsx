import { tr } from "@/i18n";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { openLocationMenu } from "../lib/contextMenus";
export function Title() {
  const t = useTheme();
  const path = useStore((s) => s.path);
  const home = useStore((s) => s.home);
  const backend = useStore((s) => s.backend);
  const trashView = useStore((s) => s.trashView);
  const activeSetId = useStore((s) => s.activeSetId);
  const setDefs = useStore((s) => s.setDefs);
  const entries = useStore((s) => s.visibleEntries());
  const showPath = useStore((s) => s.mcfg("title", "kicker", true));
  const showSummary = useStore((s) => s.mcfg("title", "summary", true));
  const activeSet = activeSetId
    ? setDefs.find((s) => s.id === activeSetId)
    : null;
  const name = activeSet
    ? activeSet.name
    : trashView
      ? tr("ui.title.trash")
      : path === home
        ? tr("ui.title.home")
        : backend?.basename(path) || path;
  const kicker = activeSet
    ? activeSet.smart
      ? tr("ui.title.smart_set_fills_itself_from_rules")
      : activeSet.rule
        ? tr("ui.title.hybrid_set_items_plus_rules")
        : tr("ui.title.working_set_references_not_copies")
    : trashView
      ? tr("ui.title.trash_items_awaiting_permanent_removal")
      : path;
  const folders = entries.filter((e) => e.isDir).length;
  const files = entries.length - folders;
  return (
    <div
      onContextMenu={
        !activeSet && !trashView
          ? (event) => openLocationMenu(event, path)
          : undefined
      }
      style={{
        padding: "10px 4px 6px",
      }}
    >
      {showPath && (
        <div
          style={{
            fontFamily: t.mono,
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: ".1em",
            color: t.inkFaint,
            marginBottom: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {kicker}
        </div>
      )}
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          lineHeight: 1.2,
        }}
      >
        {name}
      </div>
      {showSummary && (
        <div
          style={{
            fontSize: 12,
            color: t.inkSoft,
            marginTop: 2,
          }}
        >
          {tr("ui.title.items", { count: entries.length })}
          {folders > 0 && files > 0
            ? ` · ${tr("ui.title.folders_count", { count: folders })}, ${tr("ui.title.files_count", { count: files })}`
            : ""}
          {activeSet?.note
            ? tr("ui.title.note", {
                note: activeSet.note,
              })
            : ""}
        </div>
      )}
    </div>
  );
}
