/** Rebuild Home cards from the actual pattern engine and technical-flat template. */
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { patternPreview } = await server.ssrLoadModule('/src/pattern-preview.ts');
  const { templatePack } = await server.ssrLoadModule('/src/vector-templates.ts');
  const { vectorSvg } = await server.ssrLoadModule('/src/vector-export.ts');
  await mkdir('public/studio-previews', { recursive: true });
  await writeFile('public/studio-previews/pattern.svg', patternPreview('teagan', 'male-m').svg);
  const pack = templatePack('T-shirt');
  // Stabilize identifiers so rebuilding a preview does not produce random diffs.
  pack.layers.forEach((layer, i) => { layer.id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`; });
  await writeFile('public/studio-previews/technical-flat.svg', vectorSvg(pack));
} finally { await server.close(); }
