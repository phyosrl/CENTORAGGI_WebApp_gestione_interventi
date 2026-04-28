interface CentoraggiLogoProps {
  size?: number;
  className?: string;
}

/**
 * Logo Centoraggi: rosa dei venti stilizzata.
 * Anello verde, raggi radiali, 4 punte cardinali (NE/NW/SE/SW) bicolore arancio/blu
 * e ghiande/punte rosse interne. Versione SVG vettoriale leggera.
 */
export default function CentoraggiLogo({ size = 36, className = '' }: CentoraggiLogoProps) {
  // Colors
  const ring = '#1B7A3E';      // verde scuro
  const ringInner = '#1B7A3E';
  const spokeRed = '#D62828';
  const spokeGreen = '#1B7A3E';
  const spokeGray = '#9CA3AF';
  const arrowOrange = '#E07A1F';
  const arrowBlue = '#1E3A8A';
  const dartRed = '#D62828';

  // 16 spoke directions (every 22.5°). Alternating colors.
  const spokes = Array.from({ length: 16 }, (_, i) => {
    const angle = (i * 360) / 16;
    // Pattern: red, gray, green, gray repeating roughly
    const colors = [spokeRed, spokeGray, spokeGreen, spokeGray];
    return { angle, color: colors[i % colors.length] };
  });

  // 16 small red dart triangles around the inner ring pointing outward
  const darts = Array.from({ length: 16 }, (_, i) => (i * 360) / 16);

  // 4 large compass points at NE / NW / SE / SW (45°, 135°, 225°, 315°)
  const points = [45, 135, 225, 315];

  return (
    <svg
      viewBox="-50 -50 100 100"
      width={size}
      height={size}
      className={className}
      aria-label="Logo Centoraggi"
      role="img"
    >
      {/* Outer ring */}
      <circle cx="0" cy="0" r="46" fill="none" stroke={ring} strokeWidth="4" />

      {/* Spokes from center to outer ring */}
      {spokes.map((s, i) => (
        <line
          key={`spoke-${i}`}
          x1="0"
          y1="0"
          x2="0"
          y2="-44"
          stroke={s.color}
          strokeWidth="0.9"
          transform={`rotate(${s.angle})`}
        />
      ))}

      {/* Cross axes (gray, slightly thicker) */}
      <line x1="-44" y1="0" x2="44" y2="0" stroke={spokeGray} strokeWidth="1.2" />
      <line x1="0" y1="-44" x2="0" y2="44" stroke={spokeGray} strokeWidth="1.2" />

      {/* Middle ring */}
      <circle cx="0" cy="0" r="30" fill="none" stroke={spokeGray} strokeWidth="0.6" />

      {/* Red dart triangles around outer band, pointing inward from the ring */}
      {darts.map((angle, i) => (
        <polygon
          key={`dart-${i}`}
          points="0,-44 -3,-34 3,-34"
          fill={dartRed}
          transform={`rotate(${angle})`}
        />
      ))}

      {/* 4 large compass arrows (orange/blue split) */}
      {points.map((angle, i) => (
        <g key={`pt-${i}`} transform={`rotate(${angle})`}>
          {/* Orange half (left) */}
          <polygon points="0,-32 -6,-10 0,-14" fill={arrowOrange} />
          {/* Blue half (right) */}
          <polygon points="0,-32 6,-10 0,-14" fill={arrowBlue} />
        </g>
      ))}

      {/* Inner ring */}
      <circle cx="0" cy="0" r="10" fill="none" stroke={ringInner} strokeWidth="2.2" />

      {/* Center red dot */}
      <circle cx="0" cy="0" r="1.6" fill={dartRed} />
    </svg>
  );
}
