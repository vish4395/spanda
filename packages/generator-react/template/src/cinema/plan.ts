// SPDX-License-Identifier: MIT-0
// Stage directions written by the studio (see cinema.json): each scene's camera shot and
// whether it pins while the camera moves.
import plan from '../cinema.json';

export const protagonist: string | undefined = plan.protagonist ?? undefined;

export function stageAttributes(sceneId: string): { 'data-shot': string; 'data-pin'?: '' } {
  const entry = (plan.scenes as Record<string, { shot: string; pin: boolean } | undefined>)[sceneId];
  return { 'data-shot': entry?.shot ?? 'full', ...(entry?.pin ? { 'data-pin': '' as const } : {}) };
}
