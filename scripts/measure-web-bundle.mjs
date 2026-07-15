import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = path.resolve('apps/web/dist');
const files = [];

async function visit(directory) {
  for (const name of await readdir(directory)) {
    const fullPath = path.join(directory, name);
    const details = await stat(fullPath);
    if (details.isDirectory()) await visit(fullPath);
    else files.push(fullPath);
  }
}

await visit(dist);
const measurements = await Promise.all(
  files.map(async (file) => {
    const contents = await readFile(file);
    return {
      file: path.relative(dist, file).replaceAll('\\', '/'),
      bytes: contents.byteLength,
      gzipBytes: gzipSync(contents).byteLength,
    };
  }),
);
measurements.sort((left, right) => right.bytes - left.bytes);

const totals = measurements.reduce(
  (current, file) => ({
    bytes: current.bytes + file.bytes,
    gzipBytes: current.gzipBytes + file.gzipBytes,
  }),
  { bytes: 0, gzipBytes: 0 },
);

console.log(
  JSON.stringify(
    {
      totals,
      javascriptChunks: measurements.filter(({ file }) => file.endsWith('.js'))
        .length,
      largestFiles: measurements.slice(0, 8),
    },
    null,
    2,
  ),
);
