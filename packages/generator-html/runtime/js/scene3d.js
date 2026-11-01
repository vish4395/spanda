// Decorative, procedural hero scene (original geometry; no external models or textures).
import * as THREE from '../vendor/three/three.module.js';

function cssColor(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return new THREE.Color(value || fallback);
}

// Deterministic PRNG so the particle layout is identical on every load.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ reducedMotion: MediaQueryList, onContextLost: () => void }} options
 * @returns {Promise<void>} resolves after the first frame is drawn
 */
export function mountHeroScene(canvas, { reducedMotion, onContextLost }) {
  const small = window.matchMedia('(max-width: 767px)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const accent = cssColor('--color-accent', '#d9a76c');
  const foreground = cssColor('--color-fg', '#f4eee4');
  const background = cssColor('--color-bg', '#10141c');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  scene.add(new THREE.HemisphereLight(foreground, background, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(4, 5, 6);
  scene.add(key);
  const rim = new THREE.PointLight(accent, 30, 20);
  rim.position.set(-3, -2, 3);
  scene.add(rim);

  const group = new THREE.Group();
  scene.add(group);

  const stone = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.7, 1),
    new THREE.MeshStandardMaterial({ color: accent, flatShading: true, roughness: 0.5, metalness: 0.3 }),
  );
  group.add(stone);

  const ringMaterial = new THREE.MeshBasicMaterial({ color: foreground, transparent: true, opacity: 0.4 });
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.012, 8, 180), ringMaterial);
  ringA.rotation.set(Math.PI * 0.42, 0, 0.2);
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.008, 8, 180), ringMaterial);
  ringB.rotation.set(Math.PI * 0.55, 0.3, -0.4);
  group.add(ringA, ringB);

  const random = mulberry32(7);
  const count = small ? 180 : 420;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const radius = 3 + random() * 5;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.6;
    positions[i * 3 + 2] = radius * Math.cos(phi) * 0.5;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dust = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({ color: foreground, size: small ? 0.035 : 0.03, transparent: true, opacity: 0.7, sizeAttenuation: true }),
  );
  scene.add(dust);

  function layout() {
    const width = canvas.clientWidth || canvas.parentElement.clientWidth;
    const height = canvas.clientHeight || canvas.parentElement.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    // Wide screens: object sits right of the copy. Narrow: centred above it, smaller.
    const wide = width / height > 1.1;
    group.position.set(wide ? 2.6 : 0, wide ? 0.4 : 1.6, 0);
    group.scale.setScalar(wide ? 1 : 0.72);
  }

  let running = false;
  let visible = true;
  let frame = 0;
  let last = performance.now();

  function draw() {
    renderer.render(scene, camera);
  }

  function tick(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    stone.rotation.y += dt * 0.18;
    stone.rotation.x += dt * 0.05;
    ringA.rotation.z += dt * 0.06;
    ringB.rotation.z -= dt * 0.04;
    dust.rotation.y += dt * 0.015;
    draw();
    frame = requestAnimationFrame(tick);
  }

  function updateLoop() {
    const shouldRun = visible && !document.hidden && !reducedMotion.matches;
    if (shouldRun && !running) {
      running = true;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    } else if (!shouldRun && running) {
      running = false;
      cancelAnimationFrame(frame);
      draw();
    }
  }

  new ResizeObserver(() => {
    layout();
    if (!running) draw();
  }).observe(canvas.parentElement);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    updateLoop();
  }).observe(canvas);
  document.addEventListener('visibilitychange', updateLoop);
  reducedMotion.addEventListener('change', updateLoop);
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    running = false;
    onContextLost();
  });

  layout();
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      draw();
      updateLoop();
      resolve();
    });
  });
}
