# dsh-android-skills

Google's [official Android skills](https://github.com/android/skills) (36 skills, upstream plugin
v1.0.19, commit `6daa53e`) packaged as a **DeepSeek Harness skill bundle**. Install it once and the
skills are discovered by the harness skill filesystem provider, listed in the session skill catalog
and invocable by the model like any other skill.

## What is included

All 36 skills from `android/skills`: Jetpack Compose and adaptive UI, Navigation 3, performance
(Compose performance, R8 keep rules, ANR), security (intents, permissions), Play (billing upgrades,
policy insights, Engage SDK), camera, media3 cast, Wear, XR/glasses, TV, Cars, edge-to-edge,
Glance widgets, device AI (LiteRT, ML Kit), and tooling (AGP 9 upgrade, android CLI, profiler,
testing setup).

## Layout

```
skills/<skill-name>/SKILL.md   # 36 flattened skill bundles
```

Upstream keeps its skills under category directories (`jetpack-compose/adaptive`,
`wear/wear-compose-m3`, ...). DeepSeek Harness only discovers a skill at the **top level** of a
scanned root (`<root>/<name>/SKILL.md`), so the categories are flattened into one directory per
skill. Skill content is otherwise untouched; the category of each skill is recorded in
`release.json`'s provenance and in the upstream repository.

## How it mounts

`cordis.patch.yml` inserts a second `@deepseek-ai/dsh-skill-filesystem` provider that scans only
this package's `skills/` directory:

- `providerName: android-skills` keeps it distinct from the default `filesystem` provider.
- `includeDefaultRoots: false` makes it independent of project/user skill roots.
- `bundledSkillDir` is derived with path arithmetic from the profile `baseUrl`
  (`<profile>/node_modules/dsh-android-skills/skills`), so a linked checkout, a packed tarball and a
  Git install all find their own `skills/` directory without root-level module resolution.
- `watch: false` avoids watching 444 files. Skill bodies are still re-read on every load, so
  editing a skill's markdown takes effect immediately; adding or renaming a skill needs a restart.

Because this provider sits at the **bundled** rank (600), project and user skills with the same name
still take precedence. To make these 36 skills the only source, remove any duplicate copies from
`$DSH_AGENTS_HOME/skills` (rank 500) or `<project>/.agents/skills` (rank 200).

## Install

From DeepSeek Harness, ask the agent to install the local bundle (the `plugin_manager` tool,
`action: "install_bundle"`, `target` = absolute path of this directory). Equivalent CLI for a
non-Electron profile:

```bash
dsh plugin --profile <profile> add <absolute-path-of-this-package>
```

The Electron-managed `desktop` profile cannot be edited from the CLI; use the harness plugin
manager. A local directory installation links the checkout, so keep this directory in place (or
install a packed tarball instead).

## Install from GitHub

This repository is the package root, so the bundle can be installed straight from Git:

| Target | When |
| --- | --- |
| `https://github.com/devwangxiaogang/dsh-android-skills` | tracks the default branch |
| `github:devwangxiaogang/dsh-android-skills#v1.0.19` | pinned to a tag |

Non-Electron profiles:

```bash
dsh plugin --profile <profile> add github:devwangxiaogang/dsh-android-skills#v1.0.19
```

Git installs require `git` and network access to github.com. The checkout is copied into the
profile, so the workspace copy can be moved or deleted afterwards.

## Verify

```bash
node tools/validate.mjs        # static checks: 36 skills, names, links, locale, icon, patch
```

Then in a session, load a skill (for example `edge-to-edge` or `r8-analyzer`) and confirm the
`Base directory` points inside this package's `skills/` directory. The skill catalog should list
36 Android skills.

## Update

```bash
git clone --depth 1 https://github.com/android/skills /tmp/android-skills
node tools/sync-skills.mjs --source /tmp/android-skills --expect 36 --commit <sha> --version <upstream version>
node tools/validate.mjs
```

Then bump `version` in `package.json`, commit, tag with `git tag v<version>`, and reinstall from the
new tag. A replaced package needs a fresh module generation.

## Requirements

The skills themselves only contain instructions and reference material. Building Android apps
still requires a local JDK, Android SDK, Gradle and `adb`.

## License and attribution

Skill content: Copyright Google LLC, Apache License 2.0. The full license text is in
`LICENSE.txt`; provenance is in `NOTICE` and `release.json`. The package name, manifest and icon are
original work for this DSH bundle and use no Google or Android trademarks.
