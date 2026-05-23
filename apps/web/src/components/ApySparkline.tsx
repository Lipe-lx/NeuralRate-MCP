import React, { useEffect, useState, useMemo, useRef } from 'react';
import { API_BASE_URL } from '../config';

interface ChartPoint {
  timestamp: string;
  apy: number;
  tvlUsd: number;
}

interface Props {
  poolId: string;
}

// Simple in-memory cache to prevent refetching during component remounts
const sparklineCache = new Map<string, ChartPoint[]>();

export const ApySparkline: React.FC<Props> = ({ poolId }) => {
  const [data, setData] = useState<ChartPoint[] | null>(sparklineCache.get(poolId) || null);
  const [loading, setLoading] = useState(!data);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (sparklineCache.has(poolId)) {
      setData(sparklineCache.get(poolId)!);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    fetch(`${API_BASE_URL}/api/yields/chart/${poolId}`)
      .then((res) => res.json())
      .then((json) => {
        if (isMounted && json.data) {
          sparklineCache.set(poolId, json.data);
          setData(json.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch sparkline data", err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [poolId]);

  const { points, minApy, maxApy, isPositiveTrend } = useMemo(() => {
    if (!data || data.length === 0) return { points: [], minApy: 0, maxApy: 0, isPositiveTrend: true };
    
    // Determine trend (comparing last point to 7 days ago, or earliest available)
    const currentApy = data[data.length - 1].apy;
    const compareIndex = Math.max(0, data.length - 8);
    const pastApy = data[compareIndex].apy;
    const isPositiveTrend = currentApy >= pastApy;

    const apys = data.map(d => d.apy);
    // Add a small padding to min/max so lines don't touch the very edges
    const rawMin = Math.min(...apys);
    const rawMax = Math.max(...apys);
    const range = rawMax - rawMin || 1;
    const minApy = Math.max(0, rawMin - range * 0.1); 
    const maxApy = rawMax + range * 0.1;

    // Map to SVG coordinates (100x40)
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 40 - ((d.apy - minApy) / (maxApy - minApy)) * 40;
      return { x, y, data: d };
    });

    return { points, minApy, maxApy, isPositiveTrend };
  }, [data]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    // Map xRatio (0 to 1) to an index
    let index = Math.round(xRatio * (points.length - 1));
    index = Math.max(0, Math.min(index, points.length - 1));
    setHoverIndex(index);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  if (loading) {
    return (
      <div className="sparkline-container" style={{ width: '120px', height: '40px', display: 'flex', alignItems: 'center', padding: '0 10px' }}>
         <div className="sparkline-skeleton" style={{ width: '100%', height: '2px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <div className="sparkline-container" style={{ width: '120px', height: '40px' }} />;
  }

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
  const areaD = `${pathD} L 100,40 L 0,40 Z`;
  
  // Choose color based on trend
  const strokeColor = isPositiveTrend ? 'var(--color-lime)' : 'var(--color-danger)';
  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="sparkline-container" style={{ position: 'relative', width: '120px', height: '40px', display: 'flex', alignItems: 'center' }}>
      
      {/* Trend Indicator (Small arrow) */}
      <div style={{ 
        position: 'absolute', 
        left: '-18px', 
        fontSize: '0.75rem', 
        color: strokeColor,
        opacity: 0.8
      }}>
        {isPositiveTrend ? '↗' : '↘'}
      </div>

      <svg 
        ref={svgRef}
        viewBox="0 0 100 40" 
        preserveAspectRatio="none" 
        style={{ width: '100%', height: '100%', overflow: 'visible', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id={`grad-${poolId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Area */}
        <path d={areaD} fill={`url(#grad-${poolId})`} style={{ animation: 'sparkline-fade 1s ease-out forwards', opacity: 0 }} />
        
        {/* Line */}
        <path 
          d={pathD} 
          fill="none" 
          stroke={strokeColor} 
          strokeWidth="1.5" 
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ 
            animation: 'sparkline-draw 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            strokeDasharray: 200, // Length > path length
            strokeDashoffset: 200,
          }} 
        />

        {/* Hover Crosshair and Dot */}
        {hoverPoint && (
          <g>
            <line x1={hoverPoint.x} y1="0" x2={hoverPoint.x} y2="40" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="2,2" />
            <circle cx={hoverPoint.x} cy={hoverPoint.y} r="2.5" fill={strokeColor} stroke="var(--bg-deep)" strokeWidth="1" />
          </g>
        )}
      </svg>

      {/* Tooltip */}
      {hoverPoint && (
        <div className="sparkline-tooltip" style={{
          position: 'absolute',
          left: `calc(${hoverPoint.x}% - 40px)`,
          top: '-25px',
          background: 'rgba(20, 20, 20, 0.9)',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(255,255,255,0.1)',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '0.65rem',
          color: 'var(--text-primary)',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 10,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px'
        }}>
          <span style={{ fontWeight: 600, color: strokeColor }}>{hoverPoint.data.apy.toFixed(2)}%</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.55rem' }}>
            {new Date(hoverPoint.data.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        </div>
      )}
    </div>
  );
};
