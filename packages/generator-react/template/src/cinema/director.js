// SPDX-License-Identifier: MIT-0
// Scroll director: turns the scroll position into (1) the current camera shot for the
// 3D stage and (2) CSS variables that scrub each section's typography and layers:
//   --enter    0 → 1 as the section rises into view (headline words, body, media)
//   --progress 0 → 1 across the whole time the section is on screen (pinned scenes)
//   --page     0 → 1 over the whole page (progress bar)
// No scroll hijacking: native scrolling, so keyboard, screen readers and trackpads work.
import { SHOTS, mixShots, smooth } from './stage.js';

const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Where in a section each of its shots is reached (fraction of the section's height). */
function anchorsFor(shot) {
  if (shot === 'dolly') return [['dolly-in', 0.2], ['dolly-out', 0.8]];
  if (shot === 'showcase' || shot === 'showcase-split') return [[shot, 0.2], [shot, 0.8]];
  return [[SHOTS[shot] ? shot : 'hero', 0.5]];
}

/**
 * @param {{ sections: HTMLElement[], reducedMotion: MediaQueryList, rail?: HTMLElement | null }} options
 */
export function createDirector({ sections, reducedMotion, rail }) {
  const root = document.documentElement;
  let anchors = [];
  let total = 1;
  const written = new WeakMap();
  const railLinks = rail ? Array.from(rail.querySelectorAll('a[href^="#"]')) : [];
  let active = null;

  function measure() {
    const y = window.scrollY;
    anchors = sections.flatMap((el) => {
      const box = el.getBoundingClientRect();
      const top = box.top + y;
      return anchorsFor(el.dataset.shot).map(([name, at]) => ({ name, y: top + box.height * at }));
    });
    total = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  }

  function write(el, name, value) {
    const rounded = Math.round(value * 1000) / 1000;
    const cache = written.get(el) ?? {};
    if (cache[name] === rounded) return;
    cache[name] = rounded;
    written.set(el, cache);
    el.style.setProperty(name, String(rounded));
  }

  /** Update CSS variables and the rail; returns the blended shot and the scroll-linked spin. */
  function update() {
    const vh = window.innerHeight;
    const still = reducedMotion.matches;
    let current = sections[0];
    for (const el of sections) {
      const box = el.getBoundingClientRect();
      write(el, '--enter', still ? 1 : clamp((vh - box.top) / (vh * 0.7)));
      write(el, '--progress', still ? 0.5 : clamp((vh - box.top) / (box.height + vh)));
      if (box.top <= vh * 0.5) current = el;
    }
    const page = clamp(window.scrollY / total);
    write(root, '--page', page);
    if (current && current !== active) {
      active = current;
      for (const link of railLinks) {
        if (link.getAttribute('href') === `#${current.id}`) link.setAttribute('aria-current', 'step');
        else link.removeAttribute('aria-current');
      }
    }

    const focus = window.scrollY + vh * 0.5;
    let shot = SHOTS[anchors[0]?.name ?? 'hero'];
    if (anchors.length > 1) {
      if (focus <= anchors[0].y) shot = SHOTS[anchors[0].name];
      else if (focus >= anchors[anchors.length - 1].y) shot = SHOTS[anchors[anchors.length - 1].name];
      else {
        const i = anchors.findIndex((a) => a.y > focus);
        const a = anchors[i - 1];
        const b = anchors[i];
        const t = (focus - a.y) / Math.max(1, b.y - a.y);
        shot = mixShots(SHOTS[a.name], SHOTS[b.name], still ? (t < 0.5 ? 0 : 1) : smooth(t));
      }
    }
    // Two full turns over the page: the closing shot shows the object as it first appeared.
    return { shot, spin: page * Math.PI * 4 };
  }

  measure();
  const observer = new ResizeObserver(() => measure());
  observer.observe(document.body);
  window.addEventListener('load', measure);

  return {
    update,
    measure,
    destroy() {
      observer.disconnect();
      window.removeEventListener('load', measure);
    },
  };
}
