// SPDX-License-Identifier: MIT-0
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// Production builds get a strict CSP; the dev server needs inline scripts for HMR.
const csp: Plugin = {
  name: 'studio-csp',
  apply: 'build',
  transformIndexHtml() {
    return [
      {
        tag: 'meta',
        attrs: {
          'http-equiv': 'Content-Security-Policy',
          content:
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'",
        },
        injectTo: 'head-prepend',
      },
    ];
  },
};

export default defineConfig({
  base: './',
  plugins: [react(), csp],
  build: {
    chunkSizeWarningLimit: 1200,
  },
});
