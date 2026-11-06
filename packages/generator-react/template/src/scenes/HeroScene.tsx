// SPDX-License-Identifier: MIT-0
import { variantOf, type Scene } from '../types';
import { stageAttributes } from '../cinema/plan';
import { SceneCopy } from './SceneCopy';

interface Props {
  scene: Scene;
  headingLevel: 1 | 2;
}

/** The opening shot. Its 3D lives on the persistent stage (three/Stage.tsx), so the story can return to it at the end. */
export function HeroScene({ scene, headingLevel }: Props) {
  return (
    <section
      {...stageAttributes(scene.id)}
      id={scene.id}
      className="scene scene--hero"
      aria-labelledby={`${scene.id}-title`}
      data-background={scene.visual.background}
      data-variant={variantOf(scene)}
      data-mobile={scene.responsive.mobile}
      data-scene-label={scene.accessibility.label}
    >
      <div className="scene__inner">
        <SceneCopy scene={scene} headingLevel={headingLevel} />
      </div>
    </section>
  );
}
