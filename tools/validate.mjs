#!/usr/bin/env node
// Static checks for the dsh-android-skills bundle:
// skill dirs + frontmatter, locale meta, icon size, patch config, release manifest,
// and relative markdown links inside the packaged skills.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS = join(ROOT, 'skills');
const EXPECTED = 36;
const MAX_ICON_BYTES = 256 * 1024;
const ALLOWED_BROKEN = new Set([
  'android-cli/SKILL.md -> path/to/screenshot',
  'navigation-3/references/android/guide/navigation/navigation-3/recipes/deeplinks-syntheticbackstack.md -> README.md',
]);
const PATCH_NEEDLES = [
  'id: android-skills-filesystem',
  "name: '@deepseek-ai/dsh-skill-filesystem'",
  'providerName: android-skills',
  'includeDefaultRoots: false',
  'bundledSkillDir: !!js',
  'fileURLToPath(baseUrl)',
];

const errors = [];
const warnings = [];
const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);

function frontmatter(file) {
  const lines = readFileSync(file, 'utf8').replaceAll('\r', '').split('\n');
  if (lines[0] !== '---') return {};
  const fields = {};
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index] === '---') break;
    const colon = lines[index].indexOf(':');
    if (colon <= 0) continue;
    const key = lines[index].slice(0, colon).trim();
    const value = lines[index].slice(colon + 1).trim().replace(/^("|')(.*)\1$/, '$2');
    fields[key] = value;
  }
  return fields;
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.isFile()) yield path;
  }
}

// 1. Skill directory bundles: <root>/<name>/SKILL.md, name == directory basename.
const skillDirs = readdirSync(SKILLS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
if (skillDirs.length !== EXPECTED) fail(`expected ${EXPECTED} skill dirs, found ${skillDirs.length}`);

const names = new Map();
for (const name of skillDirs) {
  const manifest = join(SKILLS, name, 'SKILL.md');
  if (!existsSync(manifest)) {
    fail(`${name}: missing SKILL.md`);
    continue;
  }
  const fields = frontmatter(manifest);
  if (fields.name === undefined || fields.name === '') fail(`${name}: SKILL.md has no frontmatter name`);
  else if (fields.name !== name) fail(`${name}: frontmatter name ${JSON.stringify(fields.name)} does not match its directory`);
  if (fields.description === undefined || fields.description === '') fail(`${name}: SKILL.md has no frontmatter description`);
  if (names.has(fields.name)) fail(`duplicate skill name ${JSON.stringify(fields.name)} (${names.get(fields.name)} and ${name})`);
  names.set(fields.name, name);
}

// 2. Relative markdown links resolve (a handful of upstream placeholders are known broken).
let markdownFiles = 0;
let linksChecked = 0;
for (const file of walk(SKILLS)) {
  if (extname(file) !== '.md') continue;
  markdownFiles += 1;
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const raw = match[1];
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(raw)) continue;
    linksChecked += 1;
    const target = raw.split('#')[0].split('?')[0];
    if (target === '') continue;
    const resolved = resolve(dirname(file), decodeURIComponent(target));
    if (!existsSync(resolved)) {
      const key = `${relative(SKILLS, file).split(sep).join('/')} -> ${target}`;
      if (ALLOWED_BROKEN.has(key)) warn(`known broken link: ${key}`);
      else fail(`broken relative link: ${key}`);
    }
  }
}

// 3. Locale metadata for the plugin card.
for (const locale of ['en', 'zh']) {
  const file = join(ROOT, 'locale', `${locale}.json`);
  if (!existsSync(file)) {
    fail(`missing locale/${locale}.json`);
    continue;
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`locale/${locale}.json is not valid JSON: ${error.message}`);
    continue;
  }
  for (const field of ['title', 'description']) {
    if (typeof parsed?.meta?.[field] !== 'string' || parsed.meta[field] === '') fail(`locale/${locale}.json: meta.${field} is missing`);
  }
}

// 4. Icon.
const iconPath = join(ROOT, 'icon.svg');
if (!existsSync(iconPath)) fail('missing icon.svg');
else if (statSync(iconPath).size > MAX_ICON_BYTES) fail(`icon.svg exceeds ${MAX_ICON_BYTES} bytes`);

// 5. Bundle patch supplies exactly the bundled provider row.
const patchPath = join(ROOT, 'cordis.patch.yml');
if (!existsSync(patchPath)) fail('missing cordis.patch.yml');
else {
  const patch = readFileSync(patchPath, 'utf8');
  for (const needle of PATCH_NEEDLES) if (!patch.includes(needle)) fail(`cordis.patch.yml lacks ${JSON.stringify(needle)}`);
}

// 6. Release manifest matches what is packaged.
const releasePath = join(ROOT, 'release.json');
if (!existsSync(releasePath)) fail('missing release.json');
else {
  try {
    const release = JSON.parse(readFileSync(releasePath, 'utf8'));
    if (release.skillCount !== skillDirs.length) fail(`release.json records ${release.skillCount} skills, packaged ${skillDirs.length}`);
    if (typeof release.contentHash !== 'string' || !release.contentHash.startsWith('sha256:')) fail('release.json lacks a sha256 contentHash');
  } catch (error) {
    fail(`release.json is not valid JSON: ${error.message}`);
  }
}

for (const message of warnings) console.warn(`warning: ${message}`);
if (errors.length > 0) {
  for (const message of errors) console.error(`error: ${message}`);
  console.error(`FAILED: ${errors.length} problem(s)`);
  process.exitCode = 1;
} else {
  console.log(`OK: ${skillDirs.length} skills, ${markdownFiles} markdown files, ${linksChecked} links checked`);
}
