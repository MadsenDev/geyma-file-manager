import { useTheme } from "../theme/ThemeContext";
import { hexA } from "../theme/skins";
import type { ModuleId } from "../state/layout";

interface Palette {
  faint: string;
  soft: string;
  accent: string;
  accentSoft: string;
}

const STROKE = { fill: "none", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Tiny wireframe sketch of what each module roughly looks like, drawn in theme colors.
 *  Shown on the edit-mode palette cards so hidden modules are recognizable before placing them. */
export function ModulePreview({ id }: { id: ModuleId }) {
  const t = useTheme();
  const c: Palette = {
    faint: hexA(t.ink, 0.16),
    soft: hexA(t.ink, 0.36),
    accent: t.accent,
    accentSoft: hexA(t.accent, 0.6),
  };
  return (
    <svg width="100%" viewBox="0 0 52 34" fill="none" aria-hidden="true" style={{ display: "block" }}>
      {sketch(id, c)}
    </svg>
  );
}

function sketch(id: ModuleId, c: Palette) {
  switch (id) {
    case "tabs":
      return (
        <>
          <rect x="3" y="11" width="14" height="9" rx="2.5" fill={c.accentSoft} />
          <rect x="19" y="11" width="14" height="9" rx="2.5" fill={c.faint} />
          <rect x="35" y="11" width="14" height="9" rx="2.5" fill={c.faint} />
          <rect x="3" y="21.5" width="46" height="1.5" rx="0.75" fill={c.faint} />
        </>
      );
    case "nav":
      return (
        <>
          <path d="M14 11l-6 6 6 6" stroke={c.soft} {...STROKE} />
          <path d="M22 11l6 6-6 6" stroke={c.faint} {...STROKE} />
          <path d="M40 23V12M36 15.5 40 12l4 3.5" stroke={c.accentSoft} {...STROKE} />
        </>
      );
    case "location":
      return (
        <>
          <rect x="3.75" y="12.5" width="44.5" height="9" rx="4.5" stroke={c.soft} {...STROKE} />
          <rect x="8" y="16" width="7" height="2" rx="1" fill={c.faint} />
          <path d="M18 15.2l1.8 1.8-1.8 1.8" stroke={c.faint} {...STROKE} />
          <rect x="23" y="16" width="7" height="2" rx="1" fill={c.faint} />
          <path d="M33 15.2l1.8 1.8-1.8 1.8" stroke={c.faint} {...STROKE} />
          <rect x="38" y="16" width="7" height="2" rx="1" fill={c.accentSoft} />
        </>
      );
    case "search":
      return (
        <>
          <rect x="3.75" y="12.5" width="44.5" height="9" rx="4.5" stroke={c.soft} {...STROKE} />
          <circle cx="10.5" cy="16.5" r="2.2" stroke={c.accent} {...STROKE} />
          <path d="M12.2 18.2l1.6 1.6" stroke={c.accent} {...STROKE} />
          <rect x="18" y="16" width="15" height="2" rx="1" fill={c.faint} />
        </>
      );
    case "viewswitch":
      return (
        <>
          <rect x="8" y="9" width="6.5" height="6.5" rx="1.5" fill={c.accentSoft} />
          <rect x="16.5" y="9" width="6.5" height="6.5" rx="1.5" fill={c.faint} />
          <rect x="8" y="17.5" width="6.5" height="6.5" rx="1.5" fill={c.faint} />
          <rect x="16.5" y="17.5" width="6.5" height="6.5" rx="1.5" fill={c.faint} />
          <rect x="30" y="10" width="14" height="2.2" rx="1.1" fill={c.soft} />
          <rect x="30" y="15.4" width="14" height="2.2" rx="1.1" fill={c.soft} />
          <rect x="30" y="20.8" width="14" height="2.2" rx="1.1" fill={c.soft} />
        </>
      );
    case "title":
      return (
        <>
          <rect x="6" y="11" width="24" height="4.5" rx="2" fill={c.soft} />
          <rect x="6" y="19" width="15" height="2.5" rx="1.25" fill={c.faint} />
        </>
      );
    case "files":
      return (
        <>
          {[4, 16, 28, 40].map((x, i) =>
            [6, 19].map((y, j) => (
              <rect key={`${x}-${y}`} x={x} y={y} width="9" height="9" rx="2" fill={i === 0 && j === 0 ? c.accentSoft : c.faint} />
            )),
          )}
        </>
      );
    case "files2":
      return (
        <>
          <rect x="25.25" y="4" width="1.5" height="26" rx="0.75" fill={c.faint} />
          {[5, 14].map((x) =>
            [7, 17].map((y) => <rect key={`l${x}-${y}`} x={x} y={y} width="7" height="7" rx="1.5" fill={c.faint} />),
          )}
          {[31, 40].map((x, i) =>
            [7, 17].map((y, j) => (
              <rect key={`r${x}-${y}`} x={x} y={y} width="7" height="7" rx="1.5" fill={i === 0 && j === 0 ? c.accentSoft : c.faint} />
            )),
          )}
        </>
      );
    case "details":
      return (
        <>
          <rect x="15" y="4" width="22" height="14" rx="2" fill={c.faint} />
          <rect x="17" y="22" width="18" height="2.5" rx="1.25" fill={c.soft} />
          <rect x="20" y="27" width="12" height="2" rx="1" fill={c.faint} />
        </>
      );
    case "settings":
      return (
        <>
          <circle cx="26" cy="17" r="5" stroke={c.soft} {...STROKE} />
          <path d="M26 8v3M26 23v3M17 17h3M32 17h3M19.6 10.6l2.1 2.1M30.3 21.3l2.1 2.1M32.4 10.6l-2.1 2.1M21.7 21.3l-2.1 2.1" stroke={c.soft} {...STROKE} />
        </>
      );
    case "places":
      return (
        <>
          {[
            [8, 26, true],
            [16, 32, false],
            [24, 20, false],
          ].map(([y, w, hot]) => (
            <g key={String(y)}>
              <circle cx="8" cy={Number(y) + 1.25} r="2" fill={hot ? c.accentSoft : c.faint} />
              <rect x="13" y={Number(y)} width={Number(w)} height="2.5" rx="1.25" fill={c.faint} />
            </g>
          ))}
        </>
      );
    case "devices":
      return (
        <>
          <rect x="6" y="7" width="26" height="2.5" rx="1.25" fill={c.soft} />
          <rect x="6" y="12" width="40" height="3" rx="1.5" fill={c.faint} />
          <rect x="6" y="12" width="26" height="3" rx="1.5" fill={c.accentSoft} />
          <rect x="6" y="20" width="18" height="2.5" rx="1.25" fill={c.soft} />
          <rect x="6" y="25" width="40" height="3" rx="1.5" fill={c.faint} />
          <rect x="6" y="25" width="11" height="3" rx="1.5" fill={c.accentSoft} />
        </>
      );
    case "network":
      return (
        <>
          <circle cx="26" cy="17" r="10" stroke={c.soft} {...STROKE} />
          <path d="M16.2 17h19.6" stroke={c.soft} {...STROKE} />
          <path d="M26 7c3.1 2.7 4.9 6.1 4.9 10s-1.8 7.3-4.9 10c-3.1-2.7-4.9-6.1-4.9-10s1.8-7.3 4.9-10z" stroke={c.soft} {...STROKE} />
        </>
      );
    case "sets":
      return (
        <>
          <rect x="6" y="5.5" width="28" height="6" rx="3" fill={c.accentSoft} />
          <rect x="10" y="14" width="28" height="6" rx="3" fill={c.faint} />
          <rect x="14" y="22.5" width="28" height="6" rx="3" fill={c.faint} />
        </>
      );
    case "disk":
      return (
        <>
          <circle cx="26" cy="17" r="9" stroke={c.faint} strokeWidth="4" fill="none" />
          <circle cx="26" cy="17" r="9" stroke={c.accent} strokeWidth="4" fill="none" strokeDasharray="22 100" strokeLinecap="round" transform="rotate(-90 26 17)" />
        </>
      );
    case "recent":
      return (
        <>
          {[
            [8, 30, true],
            [16, 24, false],
            [24, 34, false],
          ].map(([y, w, hot]) => (
            <g key={String(y)}>
              <circle cx="8" cy={Number(y) + 1.25} r="2" stroke={hot ? c.accent : c.soft} {...STROKE} />
              <rect x="13" y={Number(y)} width={Number(w)} height="2.5" rx="1.25" fill={c.faint} />
            </g>
          ))}
        </>
      );
    case "timeline":
      return (
        <>
          <rect x="9.25" y="4" width="1.5" height="26" rx="0.75" fill={c.faint} />
          {[
            [8, true],
            [17, false],
            [26, false],
          ].map(([y, hot]) => (
            <g key={String(y)}>
              <circle cx="10" cy={Number(y)} r="2.2" fill={hot ? c.accentSoft : c.soft} />
              <rect x="16" y={Number(y) - 1.25} width={hot ? 24 : 17} height="2.5" rx="1.25" fill={c.faint} />
            </g>
          ))}
        </>
      );
    case "dupes":
      return (
        <>
          <rect x="12" y="6" width="18" height="14" rx="2" stroke={c.soft} {...STROKE} />
          <rect x="21" y="13" width="18" height="14" rx="2" stroke={c.accent} {...STROKE} />
        </>
      );
    case "clock":
      return (
        <>
          <circle cx="26" cy="17" r="10" stroke={c.soft} {...STROKE} />
          <path d="M26 10.5V17l4.2 2.6" stroke={c.accent} {...STROKE} />
        </>
      );
    case "visualizer":
      return (
        <>
          <rect x="11" y="18" width="4" height="9" rx="1" fill={c.soft} />
          <rect x="18" y="10" width="4" height="17" rx="1" fill={c.accentSoft} />
          <rect x="25" y="14" width="4" height="13" rx="1" fill={c.soft} />
          <rect x="32" y="7" width="4" height="20" rx="1" fill={c.accentSoft} />
          <rect x="39" y="16" width="4" height="11" rx="1" fill={c.faint} />
        </>
      );
    case "mood":
      return (
        <>
          <circle cx="26" cy="17" r="10" stroke={c.soft} {...STROKE} />
          <path d="M22 14h.01M30 14h.01" stroke={c.soft} strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <path d="M21.5 20c1.2 1.5 2.7 2.3 4.5 2.3s3.3-.8 4.5-2.3" stroke={c.accent} {...STROKE} />
        </>
      );
    case "status":
      return (
        <>
          <rect x="3.75" y="13.75" width="44.5" height="7" rx="3.5" stroke={c.soft} {...STROKE} />
          <rect x="8" y="16.4" width="10" height="1.8" rx="0.9" fill={c.soft} />
          <rect x="21" y="16.4" width="7" height="1.8" rx="0.9" fill={c.faint} />
          <circle cx="44" cy="17.25" r="1.6" fill={c.accentSoft} />
        </>
      );
  }
}
