import { LOOKS, LOOK_INFO, type AiProvenance, type DiscoveryQuestion, type KickoffOutput, type ProjectPlan } from '@studio/contracts';

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f‪-‮⁦-⁩]/g;
const tidy = (s: string, max: number) => s.replace(CONTROL, '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Kickoff prompt: the project's own name and idea only (the user's words), so it
 * carries no third-party content.
 */
export function kickoffPrompt(input: { name: string; idea: string; guidance?: { name: string; text: string }[] }): string {
  return [
    'You are the Discovery Director of Spanda Studio, a desktop studio that builds cinematic, scroll-driven 3D websites (HTML + three.js, or React + R3F).',
    'From the project name and one-line idea, plan the project for the person building it.',
    '- projectType: what kind of site this is (e.g. "Festival invitation", "Product launch").',
    '- summary: 2–3 sentences on what the site should achieve and for whom.',
    '- facts: only what the name and idea actually state. assumptions: what you are guessing; the person will confirm or correct them.',
    '- nextSteps: 3–5 concrete steps in this studio (answer the questions, add references, pick an art direction, approve the brief, draft the storyboard, build and preview).',
    `- core: your best starting values for look, tone, subject (what the 3D visuals focus on), motion and length. Looks: ${LOOKS.map((id) => `${id} (${LOOK_INFO[id].label}: ${LOOK_INFO[id].explanation})`).join('; ')}.`,
    '- Do not ask which look or visual style to use; the studio asks that itself.',
    '- questions: 3–6 short, high-impact questions about THIS project that change the design (audience, mood, key moments, what to show in 3D, call to action). One idea per question, 2–4 options each, with a one-line explanation per option. recommended is the index of the option you would choose and why says why in one sentence.',
    'Plain text only, no markdown. Do not invent facts, prices, dates, names or claims about real people or places.',
    ...(input.guidance?.length ? ['', 'Studio skills (trusted guidance chosen by the user; apply where relevant):', ...input.guidance.map((g) => `<skill name=${JSON.stringify(g.name)}>\n${g.text}\n</skill>`)] : []),
    '',
    `Project name: ${JSON.stringify(input.name)}`,
    `Idea: ${JSON.stringify(input.idea)}`,
  ].join('\n');
}

/** Turn validated kickoff output into a stored plan with stable, safe ids (q-1…, o-1…). */
export function sanitizePlan(output: KickoffOutput, provenance: AiProvenance): ProjectPlan {
  const questions: DiscoveryQuestion[] = output.questions.slice(0, 6).map((q, qi) => {
    const options = q.options.slice(0, 4).map((o, oi) => ({ id: `o-${oi + 1}`, label: tidy(o.label, 80), explanation: tidy(o.explanation, 200) }));
    const pick = options[q.recommended] ?? options[0]!;
    return { id: `q-${qi + 1}`, prompt: tidy(q.prompt, 160), reason: tidy(q.reason, 200), options, default: pick.id, why: tidy(q.why, 200) };
  });
  return {
    projectType: tidy(output.projectType, 80),
    summary: tidy(output.summary, 600),
    facts: output.facts.map((f) => tidy(f, 200)).filter(Boolean).slice(0, 8),
    assumptions: output.assumptions.map((f) => tidy(f, 200)).filter(Boolean).slice(0, 8),
    nextSteps: output.nextSteps.slice(0, 6).map((s) => ({ title: tidy(s.title, 80), detail: tidy(s.detail, 300) })),
    core: output.core,
    questions,
    provenance,
  };
}
