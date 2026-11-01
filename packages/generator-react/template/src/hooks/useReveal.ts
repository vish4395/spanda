import { useEffect, useRef, useState } from 'react';

/** Adds the `is-visible` state when the element scrolls into view (immediately under reduced motion). */
export function useReveal<T extends Element>(enabled: boolean, reducedMotion: boolean) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(!enabled || reducedMotion);
  useEffect(() => {
    if (!enabled || reducedMotion || !('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, reducedMotion]);
  return { ref, className: visible ? 'is-visible' : undefined, reveal: enabled ? '' : undefined };
}
