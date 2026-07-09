import { tr } from "@/i18n";
import { useState } from "react";
import { useStore } from "../state/store";
import { useTheme } from "../theme/ThemeContext";
import { Icon } from "../icons/Icon";
import { ICONS } from "../icons/paths";
import { chipStyle } from "./common";
import type { Filters } from "../state/types";
import { aiGenerate, extractJson } from "../ai/ollama";
import { explainError } from "../lib/explainError";
import { SetRuleModal } from "../overlays/SetRuleModal";
const KIND_CHIPS: {
  key: NonNullable<Filters["kind"]>;
  label: string;
}[] = [
{
  key: "document",
  label: tr("ui.search.docs")
},
{
  key: "image",
  label: tr("ui.search.images")
},
{
  key: "audio",
  label: tr("ui.search.audio")
},
{
  key: "code",
  label: tr("ui.search.code")
}];

const ALLOWED_KINDS = new Set(["document", "image", "audio", "code"]);
function buildSearchPrompt(text: string): string {
  return tr("ui.search.you_convert_a_users_natural_language_file_search", {
    text
  });
}
export function Search() {
  const t = useTheme();
  const query = useStore((s) => s.query);
  const setQuery = useStore((s) => s.setQuery);
  const searchScope = useStore((s) => s.searchScope);
  const setSearchScope = useStore((s) => s.setSearchScope);
  const filters = useStore((s) => s.filters);
  const toggleKindFilter = useStore((s) => s.toggleKindFilter);
  const toggleStarredFilter = useStore((s) => s.toggleStarredFilter);
  const aiSearchEnabled = useStore((s) => s.aiSearchEnabled);
  const aiRunning = useStore((s) => s.aiRunning);
  const aiSelectedModel = useStore((s) => s.aiSelectedModel);
  const applyAiSearch = useStore((s) => s.applyAiSearch);
  const showToast = useStore((s) => s.showToast);
  const createSmartSet = useStore((s) => s.createSmartSet);
  const path = useStore((s) => s.path);
  const home = useStore((s) => s.home);
  const [asking, setAsking] = useState(false);
  const [savingAsSet, setSavingAsSet] = useState(false);
  const active = !!query || filters.kind || filters.starred;
  const aiAvailable = aiSearchEnabled && aiRunning && !!aiSelectedModel;
  async function handleAskAi() {
    if (!query.trim() || asking) return;
    setAsking(true);
    try {
      const raw = await aiGenerate(aiSelectedModel, buildSearchPrompt(query));
      const parsed = extractJson<{
        query?: string;
        kind?: string | null;
        starred?: boolean;
      }>(raw);
      if (!parsed)
      throw new Error(tr("ui.search.could_not_understand_the_ais_response"));
      const kind = ALLOWED_KINDS.has(parsed.kind || "") ?
      parsed.kind as Filters["kind"] :
      null;
      applyAiSearch({
        query: parsed.query || "",
        kind,
        starred: !!parsed.starred
      });
    } catch (e) {
      showToast(tr("toast.ai_search_failed", { error: explainError(e) }));
    } finally {
      setAsking(false);
    }
  }
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 5,
        minWidth: 220
      }}>
      
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center"
        }}>
        
        <span
          style={{
            position: "absolute",
            left: 9,
            color: t.inkFaint,
            display: "flex"
          }}>
          
          <Icon d={ICONS.search} size={14} />
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && aiAvailable) handleAskAi();
          }}
          placeholder={
          aiAvailable ?
          tr("ui.search.placeholder_ai") :
          tr("ui.search.placeholder")
          }
          style={{
            width: "100%",
            height: 30,
            padding: "0 74px 0 30px",
            borderRadius: 9,
            border: `1px solid ${
            t.border}`,

            background: t.card,
            color: t.ink,
            fontSize: 12.5,
            fontFamily: "inherit"
          }} />
        
        <div
          style={{
            position: "absolute",
            right: 3,
            display: "flex",
            background: "transparent",
            borderRadius: 7,
            overflow: "hidden"
          }}>
          
          {(["folder", "all"] as const).map((s) =>
          <button
            key={s}
            onClick={() => setSearchScope(s)}
            style={{
              border: 0,
              padding: "4px 8px",
              fontSize: 9.5,
              fontFamily: t.mono,
              fontWeight: 700,
              textTransform: "uppercase",
              cursor: "pointer",
              background: searchScope === s ? t.accent : "transparent",
              color: searchScope === s ? "#fff" : t.inkFaint,
              borderRadius: 6
            }}>
            
              {s === "folder" ? tr("ui.search.here") : tr("ui.search.all")}
            </button>
          )}
        </div>
      </div>
      {active &&
      <div
        style={{
          display: "flex",
          gap: 5,
          overflowX: "auto",
          paddingBottom: 2
        }}>
        
          {KIND_CHIPS.map((c) =>
        <button
          key={c.key}
          onClick={() => toggleKindFilter(c.key)}
          style={chipStyle(t, filters.kind === c.key)}>
          
              {c.label}
            </button>
        )}
          <button
          onClick={toggleStarredFilter}
          style={chipStyle(t, filters.starred)}>
          
            {tr("ui.search.starred")}
          </button>
          {aiAvailable && query.trim() &&
        <button
          onClick={handleAskAi}
          disabled={asking}
          style={chipStyle(t, false)}>

              {asking ? tr("ui.search.asking_ai") : tr("ui.search.ask_ai")}
            </button>
        }
          <button onClick={() => setSavingAsSet(true)} style={chipStyle(t, false)}>
            {tr("ui.search.save_as_set")}
          </button>
        </div>
      }
      {savingAsSet &&
      <SetRuleModal
        title={tr("ui.search.save_as_set_title")}
        initialName={query.trim()}
        initialRule={{
          nameContains: query.trim() || undefined,
          kind: filters.kind || undefined,
          starred: filters.starred || undefined,
          roots: [searchScope === "all" ? home : path]
        }}
        confirmLabel={tr("common.create")}
        onClose={() => setSavingAsSet(false)}
        onConfirm={(name, rule) => {
          createSmartSet(name, rule);
          setSavingAsSet(false);
          showToast(tr("ui.search.saved_as_set", { name }));
        }} />
      }
    </div>);

}