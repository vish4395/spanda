// SPDX-License-Identifier: MIT-0
// Decorative, procedural 3D scenes (original geometry; no external models or textures).
// variant 'hero': one of the design language's hero arts (faceted, rings, particles, ribbons,
// terrain). variant 'showcase': one object preset, centred.
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

function createObject(preset, material) {
  if (preset === 'monolith') {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.8, 0.55), material);
    mesh.rotation.set(0.08, 0.5, 0.04);
    return mesh;
  }
  if (preset === 'vessel') {
    const profile = [
      [0.0, -1.5], [0.85, -1.45], [1.05, -1.0], [0.9, -0.2], [0.55, 0.6], [0.45, 1.2], [0.62, 1.55], [0.58, 1.6],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.Mesh(new THREE.LatheGeometry(profile, 14), material);
  }
  if (preset === 'orb') return new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 3), material);
  return new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 1), material);
}

const CAMERAS = {
  orbit: { position: [0, 0.4, 7], spin: 0.35 },
  front: { position: [0, 0, 7], spin: 0.08 },
  low: { position: [0, -1.6, 6.6], spin: 0.2 },
};

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ variant?: 'hero' | 'showcase', art?: string, composition?: string, object?: string, camera?: string, reducedMotion: MediaQueryList, onContextLost: () => void }} options
 * @returns {Promise<void>} resolves after the first frame is drawn
 */
export function mountScene(canvas, { variant = 'hero', art = 'faceted', composition = 'bottom-left', object, camera = 'orbit', reducedMotion, onContextLost }) {
  const showcase = variant === 'showcase';
  const cameraPreset = CAMERAS[camera] ?? CAMERAS.orbit;
  const small = window.matchMedia('(max-width: 767px)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const accent = cssColor('--color-accent', '#d9a76c');
  const foreground = cssColor('--color-fg', '#f4eee4');
  const background = cssColor('--color-bg', '#10141c');
  const secondary = cssColor('--color-secondary', '#7fa7ff');

  const scene = new THREE.Scene();
  const view = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  if (showcase) view.position.set(...cameraPreset.position);
  else view.position.set(0, 0, 10);
  view.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(foreground, background, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(4, 5, 6);
  scene.add(key);
  const rim = new THREE.PointLight(accent, 30, 20);
  rim.position.set(-3, -2, 3);
  scene.add(rim);

  const group = new THREE.Group();
  scene.add(group);
  const random = mulberry32(7);
  /** Per-frame animation for the chosen art; called with seconds since the last frame. */
  let animate = () => {};

  if (showcase) {
    const stone = createObject(object, new THREE.MeshStandardMaterial({ color: accent, flatShading: true, roughness: 0.45, metalness: 0.3 }));
    group.add(stone);
    animate = (dt) => {
      stone.rotation.y += dt * cameraPreset.spin;
      stone.rotation.x += dt * 0.05;
    };
  } else if (art === 'rings') {
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 4), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.3, metalness: 0.5 }));
    group.add(orb);
    const rings = [1.6, 2.2, 2.8, 3.4, 4.0].map((radius, i) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.012 + i * 0.002, 8, 220),
        new THREE.MeshBasicMaterial({ color: i % 2 ? secondary : foreground, transparent: true, opacity: 0.55 - i * 0.07 }),
      );
      ring.rotation.set(Math.PI * (0.38 + i * 0.05), i * 0.4, 0);
      group.add(ring);
      return ring;
    });
    animate = (dt) => {
      rings.forEach((ring, i) => (ring.rotation.z += dt * (0.05 + i * 0.015) * (i % 2 ? -1 : 1)));
      orb.rotation.y += dt * 0.2;
    };
  } else if (art === 'particles') {
    const count = small ? 1400 : 3600;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const mixed = new THREE.Color();
    for (let i = 0; i < count; i += 1) {
      // Spiral galaxy: three arms, denser at the core.
      const arm = (i % 3) * ((Math.PI * 2) / 3);
      const r = Math.pow(random(), 1.6) * 5.5;
      const angle = arm + r * 0.9 + (random() - 0.5) * 0.6;
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = (random() - 0.5) * 0.5 * (1.2 - r / 6);
      positions[i * 3 + 2] = Math.sin(angle) * r;
      mixed.copy(accent).lerp(secondary, r / 5.5);
      colors.set([mixed.r, mixed.g, mixed.b], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const galaxy = new THREE.Points(geometry, new THREE.PointsMaterial({ size: small ? 0.05 : 0.04, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    galaxy.rotation.x = 0.5;
    group.add(galaxy);
    animate = (dt) => (galaxy.rotation.y += dt * 0.06);
  } else if (art === 'ribbons') {
    const ribbons = [0, 1, 2, 3].map((k) => {
      const points = [];
      for (let i = 0; i <= 12; i += 1) {
        const t = i / 12;
        points.push(new THREE.Vector3((t - 0.5) * 12, Math.sin(t * Math.PI * 2 + k) * (0.8 + k * 0.25), Math.cos(t * Math.PI * 1.5 + k) * 1.2 - k * 0.4));
      }
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 160, 0.05 + k * 0.025, 12, false),
        new THREE.MeshStandardMaterial({ color: k % 2 ? secondary : accent, roughness: 0.35, metalness: 0.4, emissive: k % 2 ? secondary : accent, emissiveIntensity: 0.15 }),
      );
      tube.rotation.z = k * 0.12;
      group.add(tube);
      return tube;
    });
    animate = (dt, t) => ribbons.forEach((tube, k) => {
      tube.rotation.x = Math.sin(t * 0.25 + k) * 0.25;
      tube.position.y = Math.sin(t * 0.4 + k * 1.3) * 0.15;
    });
  } else if (art === 'terrain') {
    const geometry = new THREE.PlaneGeometry(30, 18, small ? 60 : 110, small ? 36 : 66);
    geometry.rotateX(-Math.PI / 2);
    const base = Float32Array.from(geometry.attributes.position.array);
    const terrain = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: accent, wireframe: true, transparent: true, opacity: 0.55 }));
    terrain.position.set(0, -2.2, -2);
    group.add(terrain);
    const sun = new THREE.Mesh(new THREE.CircleGeometry(1.6, 64), new THREE.MeshBasicMaterial({ color: secondary }));
    sun.position.set(0, 1.4, -10);
    group.add(sun);
    const heights = geometry.attributes.position;
    const shape = (x, z, t) => Math.sin(x * 0.45 + t) * 0.45 + Math.cos(z * 0.6 - t * 0.8) * 0.35 + Math.sin((x + z) * 0.2) * 0.6 * Math.min(1, Math.abs(x) / 6);
    animate = (dt, t) => {
      for (let i = 0; i < heights.count; i += 1) heights.array[i * 3 + 1] = shape(base[i * 3], base[i * 3 + 2], t * 0.6);
      heights.needsUpdate = true;
    };
    animate(0, 0);
  } else {
    const stone = createObject('hero', new THREE.MeshStandardMaterial({ color: accent, flatShading: true, roughness: 0.45, metalness: 0.3 }));
    group.add(stone);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: foreground, transparent: true, opacity: 0.4 });
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.012, 8, 180), ringMaterial);
    ringA.rotation.set(Math.PI * 0.42, 0, 0.2);
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.008, 8, 180), ringMaterial);
    ringB.rotation.set(Math.PI * 0.55, 0.3, -0.4);
    group.add(ringA, ringB);
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
    const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: foreground, size: small ? 0.035 : 0.03, transparent: true, opacity: 0.7, sizeAttenuation: true }));
    scene.add(dust);
    animate = (dt) => {
      stone.rotation.y += dt * 0.18;
      stone.rotation.x += dt * 0.05;
      ringA.rotation.z += dt * 0.06;
      ringB.rotation.z -= dt * 0.04;
      dust.rotation.y += dt * 0.015;
    };
  }

  function layout() {
    const width = canvas.clientWidth || canvas.parentElement.clientWidth;
    const height = canvas.clientHeight || canvas.parentElement.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    view.aspect = width / height;
    view.updateProjectionMatrix();
    if (showcase) {
      group.position.set(0, 0, 0);
      group.scale.setScalar(Math.min(1, view.aspect * 0.95));
      return;
    }
    // Fields fill the frame. Objects sit beside the copy on wide screens when the hero
    // composition leaves room (bottom-left, split); otherwise they sit behind it, centred.
    const wide = width / height > 1.1;
    if (art === 'terrain' || art === 'particles' || art === 'ribbons') {
      group.position.set(0, art === 'particles' ? 0.3 : 0, 0);
      group.scale.setScalar(wide ? 1 : 0.8);
      return;
    }
    const beside = wide && (composition === 'bottom-left' || composition === 'split');
    group.position.set(beside ? 2.6 : 0, beside ? 0.4 : wide ? 0.2 : 1.6, 0);
    group.scale.setScalar(beside ? 1 : wide ? 0.9 : 0.72);
  }

  let running = false;
  let visible = true;
  let frame = 0;
  let last = performance.now();
  let elapsed = 0;

  function draw() {
    renderer.render(scene, view);
  }

  function tick(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    elapsed += dt;
    animate(dt, elapsed);
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
