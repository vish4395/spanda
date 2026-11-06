// SPDX-License-Identifier: MIT-0
import type { Scene } from '../types';
import { useReveal } from '../hooks/useReveal';
import { stageAttributes } from '../cinema/plan';
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
      {...stageAttributes(scene.id)}
      id={scene.id}
      className="scene scene--chapter"
      aria-labelledby={`${scene.id}-title`}
      data-background={scene.visual.background}
      data-layout={scene.visual.layout ?? 'split'}
      data-mobile={scene.responsive.mobile}
      data-scene-label={scene.accessibility.label}
    >
      <div className="scene__inner">
        <SceneCopy scene={scene} headingLevel={headingLevel} />
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
