import React, { useRef, useState, useEffect, useCallback } from 'react';

type CountUpProps = {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
};

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

const CountUp: React.FC<CountUpProps> = ({
  end,
  duration = 2000,
  prefix = '',
  suffix = '',
  decimals = 0,
}) => {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  const animate = useCallback(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);

      setValue(easedProgress * end);

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        setValue(end);
      }
    };

    requestAnimationFrame(tick);
  }, [end, duration]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animate();
            observer.disconnect();
          }
        });
      },
      { threshold: 0.3 }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [animate]);

  const displayValue = decimals > 0
    ? value.toFixed(decimals)
    : Math.round(value).toString();

  return (
    <span ref={ref} style={{ display: 'inline-block' }}>
      {prefix}{displayValue}{suffix}
    </span>
  );
};

export default CountUp;
