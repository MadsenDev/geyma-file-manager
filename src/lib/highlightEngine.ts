// The actual highlight.js engine + language grammars. This module is heavy
// (~250 kB minified), so it must only ever be reached via the dynamic import in
// highlight.ts — a static import anywhere would pull it back into the initial
// bundle and slow first paint for a feature only used inside Quick Look.
import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import rust from "highlight.js/lib/languages/rust";
import python from "highlight.js/lib/languages/python";
import markdown from "highlight.js/lib/languages/markdown";
import yaml from "highlight.js/lib/languages/yaml";
import ini from "highlight.js/lib/languages/ini";
import diff from "highlight.js/lib/languages/diff";
import bash from "highlight.js/lib/languages/bash";

hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("python", python);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("ini", ini);
hljs.registerLanguage("diff", diff);
hljs.registerLanguage("bash", bash);

const LANG_BY_EXT: Record<string, string> = {
  TS: "typescript", TSX: "typescript",
  JS: "javascript", JSX: "javascript",
  JSON: "json",
  HTML: "xml", SVG: "xml", XML: "xml",
  CSS: "css",
  RS: "rust",
  PY: "python",
  MD: "markdown",
  YML: "yaml", YAML: "yaml",
  TOML: "ini",
  PATCH: "diff", DIFF: "diff",
  SH: "bash", BASH: "bash", FISH: "bash",
};

function langForExt(ext: string): string | null {
  return LANG_BY_EXT[ext] || null;
}

/** Highlight `code` for the given uppercase extension. Returns escaped HTML, or null if the language is unknown. */
export function highlightCode(code: string, ext: string): string | null {
  const lang = langForExt(ext);
  if (!lang) return null;
  try {
    return hljs.highlight(code, { language: lang }).value;
  } catch {
    return null;
  }
}
