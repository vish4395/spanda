// SPDX-License-Identifier: MIT-0
import { variantOf, type Scene } from '../types';
import { stageAttributes } from '../cinema/plan';
import { SceneCopy } from './SceneCopy';

interface Props {
  scene: Scene;
  headingLevel: 1 | 2;
}

/** The protagonist up close: the stage turns it as the pinned scene scrolls. The frame below is the no-WebGL fallback. */
export function ShowcaseScene({ scene, headingLevel }: Props) {
  const object = scene.visual.object ?? 'orb';
  return (
    <section {...stageAttributes(scene.id)} id={scene.id} className="scene scene--model-showcase" aria-labelledby={`${scene.id}-title`} data-variant={variantOf(scene)} data-mobile={scene.responsive.mobile} data-scene-label={scene.accessibility.label}>
      <div className="scene__inner">
        <SceneCopy scene={scene} headingLevel={headingLevel} />
        <div className="showcase-stage" data-object={object} aria-hidden="true" />
      </div>
    </section>
  );
}
