// SPDX-License-Identifier: MIT-0
// Types for director.js (shared byte for byte with the HTML export).
import type { Shot } from './stage.js';
export interface Director {
  update(): { shot: Shot; spin: number };
  measure(): void;
  destroy(): void;
}
export function createDirector(options: { sections: HTMLElement[]; reducedMotion: MediaQueryList; rail?: HTMLElement | null }): Director;
