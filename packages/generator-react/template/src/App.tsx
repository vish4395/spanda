// SPDX-License-Identifier: MIT-0
import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react';
import storyJson from './story-spec.json';
import type { Scene, StorySpec } from './types';
import { createDirector, type Director } from './cinema/director.js';
import { protagonist } from './cinema/plan';
import { useReducedMotion } from './hooks/useReducedMotion';
import { useWebGL } from './hooks/useWebGL';
import { ChapterScene } from './scenes/ChapterScene';
import { CtaScene } from './scenes/CtaScene';
import { GalleryScene } from './scenes/GalleryScene';
import { HeroScene } from './scenes/HeroScene';
import { RevealScene } from './scenes/RevealScene';
import { ShowcaseScene } from './scenes/ShowcaseScene';

const Stage = lazy(() => import('./three/Stage'));
const story = storyJson as StorySpec;

class StageBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.warn('3D stage unavailable, showing static fallback.', error);
    this.props.onError();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function App() {
  const scenes = story.pages[0]?.scenes ?? [];
  const reducedMotion = useReducedMotion();
  const art = story.design.style.heroArt;
  const webgl = useWebGL(art !== 'none');
  const mainRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const [director, setDirector] = useState<Director | null>(null);

  // The director scrubs typography on scroll even when there is no 3D stage.
  useEffect(() => {
    const sections = Array.from(mainRef.current?.querySelectorAll<HTMLElement>(':scope > section[data-shot]') ?? []);
    const next = createDirector({ sections, reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)'), rail: railRef.current });
    let pending = false;
    const onScroll = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        next.update();
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    next.update();
    setDirector(next);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      next.destroy();
    };
  }, []);

  const renderScene = (scene: Scene, index: number) => {
    const headingLevel = index === 0 ? 1 : 2;
    switch (scene.type) {
      case 'hero':
        return <HeroScene key={scene.id} scene={scene} headingLevel={headingLevel} />;
      case 'chapter':
        return <ChapterScene key={scene.id} scene={scene} headingLevel={headingLevel} reducedMotion={reducedMotion} />;
      case 'scroll-reveal':
        return <RevealScene key={scene.id} scene={scene} headingLevel={headingLevel} reducedMotion={reducedMotion} />;
      case 'model-showcase':
        return <ShowcaseScene key={scene.id} scene={scene} headingLevel={headingLevel} />;
      case 'gallery':
        return <GalleryScene key={scene.id} scene={scene} headingLevel={headingLevel} reducedMotion={reducedMotion} />;
      case 'cta':
        return <CtaScene key={scene.id} scene={scene} headingLevel={headingLevel} />;
    }
  };

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <span className="brand">{story.project.name}</span>
      </header>
      {director && webgl.state !== 'off' && webgl.state !== 'none' && (
        <StageBoundary onError={webgl.fail}>
          <Suspense fallback={null}>
            <Stage art={art} object={protagonist} director={director} reducedMotion={reducedMotion} onFirstFrame={webgl.ready} onContextLost={webgl.fail} />
          </Suspense>
        </StageBoundary>
      )}
      <div className="page-progress" aria-hidden="true" />
      {scenes.length >= 3 && (
        <nav ref={railRef} className="story-rail" aria-label="Story chapters">
          <ol>
            {scenes.map((scene) => (
              <li key={scene.id}>
                <a href={`#${scene.id}`}>
                  <span className="story-rail__label">{scene.content.heading}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <main id="main" ref={mainRef}>
        {scenes.map(renderScene)}
      </main>
      <footer className="site-footer">
        <p>{story.project.name}</p>
      </footer>
    </>
  );
}
