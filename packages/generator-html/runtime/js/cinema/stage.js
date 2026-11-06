// SPDX-License-Identifier: MIT-0
// Cinematic stage: ONE persistent 3D world behind the whole story. A hero object
// (the protagonist) and an art field stay on stage from the first screen to the
// last; each section is a camera "shot", and scrolling moves between shots. The
// closing shot repeats the opening one, so the story ends where it began.
// Framework-free: three.js is passed in, so the HTML and React exports share this
// file byte for byte. Original procedural geometry only (no models or textures).

/** Camera, object and atmosphere for each kind of section. Units are world units. */
export const SHOTS = {
  hero: { cam: [0, 0.15, 8.6], look: [0, 0, 0], obj: [2.1, 0.05, 0], scale: 1, field: 1, glow: 1, warmth: 0 },
  'hero-center': { cam: [0, 0.3, 9.4], look: [0, 0.2, 0], obj: [0, 0.75, -0.6], scale: 0.9, field: 1, glow: 1, warmth: 0 },
  left: { cam: [0, 0.1, 7.4], look: [0, 0, 0], obj: [-2.5, 0, 0], scale: 0.85, field: 0.45, glow: 0.7, warmth: 0.3 },
  right: { cam: [0, 0.1, 7.4], look: [0, 0, 0], obj: [2.5, 0, 0], scale: 0.85, field: 0.45, glow: 0.7, warmth: 0.3 },
  full: { cam: [0, 0, 9.5], look: [0, 0, 0], obj: [0, 0, -2.2], scale: 1.7, field: 0.7, glow: 0.45, warmth: 0.5 },
  'dolly-in': { cam: [0, 0.6, 9], look: [0, 0, 0], obj: [2.2, 0.2, -0.5], scale: 0.8, field: 0.8, glow: 0.6, warmth: 0.6 },
  'dolly-out': { cam: [0, -0.1, 4.6], look: [0, 0, 0], obj: [2.0, -0.1, 0], scale: 0.8, field: 0.55, glow: 0.8, warmth: 0.8 },
  showcase: { cam: [0, 0.25, 6.6], look: [0, 0, 0], obj: [0, 0, 0], scale: 0.95, field: 0.15, glow: 1.2, warmth: 1 },
  'showcase-split': { cam: [0, 0.25, 6.8], look: [0, 0, 0], obj: [2.3, 0, 0], scale: 0.85, field: 0.15, glow: 1.2, warmth: 1 },
  gallery: { cam: [0, 0, 9.2], look: [0, 0, 0], obj: [0, 1.6, -4], scale: 0.55, field: 1.45, glow: 0.5, warmth: 0.4 },
};
SHOTS.finale = SHOTS.hero;
SHOTS['finale-center'] = SHOTS['hero-center'];

const KEYS = ['scale', 'field', 'glow', 'warmth'];

/** Linear blend of two shots (vectors and scalars). */
export function mixShots(a, b, t) {
  const out = {};
  for (const k of ['cam', 'look', 'obj']) out[k] = a[k].map((v, i) => v + (b[k][i] - v) * t);
  for (const k of KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

/** Ease between anchors so the camera settles on each shot instead of gliding at constant speed. */
export const smooth = (t) => t * t * (3 - 2 * t);

// Deterministic PRNG so layouts are identical on every load.
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

/** The protagonist for an art style when the story names no object. */
export const DEFAULT_OBJECT = { faceted: 'crystal', rings: 'orb', particles: 'orb', ribbons: 'knot', terrain: 'monolith' };

function lathe(THREE, points, segments = 48) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments);
}

/** Original procedural objects. Returns a group so composite objects (cup, lantern) work like simple ones. */
export function createObject(THREE, preset, materials) {
  const group = new THREE.Group();
  const { body, glass, glow } = materials;
  switch (preset) {
    case 'monolith': {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.9, 0.5, 1, 1, 1), body);
      mesh.rotation.set(0.06, 0.45, 0.03);
      group.add(mesh);
      break;
    }
    case 'vessel':
      group.add(new THREE.Mesh(lathe(THREE, [[0, -1.5], [0.85, -1.45], [1.05, -1.0], [0.9, -0.2], [0.55, 0.6], [0.45, 1.2], [0.62, 1.55], [0.58, 1.6]]), body));
      break;
    case 'bottle':
      group.add(new THREE.Mesh(lathe(THREE, [[0, -1.6], [0.62, -1.58], [0.7, -1.4], [0.7, 0.3], [0.5, 0.75], [0.22, 1.0], [0.2, 1.55], [0.24, 1.62], [0, 1.64]]), glass));
      break;
    case 'cup': {
      group.add(new THREE.Mesh(lathe(THREE, [[0, -0.9], [0.75, -0.9], [0.9, -0.6], [1.0, 0.6], [1.05, 0.75], [0.98, 0.78], [0.9, -0.5], [0, -0.6]]), body));
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 16, 48, Math.PI * 1.25), body);
      handle.position.set(1.05, 0.05, 0);
      handle.rotation.z = -Math.PI * 0.62;
      group.add(handle);
      break;
    }
    case 'lantern': {
      group.add(new THREE.Mesh(lathe(THREE, [[0, -1.3], [0.7, -1.2], [1.0, -0.6], [1.08, 0.1], [0.95, 0.8], [0.55, 1.25], [0, 1.32]], 32), glass));
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 16), glow);
      core.position.y = -0.1;
      group.add(core);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 0.22, 24), body);
      cap.position.y = 1.36;
      group.add(cap);
      break;
    }
    case 'knot':
      group.add(new THREE.Mesh(new THREE.TorusKnotGeometry(1.0, 0.3, 220, 28, 2, 3), body));
      break;
    case 'arch': {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.32, 24, 96, Math.PI), body);
      arch.position.y = -0.55;
      group.add(arch);
      for (const x of [-1.25, 1.25]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 1.1, 24), body);
        leg.position.set(x, -1.1, 0);
        group.add(leg);
      }
      break;
    }
    case 'crystal': {
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), body.clone());
      mesh.material.flatShading = true;
      mesh.scale.set(0.95, 1.15, 0.95);
      group.add(mesh);
      break;
    }
    default:
      group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.45, 6), body));
  }
  return group;
}

/** Soft studio reflections without any texture file: a tiny lit room baked through PMREM. */
function studioEnvironment(THREE, renderer, colors) {
  const room = new THREE.Scene();
  room.background = colors.background.clone().multiplyScalar(0.6);
  const panel = (color, intensity, position, size) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(intensity), side: THREE.DoubleSide }));
    mesh.position.set(...position);
    mesh.lookAt(0, 0, 0);
    room.add(mesh);
  };
  panel(new THREE.Color(0xffffff), 2.2, [0, 6, 2], [8, 3]);
  panel(colors.accent, 1.6, [-6, 1, 1], [3, 6]);
  panel(colors.secondary, 1.4, [6, -1, 2], [3, 6]);
  panel(colors.foreground, 0.6, [0, -5, -4], [10, 3]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(room, 0.03).texture;
  pmrem.dispose();
  return env;
}

/**
 * Build the world.
 * @param {typeof import('three')} THREE
 * @param {{ art: string, object?: string, colors: { background: string, foreground: string, accent: string, secondary: string }, small: boolean, renderer?: any }} options
 */
export function createWorld(THREE, { art, object, colors: css, small, renderer }) {
  const colors = Object.fromEntries(Object.entries(css).map(([k, v]) => [k, new THREE.Color(v)]));
  const random = mulberry32(11);
  const root = new THREE.Group();

  // Light: a key that warms toward the accent as the story deepens, a cool rim, and a fill.
  const hemi = new THREE.HemisphereLight(colors.foreground, colors.background, 0.55);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(4, 5, 6);
  const rim = new THREE.PointLight(colors.secondary, 26, 24);
  rim.position.set(-4, 2, -2);
  const glowLight = new THREE.PointLight(colors.accent, 18, 14);
  root.add(hemi, key, rim);

  const body = new THREE.MeshPhysicalMaterial({ color: colors.accent, roughness: 0.32, metalness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.25, envMapIntensity: 1.1 });
  const glass = new THREE.MeshPhysicalMaterial({ color: colors.foreground, roughness: 0.12, metalness: 0, transmission: 0.0, transparent: true, opacity: 0.38, clearcoat: 1, envMapIntensity: 1.4, side: THREE.DoubleSide });
  const glow = new THREE.MeshBasicMaterial({ color: colors.accent });
  if (renderer) {
    const env = studioEnvironment(THREE, renderer, colors);
    body.envMap = env;
    glass.envMap = env;
  }

  const protagonist = new THREE.Group();
  const model = createObject(THREE, object ?? DEFAULT_OBJECT[art] ?? 'orb', { body, glass, glow });
  protagonist.add(model, glowLight);
  root.add(protagonist);

  // Halo: a soft additive disc behind the object that brightens on "glow" shots.
  const haloTexture = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.25)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture, color: colors.accent, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(6);
  halo.position.z = -1.2;
  protagonist.add(halo);

  // The art field: the direction's hero art, kept as an atmosphere around the protagonist.
  const field = new THREE.Group();
  root.add(field);
  let animateField = () => {};
  const fieldMaterials = [];
  const track = (m) => (fieldMaterials.push({ m, base: m.opacity ?? 1 }), m);

  if (art === 'rings') {
    const rings = [2.0, 2.7, 3.4, 4.1, 4.8].map((radius, i) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.012 + i * 0.002, 8, 240), track(new THREE.MeshBasicMaterial({ color: i % 2 ? colors.secondary : colors.foreground, transparent: true, opacity: 0.5 - i * 0.06 })));
      ring.rotation.set(Math.PI * (0.38 + i * 0.05), i * 0.4, 0);
      field.add(ring);
      return ring;
    });
    animateField = (dt) => rings.forEach((ring, i) => (ring.rotation.z += dt * (0.05 + i * 0.015) * (i % 2 ? -1 : 1)));
  } else if (art === 'particles') {
    const count = small ? 1600 : 4200;
    const positions = new Float32Array(count * 3);
    const tint = new Float32Array(count * 3);
    const mixed = new THREE.Color();
    for (let i = 0; i < count; i += 1) {
      const arm = (i % 3) * ((Math.PI * 2) / 3);
      const r = 1.2 + Math.pow(random(), 1.5) * 7;
      const angle = arm + r * 0.8 + (random() - 0.5) * 0.7;
      positions.set([Math.cos(angle) * r, (random() - 0.5) * 0.7 * (1.3 - r / 9), Math.sin(angle) * r], i * 3);
      mixed.copy(colors.accent).lerp(colors.secondary, r / 8);
      tint.set([mixed.r, mixed.g, mixed.b], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(tint, 3));
    const galaxy = new THREE.Points(geometry, track(new THREE.PointsMaterial({ size: small ? 0.05 : 0.04, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })));
    galaxy.rotation.x = 0.55;
    field.add(galaxy);
    animateField = (dt) => (galaxy.rotation.y += dt * 0.05);
  } else if (art === 'ribbons') {
    const ribbons = [0, 1, 2, 3].map((k) => {
      const points = [];
      for (let i = 0; i <= 14; i += 1) {
        const t = i / 14;
        points.push(new THREE.Vector3((t - 0.5) * 16, Math.sin(t * Math.PI * 2 + k) * (0.9 + k * 0.3), Math.cos(t * Math.PI * 1.5 + k) * 1.4 - 2 - k * 0.5));
      }
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 200, 0.035 + k * 0.02, 12, false),
        track(new THREE.MeshStandardMaterial({ color: k % 2 ? colors.secondary : colors.accent, roughness: 0.35, metalness: 0.4, emissive: k % 2 ? colors.secondary : colors.accent, emissiveIntensity: 0.25, transparent: true, opacity: 0.85 })),
      );
      field.add(tube);
      return tube;
    });
    animateField = (dt, t) =>
      ribbons.forEach((tube, k) => {
        tube.rotation.x = Math.sin(t * 0.25 + k) * 0.22;
        tube.position.y = Math.sin(t * 0.4 + k * 1.3) * 0.15;
      });
  } else if (art === 'terrain') {
    const geometry = new THREE.PlaneGeometry(34, 20, small ? 60 : 120, small ? 36 : 70);
    geometry.rotateX(-Math.PI / 2);
    const base = Float32Array.from(geometry.attributes.position.array);
    const terrain = new THREE.Mesh(geometry, track(new THREE.MeshBasicMaterial({ color: colors.accent, wireframe: true, transparent: true, opacity: 0.45 })));
    terrain.position.set(0, -2.6, -3);
    field.add(terrain);
    const sun = new THREE.Mesh(new THREE.CircleGeometry(1.8, 64), track(new THREE.MeshBasicMaterial({ color: colors.secondary, transparent: true, opacity: 1 })));
    sun.position.set(0, 1.8, -12);
    field.add(sun);
    const heights = geometry.attributes.position;
    const shape = (x, z, t) => Math.sin(x * 0.45 + t) * 0.45 + Math.cos(z * 0.6 - t * 0.8) * 0.35 + Math.sin((x + z) * 0.2) * 0.6 * Math.min(1, Math.abs(x) / 6);
    animateField = (dt, t) => {
      for (let i = 0; i < heights.count; i += 1) heights.array[i * 3 + 1] = shape(base[i * 3], base[i * 3 + 2], t * 0.5);
      heights.needsUpdate = true;
    };
    animateField(0, 0);
  } else {
    // faceted (default): two hairline orbits and a field of dust.
    const ringMaterial = track(new THREE.MeshBasicMaterial({ color: colors.foreground, transparent: true, opacity: 0.35 }));
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.012, 8, 200), ringMaterial);
    ringA.rotation.set(Math.PI * 0.42, 0, 0.2);
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(3.8, 0.008, 8, 200), ringMaterial);
    ringB.rotation.set(Math.PI * 0.55, 0.3, -0.4);
    field.add(ringA, ringB);
    animateField = (dt) => {
      ringA.rotation.z += dt * 0.06;
      ringB.rotation.z -= dt * 0.04;
    };
  }

  // Dust everywhere: depth and parallax for every style.
  const dustCount = small ? 260 : 700;
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i += 1) dustPositions.set([(random() - 0.5) * 22, (random() - 0.5) * 14, -random() * 14 + 3], i * 3);
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(dustGeometry, track(new THREE.PointsMaterial({ color: colors.foreground, size: small ? 0.04 : 0.03, transparent: true, opacity: 0.55, depthWrite: false })));
  root.add(dust);

  const keyCold = new THREE.Color(0xffffff);
  const keyWarm = colors.accent.clone().lerp(new THREE.Color(0xffffff), 0.55);

  /**
   * Apply one frame. `shot` is the blended shot for the current scroll position,
   * `spin` the scroll-linked rotation (radians) and `t` seconds since start.
   */
  function apply(camera, shot, { spin, t, dt, pointer, aspect }) {
    // Narrow screens: centre the object and pull back so the copy stays readable.
    const narrow = aspect < 0.9;
    const objX = narrow ? shot.obj[0] * 0.15 : shot.obj[0] * Math.min(1, aspect / 1.4);
    const objY = narrow ? shot.obj[1] + 1.2 : shot.obj[1];
    camera.position.set(shot.cam[0] + pointer.x * 0.35, shot.cam[1] + pointer.y * 0.2, shot.cam[2] + (narrow ? 2.5 : 0));
    camera.lookAt(shot.look[0], shot.look[1], shot.look[2]);
    protagonist.position.set(objX, objY + Math.sin(t * 0.8) * 0.06, shot.obj[2]);
    protagonist.scale.setScalar(shot.scale * (narrow ? 0.72 : 1));
    model.rotation.y = spin + t * 0.06;
    model.rotation.x = Math.sin(spin * 0.5) * 0.18;
    halo.material.opacity = 0.18 + 0.32 * shot.glow;
    glowLight.intensity = 10 + 16 * shot.glow;
    field.scale.setScalar(0.85 + 0.25 * shot.field);
    field.rotation.y = spin * 0.15;
    for (const { m, base } of fieldMaterials) m.opacity = base * Math.min(1, 0.25 + shot.field * 0.75);
    key.color.copy(keyCold).lerp(keyWarm, shot.warmth);
    dust.rotation.y = spin * 0.05 + t * 0.01;
    animateField(dt, t);
  }

  return { root, apply, protagonist };
}
