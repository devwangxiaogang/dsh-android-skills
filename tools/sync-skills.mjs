#!/usr/bin/env node
// Refresh <root>/skills from a local checkout of https://github.com/android/skills.
// DSH discovers skills as <root>/<name>/SKILL.md, so category directories are
// flattened here: every SKILL.md directory is copied to skills/<frontmatter-name>.
import { readFileSync, writeFileSync, readdirSync, rmSync, cpSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve, basename, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS = join(ROOT, 'skills');
const SKIPPED_DIRS = new Set(['.git', '.github', '.claude', '.claude-plugin', 'node_modules', 'tmp', 'build', '.idea']);

function parseArgs(argv) {
  const options = { source: undefined, expect: 36, commit: undefined, version: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!flag.startsWith('--')) continue;
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a value`);
    if (flag === '--source') options.source = resolve(value);
    else if (flag === '--expect') options.expect = Number(value);
    else if (flag === '--commit') options.commit = value;
    else if (flag === '--version') options.version = value;
    else throw new Error(`unknown option ${flag}`);
    index += 1;
  }
  if (options.source === undefined) throw new Error('--source <android/skills checkout> is required');
  if (!Number.isInteger(options.expect) || options.expect <= 0) throw new Error('--expect must be a positive integer');
  if (!existsSync(options.source) || !statSync(options.source).isDirectory()) throw new Error(`source is not a directory: ${options.source}`);
  return options;
}

function frontmatterName(file) {
  const lines = readFileSync(file, 'utf8').replaceAll('\r', '').split('\n');
  const end = lines.indexOf('---', 1);
  if (lines[0] !== '---' || end < 0) return undefined;
  for (let index = 1; index < end; index += 1) {
    const colon = lines[index].indexOf(':');
    if (colon <= 0) continue;
    if (lines[index].slice(0, colon).trim() !== 'name') continue;
    return lines[index].slice(colon + 1).trim().replace(/^("|')(.*)\1$/, '$2');
  }
  return undefined;
}

function findSkillDirs(dir, found) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (SKIPPED_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (existsSync(join(path, 'SKILL.md'))) found.push(path);
    findSkillDirs(path, found);
  }
  return found;
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.isFile()) yield path;
  }
}

const options = parseArgs(process.argv.slice(2));
const releaseFile = join(ROOT, 'release.json');
const existing = existsSync(releaseFile) ? JSON.parse(readFileSync(releaseFile, 'utf8')) : {};
const packageVersion = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;

const found = findSkillDirs(options.source, []);
const skills = new Map();
for (const dir of found) {
  const name = frontmatterName(join(dir, 'SKILL.md'));
  if (name === undefined || name === '') throw new Error(`${dir}: SKILL.md has no frontmatter name`);
  if (name !== basename(dir)) throw new Error(`${dir}: frontmatter name ${JSON.stringify(name)} does not match its directory`);
  if (skills.has(name)) throw new Error(`duplicate skill name ${JSON.stringify(name)}: ${skills.get(name)} and ${dir}`);
  skills.set(name, dir);
}
if (skills.size !== options.expect) throw new Error(`expected ${options.expect} skills, found ${skills.size}`);

rmSync(SKILLS, { recursive: true, force: true });
mkdirSync(SKILLS, { recursive: true });
for (const [name, dir] of [...skills].sort(([left], [right]) => left.localeCompare(right))) {
  cpSync(dir, join(SKILLS, name), { recursive: true, verbatimSymlinks: false });
}

let files = 0;
let bytes = 0;
const digest = createHash('sha256');
for (const file of [...walk(SKILLS)].sort()) {
  const path = relative(SKILLS, file).split(sep).join('/');
  const body = readFileSync(file);
  files += 1;
  bytes += body.length;
  digest.update(`${path}\0`);
  digest.update(`${body.length}\0`);
  digest.update(body);
}
const contentHash = `sha256:${digest.digest('hex')}`;

const release = {
  source: 'https://github.com/android/skills',
  sourceCommit: options.commit ?? existing.sourceCommit ?? 'unknown',
  upstreamVersion: options.version ?? existing.upstreamVersion ?? packageVersion,
  skillCount: skills.size,
  fileCount: files,
  bytes,
  contentHash,
};
writeFileSync(releaseFile, `${JSON.stringify(release, null, 2)}\n`);

console.log(`synced ${release.skillCount} skills, ${release.fileCount} files, ${release.bytes} bytes`);
console.log(`contentHash ${release.contentHash}`);
console.log(`sourceCommit ${release.sourceCommit} · upstreamVersion ${release.upstreamVersion}`);
