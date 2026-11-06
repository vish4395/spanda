// SPDX-License-Identifier: MIT-0
// The persistent 3D stage: one R3F canvas behind the whole story. The world itself is
// built by cinema/stage.js (shared with the HTML export); R3F owns the render loop.
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Director } from '../cinema/director.js';
import { createWorld, mixShots, type Shot } from '../cinema/stage.js';

interface Props {
  art: string;
  object?: string | undefined;
  director: Director;
  reducedMotion: boolean;
  onFirstFrame: () => void;
  onContextLost: () => void;
}

function readColors() {
  const css = (name: string, fallback: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  return { background: css('--color-bg', '#10141c'), foreground: css('--color-fg', '#f4eee4'), accent: css('--color-accent', '#d9a76c'), secondary: css('--color-secondary', '#7fa7ff') };
}

function World({ art, object, director, reducedMotion, onFirstFrame, small }: Omit<Props, 'onContextLost'> & { small: boolean }) {
  const { gl, camera, invalidate } = useThree();
  const world = useMemo(() => createWorld(THREE, { art, object, colors: readColors(), small, renderer: gl }), [art, object, small, gl]);
  const current = useRef<Shot>(director.update().shot);
  const pointer = useRef({ x: 0, y: 0 });
  const pointerTarget = useRef({ x: 0, y: 0 });
  const first = useRef(true);

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const move = (e: PointerEvent) => {
      pointerTarget.current = { x: (e.clientX / window.innerWidth - 0.5) * 2, y: -(e.clientY / window.innerHeight - 0.5) * 2 };
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, []);

  // Reduced motion renders on demand: one still frame per scroll position.
  useEffect(() => {
    if (!reducedMotion) return;
    const onScroll = () => invalidate();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [reducedMotion, invalidate]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const { shot, spin } = director.update();
    const k = reducedMotion || first.current ? 1 : 1 - Math.exp(-dt * 4.5);
    current.current = mixShots(current.current, shot, k);
    const p = pointer.current;
    p.x += (pointerTarget.current.x - p.x) * k;
    p.y += (pointerTarget.current.y - p.y) * k;
    world.apply(camera, current.current, { spin, t: state.clock.elapsedTime, dt, pointer: p, aspect: (camera as THREE.PerspectiveCamera).aspect });
    if (first.current) {
      first.current = false;
      requestAnimationFrame(onFirstFrame);
    }
  });

  return <primitive object={world.root} />;
}

export default function Stage({ onContextLost, ...props }: Props) {
  const small = useMemo(() => window.matchMedia('(max-width: 767px)').matches, []);
  return (
    <Canvas
      className="stage"
      // R3F sets an inline position: relative on its wrapper; the stage must stay fixed behind the page.
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
      aria-hidden="true"
      frameloop={props.reducedMotion ? 'demand' : 'always'}
      dpr={[1, small ? 1.5 : 1.75]}
      camera={{ fov: 36, near: 0.1, far: 120, position: [0, 0, 9] }}
      gl={{ antialias: !small, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.domElement.addEventListener('webglcontextlost', (event) => {
          event.preventDefault();
          onContextLost();
        });
      }}
    >
      <World {...props} small={small} />
    </Canvas>
  );
}
