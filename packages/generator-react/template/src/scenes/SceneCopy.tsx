// SPDX-License-Identifier: MIT-0
import type { CSSProperties } from 'react';
import type { Scene } from '../types';

interface Props {
  scene: Scene;
  headingLevel: 1 | 2;
}

/** Split a headline into words so scroll can reveal them one by one (the text stays real). */
function Words({ text }: { text: string }) {
  let index = 0;
  return (
    <>
      {text.split(/(\s+)/).map((part, i) =>
        /^\s+$/.test(part) || !part ? (
          part
        ) : (
          <span key={i} className="word" style={{ '--i': index++ } as CSSProperties}>
            {part}
          </span>
        ),
      )}
    </>
  );
}

export function SceneCopy({ scene, headingLevel }: Props) {
  const { content } = scene;
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const external = content.cta?.href.startsWith('https:');
  return (
    <div className="scene__copy" data-scrub={scene.motion.type !== 'none' ? '' : undefined}>
      {content.eyebrow && <p className="eyebrow">{content.eyebrow}</p>}
      <Heading id={`${scene.id}-title`}>
        <Words text={content.heading} />
      </Heading>
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
