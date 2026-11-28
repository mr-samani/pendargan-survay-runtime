import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const outputRoot = resolve('dist');
const reportPath = join(outputRoot, 'bundle-attribution.json');

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

const allFiles = await walk(outputRoot);
const maps = allFiles.filter((path) => path.endsWith('.js.map'));
if (maps.length === 0) {
  throw new Error('No JavaScript source maps were emitted. Build with --source-map before attribution.');
}

const chunks = [];
const totals = new Map();
for (const mapPath of maps) {
  const map = JSON.parse(await readFile(mapPath, 'utf8'));
  const jsPath = mapPath.slice(0, -4);
  const jsBytes = await stat(jsPath).then((value) => value.size).catch(() => 0);
  const modules = (map.sources ?? []).map((source, index) => {
    const sourceContent = map.sourcesContent?.[index] ?? '';
    const sourceBytes = Buffer.byteLength(sourceContent, 'utf8');
    const normalized = source.replaceAll('\\', '/');
    const module = { source: normalized, sourceBytes };
    totals.set(normalized, (totals.get(normalized) ?? 0) + sourceBytes);
    return module;
  }).sort((a, b) => b.sourceBytes - a.sourceBytes);

  chunks.push({
    chunk: relative(outputRoot, jsPath).replaceAll('\\', '/'),
    rawBytes: jsBytes,
    sourceCount: modules.length,
    largestSources: modules.slice(0, 30),
  });
}

chunks.sort((a, b) => b.rawBytes - a.rawBytes);
const largestModules = [...totals.entries()]
  .map(([source, sourceBytes]) => ({ source, sourceBytes }))
  .sort((a, b) => b.sourceBytes - a.sourceBytes)
  .slice(0, 100);

const report = {
  generatedAt: new Date().toISOString(),
  method: 'Source-map source-content byte attribution',
  caveat: 'sourceBytes measures original source content, not exact retained/minified contribution after tree-shaking. Use this to identify candidate modules; validate changes with a production build and chunk-size comparison.',
  chunks,
  largestModules,
};
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log('Bundle attribution report: ' + reportPath);
for (const chunk of chunks.slice(0, 12)) {
  console.log(JSON.stringify({
    chunk: chunk.chunk,
    rawKiB: Number((chunk.rawBytes / 1024).toFixed(2)),
    largestSources: chunk.largestSources.slice(0, 8).map((item) => ({
      source: item.source,
      sourceKiB: Number((item.sourceBytes / 1024).toFixed(2)),
    })),
  }));
}
