// SPDX-License-Identifier: MIT-0
// Decorative, procedural 3D scenes (original geometry; no external models or textures).
// variant 'hero': one of the design language's hero arts (faceted, rings, particles, ribbons,
// terrain). variant 'showcase': one object preset, centred.
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, CatmullRomCurve3, Color, PlaneGeometry, Vector2, Vector3, type BufferAttribute, type Group, type Mesh, type Points } from 'three';

function cssColor(name: string, fallback: string): Color {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return new Color(value || fallback);
}

// Deterministic PRNG so the particle layout is identical on every load.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function useSmallScreen() {
  return useMemo(() => window.matchMedia('(max-width: 767px)').matches, []);
}

type ObjectPreset = 'monolith' | 'vessel' | 'orb';
type CameraPreset = 'orbit' | 'front' | 'low';

const CAMERAS: Record<CameraPreset, { position: [number, number, number]; spin: number }> = {
  orbit: { position: [0, 0.4, 7], spin: 0.35 },
  front: { position: [0, 0, 7], spin: 0.08 },
  low: { position: [0, -1.6, 6.6], spin: 0.2 },
};

const VESSEL_PROFILE = [
  [0.0, -1.5], [0.85, -1.45], [1.05, -1.0], [0.9, -0.2], [0.55, 0.6], [0.45, 1.2], [0.62, 1.55], [0.58, 1.6],
].map(([x, y]) => new Vector2(x, y));

function ShowcaseObject({ preset, color, spin }: { preset: ObjectPreset; color: Color; spin: number }) {
  const mesh = useRef<Mesh>(null);
  const { size } = useThree();
  useFrame((_, delta) => {
    if (mesh.current) mesh.current.rotation.y += Math.min(delta, 0.1) * spin;
  });
  const scale = Math.min(1, (size.width / size.height) * 0.95);
  return (
    <mesh ref={mesh} scale={scale} rotation={preset === 'monolith' ? [0.08, 0.5, 0.04] : [0, 0, 0]}>
      {preset === 'monolith' && <boxGeometry args={[1.3, 2.8, 0.55]} />}
      {preset === 'vessel' && <latheGeometry args={[VESSEL_PROFILE, 14]} />}
      {preset === 'orb' && <icosahedronGeometry args={[1.5, 3]} />}
      <meshStandardMaterial color={color} flatShading roughness={0.45} metalness={0.3} />
    </mesh>
  );
}

function CameraRig({ position }: { position: [number, number, number] }) {
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    camera.position.set(...position);
    camera.lookAt(0, 0, 0);
  }, [camera, position]);
  return null;
}

type Palette = { accent: Color; fg: Color; bg: Color; secondary: Color };
export type HeroArt = 'faceted' | 'rings' | 'particles' | 'ribbons' | 'terrain';

/** Objects sit beside the copy on wide screens when the hero composition leaves room. */
function useHeroPlacement(composition: string): { position: [number, number, number]; scale: number } {
  const { size } = useThree();
  const wide = size.width / size.height > 1.1;
  const beside = wide && (composition === 'bottom-left' || composition === 'split');
  return { position: [beside ? 2.6 : 0, beside ? 0.4 : wide ? 0.2 : 1.6, 0], scale: beside ? 1 : wide ? 0.9 : 0.72 };
}

function Faceted({ colors, small, composition }: { colors: Palette; small: boolean; composition: string }) {
  const stone = useRef<Mesh>(null);
  const ringA = useRef<Mesh>(null);
  const ringB = useRef<Mesh>(null);
  const dust = useRef<Points>(null);
  const placement = useHeroPlacement(composition);

  const positions = useMemo(() => {
    const random = mulberry32(7);
    const count = small ? 180 : 420;
    const array = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const radius = 3 + random() * 5;
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      array[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      array[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.6;
      array[i * 3 + 2] = radius * Math.cos(phi) * 0.5;
    }
    return array;
  }, [small]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    if (stone.current) {
      stone.current.rotation.y += dt * 0.18;
      stone.current.rotation.x += dt * 0.05;
    }
    if (ringA.current) ringA.current.rotation.z += dt * 0.06;
    if (ringB.current) ringB.current.rotation.z -= dt * 0.04;
    if (dust.current) dust.current.rotation.y += dt * 0.015;
  });

  return (
    <>
      <group position={placement.position} scale={placement.scale}>
        <mesh ref={stone}>
          <icosahedronGeometry args={[1.7, 1]} />
          <meshStandardMaterial color={colors.accent} flatShading roughness={0.45} metalness={0.3} />
        </mesh>
        <mesh ref={ringA} rotation={[Math.PI * 0.42, 0, 0.2]}>
          <torusGeometry args={[2.8, 0.012, 8, 180]} />
          <meshBasicMaterial color={colors.fg} transparent opacity={0.4} />
        </mesh>
        <mesh ref={ringB} rotation={[Math.PI * 0.55, 0.3, -0.4]}>
          <torusGeometry args={[3.4, 0.008, 8, 180]} />
          <meshBasicMaterial color={colors.fg} transparent opacity={0.4} />
        </mesh>
      </group>
      <points ref={dust}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial color={colors.fg} size={small ? 0.035 : 0.03} transparent opacity={0.7} sizeAttenuation />
      </points>
    </>
  );
}

function Rings({ colors, composition }: { colors: Palette; composition: string }) {
  const group = useRef<Group>(null);
  const placement = useHeroPlacement(composition);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    group.current?.children.forEach((child, i) => {
      if (i === 0) child.rotation.y += dt * 0.2;
      else child.rotation.z += dt * (0.05 + (i - 1) * 0.015) * ((i - 1) % 2 ? -1 : 1);
    });
  });
  return (
    <group ref={group} position={placement.position} scale={placement.scale}>
      <mesh>
        <icosahedronGeometry args={[0.9, 4]} />
        <meshStandardMaterial color={colors.accent} roughness={0.3} metalness={0.5} />
      </mesh>
      {[1.6, 2.2, 2.8, 3.4, 4.0].map((radius, i) => (
        <mesh key={radius} rotation={[Math.PI * (0.38 + i * 0.05), i * 0.4, 0]}>
          <torusGeometry args={[radius, 0.012 + i * 0.002, 8, 220]} />
          <meshBasicMaterial color={i % 2 ? colors.secondary : colors.fg} transparent opacity={0.55 - i * 0.07} />
        </mesh>
      ))}
    </group>
  );
}

function Particles({ colors, small }: { colors: Palette; small: boolean }) {
  const galaxy = useRef<Points>(null);
  const { size } = useThree();
  const wide = size.width / size.height > 1.1;
  const [positions, tints] = useMemo(() => {
    const random = mulberry32(7);
    const count = small ? 1400 : 3600;
    const p = new Float32Array(count * 3);
    const c = new Float32Array(count * 3);
    const mixed = new Color();
    for (let i = 0; i < count; i += 1) {
      // Spiral galaxy: three arms, denser at the core.
      const arm = (i % 3) * ((Math.PI * 2) / 3);
      const r = Math.pow(random(), 1.6) * 5.5;
      const angle = arm + r * 0.9 + (random() - 0.5) * 0.6;
      p[i * 3] = Math.cos(angle) * r;
      p[i * 3 + 1] = (random() - 0.5) * 0.5 * (1.2 - r / 6);
      p[i * 3 + 2] = Math.sin(angle) * r;
      mixed.copy(colors.accent).lerp(colors.secondary, r / 5.5);
      c.set([mixed.r, mixed.g, mixed.b], i * 3);
    }
    return [p, c];
  }, [small, colors]);
  useFrame((_, delta) => {
    if (galaxy.current) galaxy.current.rotation.y += Math.min(delta, 0.1) * 0.06;
  });
  return (
    <group position={[0, 0.3, 0]} scale={wide ? 1 : 0.8}>
      <points ref={galaxy} rotation={[0.5, 0, 0]}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[tints, 3]} />
        </bufferGeometry>
        <pointsMaterial size={small ? 0.05 : 0.04} vertexColors transparent opacity={0.9} depthWrite={false} blending={AdditiveBlending} />
      </points>
    </group>
  );
}

function Ribbons({ colors }: { colors: Palette }) {
  const group = useRef<Group>(null);
  const { size } = useThree();
  const wide = size.width / size.height > 1.1;
  const curves = useMemo(
    () =>
      [0, 1, 2, 3].map((k) => {
        const points: Vector3[] = [];
        for (let i = 0; i <= 12; i += 1) {
          const t = i / 12;
          points.push(new Vector3((t - 0.5) * 12, Math.sin(t * Math.PI * 2 + k) * (0.8 + k * 0.25), Math.cos(t * Math.PI * 1.5 + k) * 1.2 - k * 0.4));
        }
        return new CatmullRomCurve3(points);
      }),
    [],
  );
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    elapsed.current += Math.min(delta, 0.1);
    const t = elapsed.current;
    group.current?.children.forEach((tube, k) => {
      tube.rotation.x = Math.sin(t * 0.25 + k) * 0.25;
      tube.position.y = Math.sin(t * 0.4 + k * 1.3) * 0.15;
    });
  });
  return (
    <group ref={group} scale={wide ? 1 : 0.8}>
      {curves.map((curve, k) => (
        <mesh key={k} rotation={[0, 0, k * 0.12]}>
          <tubeGeometry args={[curve, 160, 0.05 + k * 0.025, 12, false]} />
          <meshStandardMaterial color={k % 2 ? colors.secondary : colors.accent} roughness={0.35} metalness={0.4} emissive={k % 2 ? colors.secondary : colors.accent} emissiveIntensity={0.15} />
        </mesh>
      ))}
    </group>
  );
}

function Terrain({ colors, small }: { colors: Palette; small: boolean }) {
  const { size } = useThree();
  const wide = size.width / size.height > 1.1;
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(30, 18, small ? 60 : 110, small ? 36 : 66);
    g.rotateX(-Math.PI / 2);
    return g;
  }, [small]);
  const base = useMemo(() => Float32Array.from(geometry.attributes.position!.array), [geometry]);
  const elapsed = useRef(0);
  const shape = (x: number, z: number, t: number) => Math.sin(x * 0.45 + t) * 0.45 + Math.cos(z * 0.6 - t * 0.8) * 0.35 + Math.sin((x + z) * 0.2) * 0.6 * Math.min(1, Math.abs(x) / 6);
  const update = (t: number) => {
    const heights = geometry.attributes.position as BufferAttribute;
    for (let i = 0; i < heights.count; i += 1) heights.array[i * 3 + 1] = shape(base[i * 3]!, base[i * 3 + 2]!, t * 0.6);
    heights.needsUpdate = true;
  };
  useFrame((_, delta) => {
    elapsed.current += Math.min(delta, 0.1);
    update(elapsed.current);
  });
  return (
    <group scale={wide ? 1 : 0.8}>
      <mesh geometry={geometry} position={[0, -2.2, -2]}>
        <meshBasicMaterial color={colors.accent} wireframe transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, 1.4, -10]}>
        <circleGeometry args={[1.6, 64]} />
        <meshBasicMaterial color={colors.secondary} />
      </mesh>
    </group>
  );
}

function HeroScene3D({ art, colors, small, composition }: { art: HeroArt; colors: Palette; small: boolean; composition: string }) {
  switch (art) {
    case 'rings':
      return <Rings colors={colors} composition={composition} />;
    case 'particles':
      return <Particles colors={colors} small={small} />;
    case 'ribbons':
      return <Ribbons colors={colors} />;
    case 'terrain':
      return <Terrain colors={colors} small={small} />;
    default:
      return <Faceted colors={colors} small={small} composition={composition} />;
  }
}

function FirstFrame({ onFirstFrame }: { onFirstFrame: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (!done.current) {
      done.current = true;
      // Report after the frame has been submitted.
      requestAnimationFrame(onFirstFrame);
    }
  });
  return null;
}

/** Re-render once when animation pauses so the still frame reflects the latest layout. */
function Invalidator({ animate }: { animate: boolean }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (!animate) invalidate();
  }, [animate, invalidate]);
  return null;
}

interface Props {
  animate: boolean;
  onFirstFrame: () => void;
  onContextLost: () => void;
  variant?: 'hero' | 'showcase';
  art?: HeroArt;
  composition?: string;
  object?: ObjectPreset;
  camera?: CameraPreset;
}

export default function SceneCanvas({ animate, onFirstFrame, onContextLost, variant = 'hero', art = 'faceted', composition = 'bottom-left', object = 'orb', camera = 'orbit' }: Props) {
  const showcase = variant === 'showcase';
  const cameraPreset = CAMERAS[camera];
  const small = useSmallScreen();
  const colors = useMemo(
    () => ({ accent: cssColor('--color-accent', '#d9a76c'), fg: cssColor('--color-fg', '#f4eee4'), bg: cssColor('--color-bg', '#10141c'), secondary: cssColor('--color-secondary', '#7fa7ff') }),
    [],
  );
  // R3F sets inline `position: relative` on its own wrapper, so positioning lives on ours.
  return (
    <div className="scene__canvas" aria-hidden="true">
      <Canvas
        dpr={[1, small ? 1.5 : 2]}
        frameloop={animate ? 'always' : 'demand'}
        gl={{ antialias: !small, alpha: true, powerPreference: 'low-power' }}
        camera={{ fov: 38, position: [0, 0, 10], near: 0.1, far: 100 }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (event) => {
            event.preventDefault();
            onContextLost();
          });
        }}
      >
        <hemisphereLight args={[colors.fg, colors.bg, 0.9]} />
        <directionalLight position={[4, 5, 6]} intensity={2.4} />
        <pointLight position={[-3, -2, 3]} color={colors.accent} intensity={30} distance={20} />
        {showcase ? (
        <>
          <CameraRig position={cameraPreset.position} />
          <ShowcaseObject preset={object} color={colors.accent} spin={cameraPreset.spin} />
        </>
      ) : (
        <HeroScene3D art={art} colors={colors} small={small} composition={composition} />
      )}
        <FirstFrame onFirstFrame={onFirstFrame} />
        <Invalidator animate={animate} />
      </Canvas>
    </div>
  );
}
