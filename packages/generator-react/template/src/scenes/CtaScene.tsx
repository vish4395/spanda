// SPDX-License-Identifier: MIT-0
import { variantOf, type Scene } from '../types';
import { stageAttributes } from '../cinema/plan';
import { SceneCopy } from './SceneCopy';

export function CtaScene({ scene, headingLevel }: { scene: Scene; headingLevel: 1 | 2 }) {
  return (
    <section {...stageAttributes(scene.id)} id={scene.id} className="scene scene--cta" aria-labelledby={`${scene.id}-title`} data-variant={variantOf(scene)} data-mobile={scene.responsive.mobile} data-scene-label={scene.accessibility.label}>
      <div className="scene__inner">
        <SceneCopy scene={scene} headingLevel={headingLevel} />
      </div>
    </section>
  );
}
