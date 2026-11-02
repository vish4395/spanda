// SPDX-License-Identifier: MIT-0
import { variantOf, type Scene } from '../types';
import { SceneCopy } from './SceneCopy';

export function CtaScene({ scene, headingLevel, reducedMotion }: { scene: Scene; headingLevel: 1 | 2; reducedMotion: boolean }) {
  return (
    <section id={scene.id} className="scene scene--cta" aria-labelledby={`${scene.id}-title`} data-variant={variantOf(scene)} data-mobile={scene.responsive.mobile} data-scene-label={scene.accessibility.label}>
      <div className="scene__inner">
        <SceneCopy scene={scene} headingLevel={headingLevel} reducedMotion={reducedMotion} />
      </div>
    </section>
  );
}
