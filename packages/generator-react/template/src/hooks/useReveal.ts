// SPDX-License-Identifier: MIT-0
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
    // Observe the parent: a 'mask' reveal clips the element itself to zero area, and a
    // fully clipped element never reports as intersecting.
    const el = ref.current?.parentElement ?? ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0, rootMargin: '0px 0px -15% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, reducedMotion]);
  return { ref, className: visible ? 'is-visible' : undefined, reveal: enabled ? '' : undefined };
}
