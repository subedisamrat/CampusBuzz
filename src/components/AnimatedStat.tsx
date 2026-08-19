'use client';

import { useEffect, useState, useRef } from 'react';

export default function AnimatedStat({
  targetValue, label
}: { targetValue: string; label: string }) {
  const [display, setDisplay] = useState(targetValue);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);

  const numericTarget = parseInt(targetValue.replace(/[^0-9]/g, ''), 10);
  const suffix = targetValue.replace(/[0-9]/g, '');
  const isNumeric = !isNaN(numericTarget) && numericTarget > 0;

  useEffect(() => {
    if (!isNumeric) return;

    const el = ref.current;
    if (!el) return;

    const startAnimation = () => {
      if (hasAnimated.current) return;
      hasAnimated.current = true;

      setDisplay('0');

      const duration = 1600;
      const steps = 50;
      const increment = numericTarget / steps;
      const animInterval = duration / steps;
      let current = 0;

      timerRef.current = setInterval(() => {
        current += increment;
        if (current >= numericTarget) {
          setDisplay(`${numericTarget}${suffix}`);
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        } else {
          setDisplay(`${Math.round(current)}${suffix}`);
        }
      }, animInterval);
    };

    const rect = el.getBoundingClientRect();
    const isVisible = rect.top < window.innerHeight && rect.bottom > 0;

    if (isVisible) {
      rafRef.current = requestAnimationFrame(() => startAnimation());
    } else {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            startAnimation();
            observer.disconnect();
          }
        },
        { threshold: 0.2 }
      );
      observer.observe(el);
      return () => {
        observer.disconnect();
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isNumeric, numericTarget, suffix]);

  return (
    <div ref={ref} className="bg-[#0d1f1e] px-5 py-6 text-center">
      <div className="text-3xl font-extrabold leading-none text-[#14b8a6]">
        {display}
      </div>
      <div className="mt-1.5 text-[12px] font-semibold tracking-wider
                      text-[#6b9e99] uppercase">
        {label}
      </div>
    </div>
  );
}
