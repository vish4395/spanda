import { generateSample } from './sample.ts';

const manifest = await generateSample();
console.log(`\nHTML site:  ${manifest.htmlRoot}\nReact dist: ${manifest.reactRoot}`);
