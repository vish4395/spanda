// SPDX-License-Identifier: MIT-0
// Types for stage.js (shared byte for byte with the HTML export).
export interface Shot {
  cam: number[];
  look: number[];
  obj: number[];
  scale: number;
  field: number;
  glow: number;
  warmth: number;
}
export const SHOTS: Record<string, Shot>;
export function mixShots(a: Shot, b: Shot, t: number): Shot;
export interface World {
  root: import('three').Group;
  apply(camera: import('three').Camera, shot: Shot, frame: { spin: number; t: number; dt: number; pointer: { x: number; y: number }; aspect: number }): void;
}
export function createWorld(
  three: typeof import('three'),
  options: { art: string; object?: string; colors: { background: string; foreground: string; accent: string; secondary: string }; small: boolean; renderer?: import('three').WebGLRenderer },
): World;
