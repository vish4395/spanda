// SPDX-License-Identifier: MIT-0
import { useCallback, useEffect, useRef, useState } from 'react';
import { variantOf, type Scene } from '../types';
import { SceneCopy } from './SceneCopy';

export function GalleryScene({ scene, headingLevel, reducedMotion }: { scene: Scene; headingLevel: 1 | 2; reducedMotion: boolean }) {
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    // Tolerance covers snap/padding rounding at either end.
    setEdges({ start: el.scrollLeft <= 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [update]);

  const scroll = (direction: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const step = el.firstElementChild ? el.firstElementChild.getBoundingClientRect().width + 16 : el.clientWidth;
    el.scrollBy({ left: direction * step, behavior: reducedMotion ? 'auto' : 'smooth' });
  };

  const carousel = variantOf(scene) === 'carousel';
  return (
    <section id={scene.id} className="scene scene--gallery" aria-labelledby={`${scene.id}-title`} data-variant={variantOf(scene)} data-mobile={scene.responsive.mobile} data-scene-label={scene.accessibility.label}>
      <div className="scene__inner">
        <SceneCopy scene={scene} headingLevel={headingLevel} reducedMotion={reducedMotion} />
        <div className="gallery">
          <ul
            ref={track}
            className="gallery__track"
            tabIndex={carousel ? 0 : undefined}
            aria-label={carousel ? `${scene.content.heading} — scroll horizontally or use the buttons` : undefined}
            onScroll={carousel ? update : undefined}
          >
            {(scene.content.items ?? []).map((item, i) => (
              <li key={`${scene.id}-${i}`} className="gallery__item">
                <article>
                  <div className={`gallery__art gallery__art--${i}`} aria-hidden="true" />
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              </li>
            ))}
          </ul>
          {carousel && (
          <div className="gallery__controls">
            <button type="button" className="gallery__button" aria-label="Previous items" disabled={edges.start} onClick={() => scroll(-1)}>
              ‹
            </button>
            <button type="button" className="gallery__button" aria-label="Next items" disabled={edges.end} onClick={() => scroll(1)}>
              ›
            </button>
          </div>
          )}
        </div>
      </div>
    </section>
  );
}
