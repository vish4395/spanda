import { defineConfig } from 'vitest/config';

// Unit/integration tests only; browser suites run under Playwright (packages/qa, apps/desktop).
export default defineConfig({
  test: {
    projects: ['packages/contracts', 'packages/core', 'packages/generator-html', 'packages/generator-react', 'packages/preview', 'packages/providers', 'packages/licensing', 'packages/storage', 'packages/story-engine', 'packages/skills', 'packages/reference-analyzer', 'apps/desktop'],
  },
});
