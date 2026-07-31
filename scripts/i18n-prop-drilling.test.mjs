import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const productionComponentRoots = [
  'apps/web/src/components',
  'apps/web/src/features',
];

const findComponentFiles = async (relativeDirectory) => {
  const directory = path.join(repositoryRoot, relativeDirectory);
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = path.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) return findComponentFiles(relativePath);
      if (!entry.name.endsWith('.tsx') || entry.name.endsWith('.test.tsx')) {
        return [];
      }
      return [relativePath];
    }),
  );
  return nested.flat();
};

test('production React components resolve translations locally', async () => {
  const files = (
    await Promise.all(productionComponentRoots.map(findComponentFiles))
  ).flat();
  const violations = [];

  await Promise.all(
    files.map(async (file) => {
      const source = await readFile(path.join(repositoryRoot, file), 'utf8');
      if (/\bt=\{t\}/.test(source)) violations.push(`${file}: passes t={t}`);
      if (/\bt:\s*\(key:\s*string\)\s*=>\s*string/.test(source)) {
        violations.push(`${file}: declares a translation function prop`);
      }
    }),
  );

  assert.deepEqual(
    violations.sort(),
    [],
    `Translation prop drilling found:\n${violations.sort().join('\n')}`,
  );
});
