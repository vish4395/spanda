import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findUnsupportedScenes, validateStorySpec, type StorySpec } from '../src/index.ts';
import { serializeJsonSchema } from '../src/json-schema.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const example = JSON.parse(readFileSync(`${root}schemas/story-spec.example.json`, 'utf8')) as StorySpec;
const clone = (): StorySpec => structuredClone(example);

describe('validateStorySpec', () => {
  it('accepts the sample spec', () => {
    const result = validateStorySpec(example);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('rejects unknown schema versions', () => {
    const result = validateStorySpec({ ...clone(), schemaVersion: '9.9.9' });
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.path).toBe('schemaVersion');
  });

  it('rejects CSS injection through colors and fonts', () => {
    const spec = clone() as unknown as { design: { colors: Record<string, string>; typography: Record<string, string> } };
    spec.design.colors.accent = 'red;}body{display:none';
    spec.design.typography.heading = 'x"; } * { color: red';
    const result = validateStorySpec(spec);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.path)).toEqual(['design.colors.accent', 'design.typography.heading']);
  });

  it('rejects javascript: links and unknown content keys (no executable content)', () => {
    const spec = clone();
    const content = spec.pages[0]!.scenes[0]!.content as Record<string, unknown>;
    content.cta = { label: 'Go', href: 'javascript:alert(1)' };
    content.script = 'alert(1)';
    const result = validateStorySpec(spec);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.path).sort()).toEqual(['pages.0.scenes.0.content', 'pages.0.scenes.0.content.cta.href']);
  });

  it('rejects duplicate ids and dangling model references', () => {
    const spec = clone();
    spec.pages[0]!.scenes[1]!.id = 'hero-01';
    spec.pages[0]!.scenes[0]!.visual.modelAssetId = 'missing-model';
    const result = validateStorySpec(spec);
    expect(result.ok).toBe(false);
    const messages = result.issues.map((i) => i.message).join('\n');
    expect(messages).toContain('Duplicate id "hero-01"');
    expect(messages).toContain('Unknown asset "missing-model"');
  });

  it('rejects asset paths that escape the project', () => {
    const spec = clone();
    spec.assets.push({ id: 'evil', kind: 'image', path: '../../etc/passwd', rightsStatus: 'unknown' });
    spec.assets.push({ id: 'evil-win', kind: 'image', path: 'C:\\Windows\\win.ini', rightsStatus: 'unknown' });
    const result = validateStorySpec(spec);
    expect(result.issues.map((i) => i.path)).toEqual(['assets.0.path', 'assets.1.path']);
  });
});

describe('findUnsupportedScenes', () => {
  it('reports unsupported primitives instead of silently omitting them', () => {
    const spec = clone();
    spec.pages[0]!.scenes[1]!.type = 'gallery';
    expect(findUnsupportedScenes(spec, ['hero', 'chapter'])).toEqual([
      { path: 'pages.0.scenes.1.type', message: 'Scene type "gallery" is not supported yet (supported: hero, chapter)' },
    ]);
  });
});

describe('JSON schema', () => {
  it('committed schemas/story-spec.schema.json matches the Zod source', () => {
    expect(readFileSync(`${root}schemas/story-spec.schema.json`, 'utf8')).toBe(serializeJsonSchema());
  });
});
