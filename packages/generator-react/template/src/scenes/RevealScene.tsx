// SPDX-License-Identifier: MIT-0
import { variantOf, type SceneItem, type Scene } from '../types';
import { useReveal } from '../hooks/useReveal';
import { stageAttributes } from '../cinema/plan';
import { SceneCopy } from './SceneCopy';

function Step({ item, index, enabled, reducedMotion }: { item: SceneItem; index: number; enabled: boolean; reducedMotion: boolean }) {
  const { ref, className, reveal } = useReveal<HTMLLIElement>(enabled, reducedMotion);
  return (
    <li ref={ref} className={['reveal-step', `reveal-step--${index}`, className].filter(Boolean).join(' ')} data-reveal={reveal}>
      <span className="reveal-step__index" aria-hidden="true">
        {String(index + 1).padStart(2, '0')}
      </span>
      <h3>{item.title}</h3>
      <p>{item.text}</p>
    </li>
  );
}

export function RevealScene({ scene, headingLevel, reducedMotion }: { scene: Scene; headingLevel: 1 | 2; reducedMotion: boolean }) {
  const enabled = scene.motion.type !== 'none';
  return (
    <section {...stageAttributes(scene.id)} id={scene.id} className="scene scene--scroll-reveal" aria-labelledby={`${scene.id}-title`} data-variant={variantOf(scene)} data-mobile={scene.responsive.mobile} data-scene-label={scene.accessibility.label}>
      <div className="scene__inner">
        <SceneCopy scene={scene} headingLevel={headingLevel} />
        <ol className="reveal-steps">
          {(scene.content.items ?? []).map((item, i) => (
            <Step key={`${scene.id}-${i}`} item={item} index={i} enabled={enabled} reducedMotion={reducedMotion} />
          ))}
        </ol>
      </div>
    </section>
  );
}
