import type { Scene } from '../types';
import { useReveal } from '../hooks/useReveal';

interface Props {
  scene: Scene;
  headingLevel: 1 | 2;
  reducedMotion: boolean;
}

export function SceneCopy({ scene, headingLevel, reducedMotion }: Props) {
  const { content } = scene;
  const { ref, className, reveal } = useReveal<HTMLDivElement>(scene.motion.type !== 'none', reducedMotion);
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const external = content.cta?.href.startsWith('https:');
  return (
    <div ref={ref} className={['scene__copy', className].filter(Boolean).join(' ')} data-reveal={reveal}>
      {content.eyebrow && <p className="eyebrow">{content.eyebrow}</p>}
      <Heading id={`${scene.id}-title`}>{content.heading}</Heading>
      {content.body && <p className="scene__body">{content.body}</p>}
      {content.cta && (
        <a className="cta" href={content.cta.href} rel={external ? 'noopener noreferrer' : undefined}>
          {content.cta.label}
        </a>
      )}
      <p className="scene__fallback">{scene.accessibility.fallbackText}</p>
    </div>
  );
}
