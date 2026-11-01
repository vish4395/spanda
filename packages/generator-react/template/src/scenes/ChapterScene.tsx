import type { Scene } from '../types';
import { useReveal } from '../hooks/useReveal';
import { SceneCopy } from './SceneCopy';

interface Props {
  scene: Scene;
  headingLevel: 1 | 2;
  reducedMotion: boolean;
}

export function ChapterScene({ scene, headingLevel, reducedMotion }: Props) {
  const visual = useReveal<HTMLDivElement>(scene.motion.type !== 'none', reducedMotion);
  return (
    <section
      id={scene.id}
      className="scene scene--chapter"
      aria-labelledby={`${scene.id}-title`}
      data-background={scene.visual.background}
      data-layout={scene.visual.layout ?? 'split'}
      data-mobile={scene.responsive.mobile}
      data-scene-label={scene.accessibility.label}
    >
      <div className="scene__inner">
        <SceneCopy scene={scene} headingLevel={headingLevel} reducedMotion={reducedMotion} />
        <div
          ref={visual.ref}
          className={['chapter-visual', visual.className].filter(Boolean).join(' ')}
          role="img"
          aria-label={scene.accessibility.fallbackText}
          data-reveal={visual.reveal}
        />
      </div>
    </section>
  );
}
