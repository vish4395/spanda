import { z } from 'zod';

// StorySpec is untrusted input (it may come from an AI provider or a user file).
// Every string that reaches generated CSS/HTML/URLs is constrained here so the
// generators never have to interpret free-form markup or code.

export const STORY_SPEC_VERSION = '0.2.0';

export const SCENE_TYPES = [
  'hero',
  'scroll-reveal',
  'model-showcase',
  'chapter',
  'gallery',
  'cta',
] as const;
export type SceneType = (typeof SCENE_TYPES)[number];

export const BROWSER_ENGINES = ['chromium', 'firefox', 'webkit'] as const;

const StableId = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'IDs must be lowercase letters, digits and hyphens');

const CssColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'Colors must be hex (#rgb, #rgba, #rrggbb or #rrggbbaa)');

// Font stacks are written into CSS; quotes, semicolons and braces are rejected.
const FontStack = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9 ,-]+$/, 'Font stacks may only contain letters, digits, spaces, commas and hyphens');

const PlainText = (max: number) => z.string().max(max);

// Links rendered into generated sites: in-page anchors, https and mailto only.
const SafeHref = z
  .string()
  .max(2048)
  .regex(/^(?:#[A-Za-z0-9_-]*|https:\/\/[^\s"'<>]+|mailto:[^\s"'<>]+)$/, 'Links must be #anchors, https:// or mailto:');

// Asset paths are project-relative and are re-checked against the project root on write.
const RelativeAssetPath = z
  .string()
  .min(1)
  .max(260)
  .refine(
    (p) => !p.startsWith('/') && !p.includes('\\') && !/^[A-Za-z]:/.test(p) && !p.split('/').includes('..'),
    'Asset paths must be relative and stay inside the project',
  );

/** Items for scroll-reveal steps and gallery cards (text only; image assets arrive with asset import). */
export const SceneItemSchema = z.strictObject({
  title: PlainText(120).min(1),
  text: PlainText(600),
});

export const SceneContentSchema = z.strictObject({
  eyebrow: PlainText(120).optional(),
  heading: PlainText(200).min(1),
  body: PlainText(4000).optional(),
  cta: z.strictObject({ label: PlainText(80).min(1), href: SafeHref }).optional(),
  items: z.array(SceneItemSchema).max(8).optional(),
});

/** Procedural 3D objects (original geometry, no external model files). */
export const OBJECT_PRESETS = ['monolith', 'vessel', 'orb', 'crystal', 'lantern', 'bottle', 'cup', 'knot', 'arch'] as const;

/** Chapter compositions. Every layout is pure CSS over the same semantic markup. */
export const SCENE_LAYOUTS = ['split', 'split-reverse', 'centered', 'full-bleed', 'editorial', 'asymmetric', 'stacked'] as const;
export type SceneLayout = (typeof SCENE_LAYOUTS)[number];

/** Per-type composition variants; the first entry is the default. */
export const SCENE_VARIANTS = {
  hero: ['bottom-left', 'centered', 'top-left', 'split', 'monumental'],
  chapter: [],
  'scroll-reveal': ['cards', 'timeline', 'sticky'],
  'model-showcase': ['split', 'stage'],
  gallery: ['carousel', 'grid', 'mosaic'],
  cta: ['card', 'banner', 'minimal'],
} as const satisfies Record<SceneType, readonly string[]>;
const ALL_VARIANTS = [...new Set(Object.values(SCENE_VARIANTS).flat())] as [string, ...string[]];

export const SceneVisualSchema = z.strictObject({
  background: z.enum(['gradient', 'solid', 'procedural-3d']).optional(),
  layout: z.enum(SCENE_LAYOUTS).optional(),
  variant: z.enum(ALL_VARIANTS).optional(),
  modelAssetId: StableId.nullable().optional(),
  object: z.enum(OBJECT_PRESETS).optional(),
  camera: z.enum(['orbit', 'front', 'low']).optional(),
});

/**
 * Design language (0.2.0): the knobs that make two sites look unrelated. All are enums
 * that map to CSS custom properties and data attributes, so nothing here is free-form CSS.
 */
export const DESIGN_STYLE_OPTIONS = {
  mode: ['dark', 'light'],
  scale: ['quiet', 'editorial', 'monumental'],
  headingCase: ['normal', 'uppercase'],
  headingWeight: ['light', 'regular', 'bold'],
  radius: ['sharp', 'soft', 'round'],
  texture: ['none', 'grain', 'grid', 'lines', 'dots'],
  density: ['airy', 'balanced', 'compact'],
  reveal: ['fade-up', 'mask', 'blur', 'scale', 'slide'],
  easing: ['gentle', 'snappy', 'dramatic'],
  heroArt: ['faceted', 'particles', 'ribbons', 'terrain', 'rings', 'none'],
  panelArt: ['arcs', 'mesh', 'stripes', 'grid', 'blobs', 'duotone'],
} as const;

export const DesignStyleSchema = z.strictObject({
  mode: z.enum(DESIGN_STYLE_OPTIONS.mode),
  scale: z.enum(DESIGN_STYLE_OPTIONS.scale),
  headingCase: z.enum(DESIGN_STYLE_OPTIONS.headingCase),
  headingWeight: z.enum(DESIGN_STYLE_OPTIONS.headingWeight),
  radius: z.enum(DESIGN_STYLE_OPTIONS.radius),
  texture: z.enum(DESIGN_STYLE_OPTIONS.texture),
  density: z.enum(DESIGN_STYLE_OPTIONS.density),
  reveal: z.enum(DESIGN_STYLE_OPTIONS.reveal),
  easing: z.enum(DESIGN_STYLE_OPTIONS.easing),
  heroArt: z.enum(DESIGN_STYLE_OPTIONS.heroArt),
  panelArt: z.enum(DESIGN_STYLE_OPTIONS.panelArt),
});
export type DesignStyle = z.infer<typeof DesignStyleSchema>;

/** The 0.1.0 look, used by the migration so upgraded projects render as before. */
export const LEGACY_DESIGN_STYLE: DesignStyle = {
  mode: 'dark',
  scale: 'editorial',
  headingCase: 'normal',
  headingWeight: 'bold',
  radius: 'soft',
  texture: 'none',
  density: 'balanced',
  reveal: 'fade-up',
  easing: 'gentle',
  heroArt: 'faceted',
  panelArt: 'arcs',
};

export const SceneMotionSchema = z.strictObject({
  type: z.enum(['none', 'subtle-reveal', 'scroll-reveal']),
});

const ResponsiveMode = z.enum(['same', 'static-hero', 'stacked']);
export const SceneResponsiveSchema = z.strictObject({
  desktop: ResponsiveMode.optional(),
  tablet: ResponsiveMode.optional(),
  mobile: ResponsiveMode.optional(),
});

export const SceneAccessibilitySchema = z.strictObject({
  label: PlainText(120).min(1),
  fallbackText: PlainText(1000).min(1),
});

export const SceneSchema = z.strictObject({
  id: StableId,
  type: z.enum(SCENE_TYPES),
  content: SceneContentSchema,
  visual: SceneVisualSchema,
  motion: SceneMotionSchema,
  responsive: SceneResponsiveSchema,
  accessibility: SceneAccessibilitySchema,
});

export const PageSchema = z.strictObject({
  id: StableId,
  path: z.string().regex(/^\/[a-z0-9/-]*$/, 'Page paths must start with / and use lowercase URL-safe characters'),
  scenes: z.array(SceneSchema).min(1).max(50),
});

export const AssetSchema = z.strictObject({
  id: StableId,
  kind: z.enum(['image', 'model', 'video', 'font', 'audio']),
  path: RelativeAssetPath,
  rightsStatus: z.enum(['verified', 'user-confirmed', 'unknown', 'blocked']),
  license: z.string().max(200).optional(),
  sourceUrl: z.string().url().max(2048).optional(),
});

export const StorySpecSchema = z
  .strictObject({
    schemaVersion: z.literal(STORY_SPEC_VERSION),
    project: z.strictObject({
      id: StableId,
      name: PlainText(120).min(1),
      goal: PlainText(1000).min(1),
    }),
    design: z.strictObject({
      theme: PlainText(120),
      colors: z.strictObject({
        background: CssColor,
        foreground: CssColor,
        accent: CssColor,
        secondary: CssColor,
      }),
      typography: z.strictObject({
        heading: FontStack,
        body: FontStack,
      }),
      style: DesignStyleSchema,
    }),
    pages: z.array(PageSchema).min(1).max(20),
    assets: z.array(AssetSchema).max(500),
    quality: z.strictObject({
      reducedMotion: z.boolean(),
      webglFallback: z.boolean(),
      targetBrowsers: z.array(z.enum(BROWSER_ENGINES)).optional(),
    }),
  })
  .superRefine((spec, ctx) => {
    const seen = new Map<string, string>();
    const claim = (id: string, path: (string | number)[]) => {
      if (seen.has(id)) {
        ctx.addIssue({ code: 'custom', path, message: `Duplicate id "${id}" (already used at ${seen.get(id)})` });
      } else {
        seen.set(id, path.join('.'));
      }
    };
    spec.pages.forEach((page, pi) => {
      claim(page.id, ['pages', pi, 'id']);
      page.scenes.forEach((scene, si) => {
        claim(scene.id, ['pages', pi, 'scenes', si, 'id']);
      });
    });
    const paths = new Set<string>();
    spec.pages.forEach((page, pi) => {
      if (paths.has(page.path)) ctx.addIssue({ code: 'custom', path: ['pages', pi, 'path'], message: `Duplicate page path "${page.path}"` });
      paths.add(page.path);
    });
    // Per-primitive requirements (docs/04): renderers must never silently drop content.
    spec.pages.forEach((page, pi) =>
      page.scenes.forEach((scene, si) => {
        const at = (...rest: (string | number)[]) => ['pages', pi, 'scenes', si, ...rest];
        const items = scene.content.items?.length ?? 0;
        if (scene.type === 'cta' && !scene.content.cta) ctx.addIssue({ code: 'custom', path: at('content', 'cta'), message: 'A cta scene needs a call to action (label and link)' });
        if (scene.type === 'gallery' && (items < 2 || items > 8)) ctx.addIssue({ code: 'custom', path: at('content', 'items'), message: 'A gallery needs 2–8 items' });
        if (scene.type === 'scroll-reveal' && (items < 2 || items > 5)) ctx.addIssue({ code: 'custom', path: at('content', 'items'), message: 'A scroll-reveal scene needs 2–5 steps' });
        if (scene.type === 'model-showcase' && !scene.visual.object && !scene.visual.modelAssetId) ctx.addIssue({ code: 'custom', path: at('visual', 'object'), message: 'A model-showcase scene needs an object preset or a model asset' });
        const variants: readonly string[] = SCENE_VARIANTS[scene.type];
        if (scene.visual.variant && !variants.includes(scene.visual.variant)) ctx.addIssue({ code: 'custom', path: at('visual', 'variant'), message: variants.length ? `A ${scene.type} variant must be one of: ${variants.join(', ')}` : `${scene.type} scenes have no variants; use layout` });
        if (scene.visual.layout && scene.type !== 'chapter') ctx.addIssue({ code: 'custom', path: at('visual', 'layout'), message: `Layout applies to chapter scenes, not ${scene.type}; use variant` });
        if (items && !['gallery', 'scroll-reveal'].includes(scene.type)) ctx.addIssue({ code: 'custom', path: at('content', 'items'), message: `Items are only used by gallery and scroll-reveal scenes, not ${scene.type}` });
      }),
    );
    const assets = new Map(spec.assets.map((a) => [a.id, a]));
    spec.assets.forEach((a, ai) => claim(a.id, ['assets', ai, 'id']));
    spec.pages.forEach((page, pi) =>
      page.scenes.forEach((scene, si) => {
        const ref = scene.visual.modelAssetId;
        if (ref == null) return;
        const asset = assets.get(ref);
        const path = ['pages', pi, 'scenes', si, 'visual', 'modelAssetId'];
        if (!asset) ctx.addIssue({ code: 'custom', path, message: `Unknown asset "${ref}"` });
        else if (asset.kind !== 'model') ctx.addIssue({ code: 'custom', path, message: `Asset "${ref}" is a ${asset.kind}, not a model` });
      }),
    );
  });

export type StorySpec = z.infer<typeof StorySpecSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type Page = z.infer<typeof PageSchema>;

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; spec: StorySpec; issues: [] }
  | { ok: false; issues: ValidationIssue[] };

export function validateStorySpec(input: unknown): ValidationResult {
  const parsed = StorySpecSchema.safeParse(input);
  if (parsed.success) return { ok: true, spec: parsed.data, issues: [] };
  return {
    ok: false,
    issues: parsed.error.issues.map((i) => ({
      path: i.path.map(String).join('.') || '(root)',
      message: i.message,
    })),
  };
}

/** Thrown when a StorySpec fails schema validation. */
export class InvalidSpecError extends Error {
  readonly issues: ValidationIssue[];
  constructor(issues: ValidationIssue[]) {
    super(`Invalid StorySpec: ${issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`);
    this.name = 'InvalidSpecError';
    this.issues = issues;
  }
}

/** Thrown by generators when a valid spec uses primitives the target cannot render yet. */
export class UnsupportedSceneError extends Error {
  readonly issues: ValidationIssue[];
  constructor(target: string, issues: ValidationIssue[]) {
    super(`${target} generator cannot render: ${issues.map((i) => `${i.path} (${i.message})`).join('; ')}`);
    this.name = 'UnsupportedSceneError';
    this.issues = issues;
  }
}

export function findUnsupportedScenes(spec: StorySpec, supported: readonly SceneType[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  spec.pages.forEach((page, pi) =>
    page.scenes.forEach((scene, si) => {
      if (!supported.includes(scene.type)) {
        issues.push({
          path: `pages.${pi}.scenes.${si}.type`,
          message: `Scene type "${scene.type}" is not supported yet (supported: ${supported.join(', ')})`,
        });
      }
    }),
  );
  return issues;
}
