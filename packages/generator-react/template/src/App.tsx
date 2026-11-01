import storyJson from './story-spec.json';
import type { Scene, StorySpec } from './types';
import { useReducedMotion } from './hooks/useReducedMotion';
import { useWebGL } from './hooks/useWebGL';
import { ChapterScene } from './scenes/ChapterScene';
import { CtaScene } from './scenes/CtaScene';
import { GalleryScene } from './scenes/GalleryScene';
import { HeroScene } from './scenes/HeroScene';
import { RevealScene } from './scenes/RevealScene';
import { ShowcaseScene } from './scenes/ShowcaseScene';

const story = storyJson as StorySpec;

export function App() {
  const scenes = story.pages[0]?.scenes ?? [];
  const reducedMotion = useReducedMotion();
  const webgl = useWebGL(scenes.some((s) => s.type === 'hero' || s.type === 'model-showcase'));

  const renderScene = (scene: Scene, index: number) => {
    const headingLevel = index === 0 ? 1 : 2;
    switch (scene.type) {
      case 'hero':
        return <HeroScene key={scene.id} scene={scene} headingLevel={headingLevel} reducedMotion={reducedMotion} webgl={webgl} />;
      case 'chapter':
        return <ChapterScene key={scene.id} scene={scene} headingLevel={headingLevel} reducedMotion={reducedMotion} />;
      case 'scroll-reveal':
        return <RevealScene key={scene.id} scene={scene} headingLevel={headingLevel} reducedMotion={reducedMotion} />;
      case 'model-showcase':
        return <ShowcaseScene key={scene.id} scene={scene} headingLevel={headingLevel} reducedMotion={reducedMotion} webgl={webgl} />;
      case 'gallery':
        return <GalleryScene key={scene.id} scene={scene} headingLevel={headingLevel} reducedMotion={reducedMotion} />;
      case 'cta':
        return <CtaScene key={scene.id} scene={scene} headingLevel={headingLevel} reducedMotion={reducedMotion} />;
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
      <main id="main">{scenes.map(renderScene)}</main>
      <footer className="site-footer">
        <p>{story.project.name}</p>
      </footer>
    </>
  );
}
