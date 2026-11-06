// SPDX-License-Identifier: MIT-0
// Progressive enhancement entry point. Content is fully readable without this file.
import { createDirector } from './cinema/director.js';

const root = document.documentElement;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

root.classList.add('js');
root.dataset.motion = reducedMotion.matches ? 'reduced' : 'full';
reducedMotion.addEventListener('change', (event) => {
  root.dataset.motion = event.matches ? 'reduced' : 'full';
  if (event.matches) revealAll();
});

// Items (steps, gallery cards) reveal once as they enter; headlines are scrubbed by scroll.
const revealTargets = Array.from(document.querySelectorAll('[data-reveal]'));

function revealAll() {
  for (const el of revealTargets) el.classList.add('is-visible');
}

if (reducedMotion.matches || !('IntersectionObserver' in window)) {
  revealAll();
} else {
  // Watch each target's parent, not the target: a 'mask' reveal clips the target to zero
  // area, and a fully clipped element never reports as intersecting.
  const byParent = new Map();
  for (const el of revealTargets) {
    const parent = el.parentElement ?? el;
    byParent.set(parent, [...(byParent.get(parent) ?? []), el]);
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          for (const el of byParent.get(entry.target) ?? []) el.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0, rootMargin: '0px 0px -15% 0px' },
  );
  for (const parent of byParent.keys()) observer.observe(parent);
}

// Word order for staggered headline reveals (set through the CSSOM; the CSP forbids inline styles).
for (const heading of document.querySelectorAll('[data-scrub] :is(h1, h2)')) {
  heading.querySelectorAll('.word').forEach((word, i) => word.style.setProperty('--i', String(i)));
}

const sections = Array.from(document.querySelectorAll('main > section[data-shot]'));
const director = createDirector({ sections, reducedMotion, rail: document.querySelector('.story-rail') });

function webglAvailable() {
  try {
    const probe = document.createElement('canvas');
    return Boolean(probe.getContext('webgl2') || probe.getContext('webgl'));
  } catch {
    return false;
  }
}

function markReady(state) {
  root.dataset.webgl = state;
  root.dataset.ready = 'true';
}

// Without the 3D stage the director still scrubs typography on scroll.
let stageDriving = false;
let pending = false;
function onScroll() {
  if (stageDriving || pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    director.update();
  });
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);
director.update();

const canvas = document.querySelector('canvas.stage');

if (!canvas) {
  markReady('none'); // no 3D in this design: nothing failed, so no fallback captions
} else if (!webglAvailable()) {
  markReady('off');
} else {
  root.dataset.webgl = 'loading';
  Promise.all([import('../vendor/three/three.module.js'), import('./cinema/stage.js')])
    .then(([THREE, { createWorld, mixShots }]) => {
      const small = window.matchMedia('(max-width: 767px)').matches;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      const css = (name, fallback) => getComputedStyle(root).getPropertyValue(name).trim() || fallback;
      const world = createWorld(THREE, {
        art: canvas.dataset.art,
        object: canvas.dataset.object || undefined,
        colors: { background: css('--color-bg', '#10141c'), foreground: css('--color-fg', '#f4eee4'), accent: css('--color-accent', '#d9a76c'), secondary: css('--color-secondary', '#7fa7ff') },
        small,
        renderer,
      });
      const scene = new THREE.Scene();
      scene.add(world.root);
      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 120);

      const pointer = { x: 0, y: 0 };
      const pointerTarget = { x: 0, y: 0 };
      if (window.matchMedia('(pointer: fine)').matches) {
        window.addEventListener('pointermove', (e) => {
          pointerTarget.x = (e.clientX / window.innerWidth - 0.5) * 2;
          pointerTarget.y = -(e.clientY / window.innerHeight - 0.5) * 2;
        }, { passive: true });
      }

      function resize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
      window.addEventListener('resize', resize);
      resize();

      let current = director.update().shot;
      let elapsed = 0;
      let last = performance.now();
      let frame = 0;
      let running = false;

      function render(dt, settle) {
        const { shot, spin } = director.update();
        const k = settle ? 1 : 1 - Math.exp(-dt * 4.5);
        current = mixShots(current, shot, k);
        pointer.x += (pointerTarget.x - pointer.x) * k;
        pointer.y += (pointerTarget.y - pointer.y) * k;
        world.apply(camera, current, { spin, t: elapsed, dt, pointer, aspect: camera.aspect });
        renderer.render(scene, camera);
      }

      function tick(now) {
        if (!running) return;
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        elapsed += dt;
        render(dt, false);
        frame = requestAnimationFrame(tick);
      }

      // Reduced motion: no continuous animation; the stage snaps to each section's shot on scroll.
      function updateLoop() {
        const shouldRun = !document.hidden && !reducedMotion.matches;
        stageDriving = shouldRun;
        if (shouldRun && !running) {
          running = true;
          last = performance.now();
          frame = requestAnimationFrame(tick);
        } else if (!shouldRun && running) {
          running = false;
          cancelAnimationFrame(frame);
        }
        if (!shouldRun) render(0, true);
      }
      window.addEventListener('scroll', () => {
        if (!running) render(0, true);
      }, { passive: true });
      document.addEventListener('visibilitychange', updateLoop);
      reducedMotion.addEventListener('change', updateLoop);
      canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        running = false;
        stageDriving = false;
        markReady('off');
      });

      return new Promise((resolve) => {
        requestAnimationFrame(() => {
          render(0, true);
          updateLoop();
          resolve();
        });
      });
    })
    .then(() => markReady('on'))
    .catch((error) => {
      console.warn('3D stage unavailable, showing static fallback.', error);
      markReady('off');
    });
}

// Galleries: native horizontal scrolling (keyboard focusable) plus previous/next buttons.
for (const gallery of document.querySelectorAll('[data-gallery]')) {
  const track = gallery.querySelector('.gallery__track');
  const prev = gallery.querySelector('[data-gallery-prev]');
  const next = gallery.querySelector('[data-gallery-next]');
  if (!track || !prev || !next) continue;
  const step = () => (track.firstElementChild ? track.firstElementChild.getBoundingClientRect().width + 16 : track.clientWidth);
  const update = () => {
    // Tolerance covers snap/padding rounding at either end.
    prev.disabled = track.scrollLeft <= 8;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
  };
  const behavior = () => (reducedMotion.matches ? 'auto' : 'smooth');
  prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: behavior() }));
  next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: behavior() }));
  track.addEventListener('scroll', update, { passive: true });
  new ResizeObserver(update).observe(track);
  update();
}
