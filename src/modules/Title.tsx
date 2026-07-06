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

  const activeSet = activeSetId ? setDefs.find((s) => s.id === activeSetId) : null;
  const name = activeSet ? activeSet.name : trashView ? "Trash" : path === home ? "Home" : backend?.basename(path) || path;
  const kicker = activeSet
    ? activeSet.smart
      ? "Smart set · fills itself from rules"
      : "Working set · references, not copies"
    : trashView
      ? "Trash · items awaiting permanent removal"
      : path;
  const folders = entries.filter((e) => e.isDir).length;
  const files = entries.length - folders;

  return (
    <div onContextMenu={!activeSet && !trashView ? (event) => openLocationMenu(event, path) : undefined} style={{ padding: "10px 4px 6px" }}>
      {showPath && (
        <div style={{ fontFamily: t.mono, fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", color: t.inkFaint, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {kicker}
        </div>
      )}
      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{name}</div>
      {showSummary && (
        <div style={{ fontSize: 12, color: t.inkSoft, marginTop: 2 }}>
          {entries.length} item{entries.length === 1 ? "" : "s"}
          {folders > 0 && files > 0 ? ` · ${folders} folder${folders === 1 ? "" : "s"}, ${files} file${files === 1 ? "" : "s"}` : ""}
          {activeSet?.note ? ` · "${activeSet.note}"` : ""}
        </div>
      )}
    </div>
  );
}
