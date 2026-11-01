// Minimal, strict frontmatter reader for SKILL.md (a YAML subset: `key: value`
// and `key: [a, b]`). Skill files are untrusted data — no YAML tags, anchors,
// multi-line values or code evaluation are supported on purpose.

export type FrontmatterValue = string | string[];

export interface ParsedSkillFile {
  attributes: Record<string, FrontmatterValue>;
  body: string;
}

const KEY = /^[a-zA-Z][a-zA-Z0-9_-]{0,40}$/;

export function parseFrontmatter(text: string): ParsedSkillFile {
  const normalized = text.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) throw new Error('SKILL.md must start with a --- frontmatter block');
  const end = normalized.indexOf('\n---', 4);
  if (end === -1) throw new Error('Unterminated frontmatter block');
  const header = normalized.slice(4, end);
  const attributes: Record<string, FrontmatterValue> = {};
  for (const [index, rawLine] of header.split('\n').entries()) {
    const line = rawLine.trimEnd();
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon === -1) throw new Error(`Frontmatter line ${index + 1}: expected "key: value"`);
    const key = line.slice(0, colon).trim();
    if (!KEY.test(key)) throw new Error(`Frontmatter line ${index + 1}: invalid key "${key}"`);
    if (key in attributes) throw new Error(`Frontmatter line ${index + 1}: duplicate key "${key}"`);
    const raw = line.slice(colon + 1).trim();
    if (raw.startsWith('[')) {
      if (!raw.endsWith(']')) throw new Error(`Frontmatter line ${index + 1}: unterminated list`);
      attributes[key] = raw
        .slice(1, -1)
        .split(',')
        .map((item) => unquote(item.trim()))
        .filter(Boolean);
    } else {
      if (/^[&*!|>]/.test(raw)) throw new Error(`Frontmatter line ${index + 1}: YAML anchors, tags and block scalars are not supported`);
      attributes[key] = unquote(raw);
    }
  }
  return { attributes, body: normalized.slice(end + 4).replace(/^\n/, '') };
}

function unquote(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return value.slice(1, -1);
  return value;
}
