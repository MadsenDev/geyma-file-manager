interface IconProps {
  d: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

/** Stroke-drawn SVG icon in Geyma's house style: round caps/joins, 24x24 viewBox. */
export function Icon({ d, size = 16, color = "currentColor", strokeWidth = 1.8, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: "none", ...style }}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
