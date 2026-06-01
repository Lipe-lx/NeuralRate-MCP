import React from 'react';

type Factor = {
  name: string;
  score: number;
  max: number;
};

type SpiderChartProps = {
  factors: Factor[];
  size?: number;
};

const SpiderChart: React.FC<SpiderChartProps> = ({ factors, size = 240 }) => {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.36;
  const labelOffset = radius + 24;
  const numAxes = factors.length || 6;

  const getPoint = (index: number, r: number): [number, number] => {
    const angle = (Math.PI * 2 * index) / numAxes - Math.PI / 2;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };

  const getHexPath = (r: number): string => {
    const points = Array.from({ length: numAxes }, (_, i) => getPoint(i, r));
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + ' Z';
  };

  const dataPoints = factors.map((f, i) => {
    const ratio = f.max > 0 ? Math.min(f.score / f.max, 1) : 0;
    return getPoint(i, radius * ratio);
  });

  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + ' Z';

  const truncateLabel = (name: string): string => {
    const words = name.split(' ');
    return words.length > 3 ? words.slice(0, 3).join(' ') + '…' : name;
  };

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${size} ${size}`}
      style={{ maxWidth: `${size}px` }}
    >
      <defs>
        <radialGradient id="spider-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#DFF651" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#DFF651" stopOpacity="0" />
        </radialGradient>
        <filter id="dot-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background glow */}
      <circle cx={cx} cy={cy} r={radius} fill="url(#spider-glow)" />

      {/* Grid hexagons */}
      {[0.33, 0.66, 1].map((scale, i) => (
        <path
          key={`grid-${i}`}
          d={getHexPath(radius * scale)}
          fill="none"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth="1"
        />
      ))}

      {/* Axis lines */}
      {Array.from({ length: numAxes }, (_, i) => {
        const [px, py] = getPoint(i, radius);
        return (
          <line
            key={`axis-${i}`}
            x1={cx}
            y1={cy}
            x2={px}
            y2={py}
            stroke="rgba(255, 255, 255, 0.06)"
            strokeWidth="1"
          />
        );
      })}

      {/* Data polygon */}
      <path
        d={dataPath}
        fill="rgba(223, 246, 81, 0.15)"
        stroke="rgba(223, 246, 81, 0.6)"
        strokeWidth="2"
        strokeLinejoin="round"
        style={{ transition: 'all 0.4s ease' }}
      />

      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle
          key={`dot-${i}`}
          cx={p[0]}
          cy={p[1]}
          r={4}
          fill="#DFF651"
          filter="url(#dot-glow)"
          style={{ transition: 'all 0.4s ease' }}
        />
      ))}

      {/* Labels */}
      {factors.map((f, i) => {
        const [lx, ly] = getPoint(i, labelOffset);
        const angle = (Math.PI * 2 * i) / numAxes - Math.PI / 2;
        const textAnchor = Math.abs(Math.cos(angle)) < 0.01
          ? 'middle'
          : Math.cos(angle) > 0
            ? 'start'
            : 'end';
        return (
          <text
            key={`label-${i}`}
            x={lx}
            y={ly}
            textAnchor={textAnchor}
            dominantBaseline="central"
            fill="rgba(255, 255, 255, 0.5)"
            fontSize="9"
            fontFamily="var(--font-main, 'Inter', sans-serif)"
            fontWeight="500"
          >
            {truncateLabel(f.name)}
          </text>
        );
      })}
    </svg>
  );
};

export default SpiderChart;
