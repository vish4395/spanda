import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import type { Scene } from '../types';
import type { WebGLState } from '../hooks/useWebGL';
import { CanvasBoundary } from './HeroScene';
import { SceneCopy } from './SceneCopy';

const SceneCanvas = lazy(() => import('../three/SceneCanvas'));

interface Props {
  scene: Scene;
  headingLevel: 1 | 2;
  reducedMotion: boolean;
  webgl: { state: WebGLState; ready: () => void; fail: () => void };
}

export function ShowcaseScene({ scene, headingLevel, reducedMotion, webgl }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(false);
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !('IntersectionObserver' in window)) return setOnScreen(true);
    const observer = new IntersectionObserver(([entry]) => setOnScreen(Boolean(entry?.isIntersecting)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const object = scene.visual.object ?? 'orb';
  return (
    <section id={scene.id} className="scene scene--model-showcase" aria-labelledby={`${scene.id}-title`} data-mobile={scene.responsive.mobile} data-scene-label={scene.accessibility.label}>
      <div className="scene__inner">
        <SceneCopy scene={scene} headingLevel={headingLevel} reducedMotion={reducedMotion} />
        <div ref={stageRef} className="showcase-stage" data-object={object}>
          {webgl.state !== 'off' && (
            <CanvasBoundary onError={webgl.fail}>
              <Suspense fallback={null}>
                <SceneCanvas variant="showcase" object={object} camera={scene.visual.camera ?? 'orbit'} animate={onScreen && !reducedMotion} onFirstFrame={webgl.ready} onContextLost={webgl.fail} />
              </Suspense>
            </CanvasBoundary>
          )}
        </div>
      </div>
    </section>
  );
}
