# Changelog

All notable changes to this package are documented here.

## 1.0.19

- Initial packaging of the 36 Android skills from
  [`android/skills`](https://github.com/android/skills) v1.0.19 (commit `6daa53e`,
  Apache-2.0): skill directories are flattened from upstream category paths to the top level of
  `skills/`, because the DeepSeek Harness skill filesystem provider only discovers
  `<root>/<name>/SKILL.md`.
- DeepSeek Harness bundle: `cordis.patch.yml` inserts a second
  `@deepseek-ai/dsh-skill-filesystem` provider (`android-skills`) that serves the bundled
  `skills/` directory at the bundled rank (600), so project and user skills still override.
- `bundledSkillDir` is derived from the profile `baseUrl` with path arithmetic
  (`<profile>/node_modules/dsh-android-skills/skills`) instead of resolving the package name at
  runtime. This lets a bundle installed while the harness is running — including from a Git URL —
  activate immediately.
- `tools/sync-skills.mjs` re-flattens the skills from a local `android/skills` checkout and writes
  `release.json`; `tools/validate.mjs` checks skill names, frontmatter, relative links, locale,
  icon size, patch config and the release manifest. GitHub Actions runs the validator on every push.
