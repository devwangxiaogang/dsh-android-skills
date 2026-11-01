# dsh-android-skills

把 Google [官方 Android Skills](https://github.com/android/skills)（36 个技能，上游插件 v1.0.19，
commit `6daa53e`）打包成的 **DeepSeek Harness 技能 bundle**。安装一次后，这些技能会被 harness 的
技能文件系统 provider 发现，进入会话技能目录，模型可以像调用其他技能一样自动调用。

## 包含内容

`android/skills` 的全部 36 个技能：Jetpack Compose 与自适应 UI、Navigation 3、性能（Compose 性能、
R8 keep 规则、ANR）、安全（Intent、权限）、Play（结算库升级、政策洞察、Engage SDK）、相机、media3
cast、Wear、XR/眼镜、TV、Cars、edge-to-edge、Glance 小组件、端侧 AI（LiteRT、ML Kit），以及工具链
（AGP 9 升级、android CLI、profiler、测试环境搭建）。

## 目录结构

```
skills/<skill-name>/SKILL.md   # 36 个拍平后的技能目录
```

上游按分类目录存放技能（如 `jetpack-compose/adaptive`、`wear/wear-compose-m3`）。DeepSeek Harness
只扫描**根目录顶层**的 `<name>/SKILL.md`，因此这里把分类拍平为一级目录。技能内容本身没有修改，来源
与分类信息记录在 `release.json` 与上游仓库中。

## 挂载方式

`cordis.patch.yml` 插入第二个 `@deepseek-ai/dsh-skill-filesystem` provider，只扫描本包的 `skills/`：

- `providerName: android-skills`，与默认的 `filesystem` provider 区分；
- `includeDefaultRoots: false`，不依赖项目级/用户级技能目录；
- `bundledSkillDir` 由 profile 的 `baseUrl` 直接拼接路径（`<profile>/node_modules/dsh-android-skills/skills`），
  link 安装、tgz 安装和 Git 安装都能找到自己的 `skills/`，不依赖模块解析；
- `watch: false`，不为 444 个文件开启文件监听。技能正文每次加载都会重新读取，改 markdown 立即生效；
  新增或改名技能需要重启。

该 provider 处于 **bundled** 层（rank 600），同名时项目级、用户级技能仍然优先。若希望这 36 个技能
成为唯一来源，请删除 `$DSH_AGENTS_HOME/skills`（rank 500）或 `<project>/.agents/skills`（rank 200）
中的重复副本。

## 安装

在 DeepSeek Harness 中让 agent 安装本地 bundle（`plugin_manager` 工具，`action: "install_bundle"`，
`target` 为本目录的绝对路径）。非 Electron profile 也可以：

```bash
dsh plugin --profile <profile> add <本包绝对路径>
```

Electron 管理的 `desktop` profile 不能用 CLI 修改，请使用 harness 的插件管理器。本地目录安装会建立
链接，请保留本目录位置（或改用打包后的 tgz 安装）。

## 从 GitHub 安装

仓库根目录就是插件包，可以直接从 Git 安装：

| 目标 | 说明 |
| --- | --- |
| `https://github.com/devwangxiaogang/dsh-android-skills` | 跟随默认分支 |
| `github:devwangxiaogang/dsh-android-skills#v1.0.19` | 固定到 tag |

非 Electron profile：

```bash
dsh plugin --profile <profile> add github:devwangxiaogang/dsh-android-skills#v1.0.19
```

Git 安装需要本机有 `git` 且能访问 github.com。安装时会把仓库复制进 profile，之后工作区副本可以
移动或删除。

## 验证

```bash
node tools/validate.mjs        # 静态检查：36 个技能、名称、链接、locale、图标、patch
```

然后在会话中加载一个技能（如 `edge-to-edge`、`r8-analyzer`），确认 `Base directory` 指向本包的
`skills/` 目录；技能目录应列出 36 个 Android 技能。

## 更新

```bash
git clone --depth 1 https://github.com/android/skills /tmp/android-skills
node tools/sync-skills.mjs --source /tmp/android-skills --expect 36 --commit <sha> --version <上游版本>
node tools/validate.mjs
```

然后修改 `package.json` 的 `version`，提交并打 tag（`git tag v<版本>`），再从新 tag 重装。替换已安装
包需要新的模块 generation。

## 运行要求

技能本身只是指令与参考文档。构建 Android 应用仍然需要本机的 JDK、Android SDK、Gradle 与 `adb`。

## 许可与归属

技能内容：Copyright Google LLC，Apache License 2.0。完整许可证见 `LICENSE.txt`，来源与版本见
`NOTICE` 与 `release.json`。包名、清单与图标为本 bundle 原创，不使用 Google 或 Android 商标。
