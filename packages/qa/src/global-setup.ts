import { startStaticServer } from '@studio/preview';
import { BENCHMARKS, generateSample } from './sample.ts';

// Generates both exports once, then serves each from its own isolated origin.
export default async function globalSetup() {
  const log = (line: string) => process.stdout.write(`${line}\n`);
  const manifest = await generateSample(log, 'heritage');
  const bench = await generateSample(log, 'primitives');
  const servers = await Promise.all([manifest.htmlRoot, manifest.reactRoot, bench.htmlRoot, bench.reactRoot].map((root) => startStaticServer(root)));
  [process.env.STUDIO_HTML_URL, process.env.STUDIO_REACT_URL, process.env.STUDIO_BENCH_HTML_URL, process.env.STUDIO_BENCH_REACT_URL] = servers.map((s) => s.url);
  // Benchmark briefs: heritage reuses the build above; the others are generated and built here.
  const urls: Record<string, { html: string; react: string }> = { heritage: { html: servers[0]!.url, react: servers[1]!.url } };
  for (const name of BENCHMARKS.filter((b) => b !== 'heritage')) {
    const built = await generateSample(log, name);
    const [html, react] = await Promise.all([startStaticServer(built.htmlRoot), startStaticServer(built.reactRoot)]);
    servers.push(html, react);
    urls[name] = { html: html.url, react: react.url };
  }
  process.env.STUDIO_BENCHMARKS = JSON.stringify(urls);
  return async () => {
    await Promise.all(servers.map((s) => s.close()));
  };
}
