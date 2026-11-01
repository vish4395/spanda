// Progressive enhancement entry point. Content is fully readable without this file.
const root = document.documentElement;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

root.classList.add('js');
root.dataset.motion = reducedMotion.matches ? 'reduced' : 'full';
reducedMotion.addEventListener('change', (event) => {
  root.dataset.motion = event.matches ? 'reduced' : 'full';
  if (event.matches) revealAll();
});

const revealTargets = Array.from(document.querySelectorAll('[data-reveal]'));

function revealAll() {
  for (const el of revealTargets) el.classList.add('is-visible');
}

if (reducedMotion.matches || !('IntersectionObserver' in window)) {
  revealAll();
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.15 },
  );
  for (const el of revealTargets) observer.observe(el);
}

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

const canvases = Array.from(document.querySelectorAll('canvas[data-scene3d]'));

if (canvases.length === 0) {
  markReady('off');
} else if (!webglAvailable()) {
  markReady('off');
} else {
  root.dataset.webgl = 'loading';
  import('./scene3d.js')
    .then(({ mountScene }) =>
      Promise.all(
        canvases.map((canvas) =>
          mountScene(canvas, {
            variant: canvas.dataset.scene3d,
            object: canvas.dataset.object,
            camera: canvas.dataset.camera,
            reducedMotion,
            onContextLost: () => markReady('off'),
          }),
        ),
      ),
    )
    .then(() => markReady('on'))
    .catch((error) => {
      console.warn('3D layer unavailable, showing static fallback.', error);
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
