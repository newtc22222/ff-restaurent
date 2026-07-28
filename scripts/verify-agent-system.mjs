import { access, lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const agentsDir = path.join(root, '.agents');
const skillsDir = path.join(agentsDir, 'skills');
const ignoredDirectories = new Set([
  '.git',
  '.claude',
  'node_modules',
  'dist',
  'build',
  'coverage',
  'playwright-report',
  'test-results',
]);
const legacyPath = `.${'codex'}`;
const allowedLegacyMentions = new Set(['.agents/README.md', 'AGENTS.md']);

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function filesUnder(directory, relative = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;

    const entryRelative = path.join(relative, entry.name);
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await filesUnder(entryPath, entryRelative)));
    } else if (entry.isFile()) {
      files.push(entryRelative);
    }
  }

  return files;
}

function requireSkillFrontMatter(relativeSkillPath, content, failures) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) {
    failures.push(`${relativeSkillPath}: missing YAML front matter`);
    return;
  }

  if (!/^name:\s*\S+/m.test(match[1])) {
    failures.push(`${relativeSkillPath}: front matter is missing name`);
  }
  if (!/^description:\s*\S+/m.test(match[1])) {
    failures.push(`${relativeSkillPath}: front matter is missing description`);
  }
}

const failures = [];
if (!(await exists(agentsDir))) failures.push('.agents directory is missing');
if (!(await exists(skillsDir)))
  failures.push('.agents/skills directory is missing');

if (failures.length === 0) {
  const skillEntries = await readdir(skillsDir, { withFileTypes: true });
  const skillDirectories = skillEntries.filter((entry) => entry.isDirectory());

  if (skillDirectories.length === 0)
    failures.push('.agents/skills has no skills');

  for (const skill of skillDirectories) {
    const skillFile = path.join(skillsDir, skill.name, 'SKILL.md');
    const relativeSkillFile = path
      .relative(root, skillFile)
      .replaceAll('\\', '/');
    if (!(await exists(skillFile))) {
      failures.push(`${relativeSkillFile}: missing SKILL.md`);
      continue;
    }

    const content = await readFile(skillFile, 'utf8');
    requireSkillFrontMatter(relativeSkillFile, content, failures);

    const references = content.matchAll(
      /`((?:references|agents)\/[A-Za-z0-9_./-]+)`/g,
    );
    for (const reference of references) {
      const referencePath = path.join(path.dirname(skillFile), reference[1]);
      if (!(await exists(referencePath))) {
        failures.push(
          `${relativeSkillFile}: missing referenced asset ${reference[1]}`,
        );
      }
    }
  }
}

const lockfile = path.join(agentsDir, 'skills-lock.json');
if (await exists(lockfile)) {
  try {
    const lock = JSON.parse(await readFile(lockfile, 'utf8'));
    if (
      typeof lock !== 'object' ||
      lock === null ||
      typeof lock.skills !== 'object'
    ) {
      failures.push('.agents/skills-lock.json: missing skills object');
    } else {
      for (const skillName of Object.keys(lock.skills)) {
        const skillFile = path.join(skillsDir, skillName, 'SKILL.md');
        if (!(await exists(skillFile))) {
          failures.push(
            `.agents/skills-lock.json: missing locked skill ${skillName}`,
          );
        }
      }
    }
  } catch {
    failures.push('.agents/skills-lock.json: invalid JSON');
  }
}

for (const relativeFile of await filesUnder(root)) {
  const normalized = relativeFile.replaceAll('\\', '/');
  if (allowedLegacyMentions.has(normalized)) continue;
  const content = await readFile(path.join(root, relativeFile), 'utf8');
  if (content.includes(legacyPath)) {
    failures.push(`${normalized}: contains legacy ${legacyPath} reference`);
  }
}

if (failures.length > 0) {
  console.error('Agent-system verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Agent-system verification passed.');
}
