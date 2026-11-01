import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Scene } from '../types';
import type { WebGLState } from '../hooks/useWebGL';
import { SceneCopy } from './SceneCopy';

const SceneCanvas = lazy(() => import('../three/SceneCanvas'));

export class CanvasBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.warn('3D layer unavailable, showing static fallback.', error);
    this.props.onError();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

interface Props {
  scene: Scene;
  headingLevel: 1 | 2;
  reducedMotion: boolean;
  webgl: { state: WebGLState; ready: () => void; fail: () => void };
}

export function HeroScene({ scene, headingLevel, reducedMotion, webgl }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(Boolean(entry?.isIntersecting)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id={scene.id}
      className="scene scene--hero"
      aria-labelledby={`${scene.id}-title`}
      data-background={scene.visual.background}
      data-mobile={scene.responsive.mobile}
      data-scene-label={scene.accessibility.label}
    >
      {webgl.state !== 'off' && (
        <CanvasBoundary onError={webgl.fail}>
          <Suspense fallback={null}>
            <SceneCanvas animate={onScreen && !reducedMotion} onFirstFrame={webgl.ready} onContextLost={webgl.fail} />
          </Suspense>
        </CanvasBoundary>
      )}
      <div className="scene__inner">
        <SceneCopy scene={scene} headingLevel={headingLevel} reducedMotion={reducedMotion} />
      </div>
    </section>
  );
}
