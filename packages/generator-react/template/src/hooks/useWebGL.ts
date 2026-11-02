// SPDX-License-Identifier: MIT-0
import { useCallback, useEffect, useState } from 'react';

export type WebGLState = 'loading' | 'on' | 'off' | 'none';

function webglAvailable(): boolean {
  try {
    const probe = document.createElement('canvas');
    return Boolean(probe.getContext('webgl2') || probe.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Tracks whether the decorative 3D layer is usable and mirrors it onto <html data-webgl>. */
export function useWebGL(hasScenes: boolean) {
  // 'none': the design has no 3D, so nothing failed and no fallback captions are shown.
  const [state, setState] = useState<WebGLState>(() => (!hasScenes ? 'none' : webglAvailable() ? 'loading' : 'off'));
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.webgl = state;
    if (state !== 'loading') root.dataset.ready = 'true';
  }, [state]);
  const ready = useCallback(() => setState((s) => (s === 'loading' ? 'on' : s)), []);
  const fail = useCallback(() => setState('off'), []);
  return { state, ready, fail };
}
