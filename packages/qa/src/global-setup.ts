import { startStaticServer } from '@studio/preview';
import { generateSample } from './sample.ts';

// Generates both exports once, then serves each from its own isolated origin.
export default async function globalSetup() {
  const log = (line: string) => process.stdout.write(`${line}\n`);
  const manifest = await generateSample(log, 'heritage');
  const bench = await generateSample(log, 'primitives');
  const servers = await Promise.all([manifest.htmlRoot, manifest.reactRoot, bench.htmlRoot, bench.reactRoot].map((root) => startStaticServer(root)));
  [process.env.STUDIO_HTML_URL, process.env.STUDIO_REACT_URL, process.env.STUDIO_BENCH_HTML_URL, process.env.STUDIO_BENCH_REACT_URL] = servers.map((s) => s.url);
  return async () => {
    await Promise.all(servers.map((s) => s.close()));
  };
}
