// Decorative, procedural hero scene (original geometry; no external models or textures).
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Color, type Group, type Mesh, type Points } from 'three';

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

function Monument({ colors, small }: { colors: { accent: Color; fg: Color }; small: boolean }) {
  const group = useRef<Group>(null);
  const stone = useRef<Mesh>(null);
  const ringA = useRef<Mesh>(null);
  const ringB = useRef<Mesh>(null);
  const dust = useRef<Points>(null);
  const { size } = useThree();
  const wide = size.width / size.height > 1.1;

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
      <group ref={group} position={[wide ? 2.6 : 0, wide ? 0.4 : 1.6, 0]} scale={wide ? 1 : 0.72}>
        <mesh ref={stone}>
          <icosahedronGeometry args={[1.7, 1]} />
          <meshStandardMaterial color={colors.accent} flatShading roughness={0.5} metalness={0.3} />
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
}

export default function HeroCanvas({ animate, onFirstFrame, onContextLost }: Props) {
  const small = useSmallScreen();
  const colors = useMemo(
    () => ({ accent: cssColor('--color-accent', '#d9a76c'), fg: cssColor('--color-fg', '#f4eee4'), bg: cssColor('--color-bg', '#10141c') }),
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
        <Monument colors={colors} small={small} />
        <FirstFrame onFirstFrame={onFirstFrame} />
        <Invalidator animate={animate} />
      </Canvas>
    </div>
  );
}
