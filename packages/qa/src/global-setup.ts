import { startStaticServer } from '@studio/preview';
import { generateSample } from './sample.ts';

// Generates both exports once, then serves each from its own isolated origin.
export default async function globalSetup() {
  const manifest = await generateSample((line) => process.stdout.write(`${line}\n`));
  const html = await startStaticServer(manifest.htmlRoot);
  const react = await startStaticServer(manifest.reactRoot);
  process.env.STUDIO_HTML_URL = html.url;
  process.env.STUDIO_REACT_URL = react.url;
  return async () => {
    await html.close();
    await react.close();
  };
}
