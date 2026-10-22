# Skill 管理（dsh-mode-skills）

[English](README.md) | 中文

DeepSeek Harness（dsh）的 Skill（技能）管理插件。它在侧栏「插件」下面加一个「Skill 管理」入口：查看所有 Skill、按模式开关，新建、编辑、导入、保存版本，以及从 GitHub 安装。

> 预览版。

## 能做什么

- **侧栏入口**：「Skill 管理」和「插件」「自动化任务」在同一级，不用进设置。
- **全部 Skill 一览**：每个 Skill 显示名称、来源（DSH 用户目录、通用目录、项目、随模式提供、随插件包提供、GitHub 等）和说明。展开后能看到文件位置、何时使用，以及它在每个模式里的状态。
- **按模式开关**：列表里每个加载 Skill 的模式占一列（最多四列；模式更多或窗口较窄时，每行改为显示在几个模式里开着），每个 Skill 一个开关，点一下就在这个模式里打开或关闭；显示「—」表示这个模式里没有这个 Skill，设成「仅手动」「仅模型」的格子显示文字，点它会展开这一行。展开一个 Skill，每个模式都有「开 / 仅手动 / 仅模型 / 关」四档，也可以一键在所有模式打开或关闭；在上方选一个模式，每行右边会出现这个模式的开关，还有对当前列表的「列表全部打开 / 列表全部关闭」（可以撤销）。「仅手动」：模型看不到它，你仍可以输入 `/名字` 调用。「仅模型」：模型能看到并加载它，`/` 菜单里不显示。不加载 Skill 的模式（比如极简模式）、这个模式里没有的 Skill 不能设置，旁边会写明原因。
- **搜索和整理**：搜索覆盖名称、描述、显示名、标签和 Skill 文件的正文（只在正文里命中的会标「正文匹配」）。可以给 Skill 起一个显示名（比如中文名）、加标签，并按标签筛选；这些只保存在本插件的设置里，不会改动 Skill 文件。
- **项目里的 Skill**：「项目」里填一个项目文件夹（点「查看」时先检查，并列出最近用过的），列表就会加上它 `.dsh/skills` 和 `.agents/skills` 里的 Skill。开关按名字对所有项目生效；会话在该项目里运行时才会加载这些 Skill。
- **从 GitHub 安装**：「导入 Skill → GitHub」里填仓库地址（`github.com/owner/repo`、仓库里的某个分支和文件夹，或 `owner/repo`），会下载它的公开压缩包并列出里面的 Skill，含脚本的会特别提醒；默认一个都不勾选。安装时记住提交：「检查更新」把每个已安装 Skill 的文件夹和仓库当前的对比，「全部更新」用新版本覆盖（覆盖前先把当前文件存成一个版本）。不支持私有仓库。
- **Skill 商城**：页面右上角的「Skill 商城」按钮（在「导入 Skill」旁边）可以搜索 [skills.sh](https://skills.sh)（公开的 Skill 目录，带安装次数），也列出插件自带的一小批知名仓库。点「查看并安装」会在商城里打开那个仓库，走上面的 GitHub 流程，并选中那个 Skill：列表长时有筛选框，「返回 Skill 商城」（或按 Esc）回到刚才的搜索结果，「导入所选」固定在底部。你确认之前不会安装任何东西；装完可以继续逛或直接完成。skills.sh 列出的 Skill 如果仓库里已经没有，页面会说明。搜索词会发给 skills.sh。
- **按模式的使用统计**：「使用统计」统计最近 7、30、90 或 365 天里，每个模式的会话加载了每个 Skill 多少次（模型调用 `skill` 工具，或你输入 `/名字`），并显示最近一次的时间；上方可以选一个模式，只看这个模式加载了什么、没加载过什么。列出没人加载过的 Skill（所有模式里，或选定模式里），可以在某个模式里一键关掉（可以撤销）。它从会话历史里只读名称和时间，不读对话内容。读最新的 400 个会话，最多 25 秒；读过的已保存会话缓存 10 分钟。
- **token 开销**：每个 Skill 和每个模式的 Skill 目录都标出大约占多少 token（模式的开销写在它那一列的标题下面，在这一列开关 Skill 时跟着变），可以按 token 排序，方便决定在哪个模式关掉哪些。估算方法见下面的「开发」。
- **没被加载的 Skill**：Skill 目录里有 SKILL.md、但 DSH 没有加载的文件会列出来，写明原因（缺 frontmatter、YAML 写法有误、name 不合规、旧写法的字段等）。能自动改的直接给出改好的内容，确认后保存；旧文件会先备份。
- **回收站**：删除的 Skill 移进回收站，可以恢复到原位置或彻底删除；刚删除时提示里有「撤销」。回收站不会自动清空。
- **新建和编辑**：「新建 Skill」里填名称和描述，选放在 DSH 自己的目录还是和其他 Agent 工具共用的目录，以及在哪些模式开启；创建后直接打开 SKILL.md 编辑。展开任一 Skill 也能编辑它的 SKILL.md：保存前会自动把当前文件存成一个版本，编辑期间文件被别处改动时会提示。没保存的修改会在当前标签页里保留：折叠这一行或去别的页面再回来都还在（这一行会标「未保存」），离开编辑器时会先确认。搜索、筛选和展开的行也同样保留。属于已安装包的 Skill 不能修改文件。
- **文件、导出、移动**：「文件和导出」列出 Skill 文件夹里的其他文件，可以查看、编辑、新增和删除（改动前的旧文件会备份在 `.dsh-mode-skills/backups/`），可以把 Skill 导出成 `.zip`，也可以在 `~/.dsh/skills` 和 `~/.agents/skills` 之间移动。
- **导入**：「导入 Skill」列出 Codex（`~/.codex/skills`）、Claude Code（`~/.claude/skills`，以及插件里的 Skill）和其他 Agent 工具（按 `~/.<工具>/skills` 的约定自动发现，比如 Cursor、Gemini CLI）中的 Skill，也可以读任意文件夹，或拖入、选择 `.zip` 和 Skill 文件夹上传。勾选后复制进来；重名时可以改名导入，或覆盖现有 Skill（覆盖前先存一个版本）。上传的 Skill 不记录来源。
- **来源更新提醒**：导入的 Skill 记住来源。来源之后有变化，列表上会标「来源有更新」，展开后可以一键重新导入。
- **版本历史**：手动保存版本（可以写备注），查看、恢复到文件（恢复前先存当前文件）或删除；删除的版本号不会再用。
- **卸载后模式照常可用**：见下面的「卸载」。
- **插件自己的更新**：插件有新版本时页面会告诉你，确认后用 DSH 自带的安装器装上；见下面的「更新」。
- **和模式管理一起用**：装了 [dsh-modes](https://github.com/xiaohai-78/dsh-modes) 时，按模式的设置、新建、导入和版本都由模式管理负责，这里的操作会通过它保存，和它的「技能」页是同一份设置、同一份导入记录和版本；被它固定到某个版本的 Skill 也会标出来。模式管理没有的「仅手动」「仅模型」这时不能用；只有本插件之前保存过的设置会暂时不生效，「交给模式管理」可以把其中的「关闭」转过去。回收站、没被加载的 Skill、token 开销、上传、GitHub 安装、显示名和标签、项目文件夹、文件编辑和其他 Agent 目录照常可用。

列表读的是每个模式能看到的 Skill：用户目录、自定义目录、随模式提供的 Skill，以及选了项目文件夹时那个项目里的 Skill。

## 什么时候生效

- 模式里已经有本插件的设置时，改动从正在运行的会话的下一步开始生效。
- 一个模式第一次设置「关」「仅手动」或「仅模型」时，要往模式里加一行设置，这次改动从新会话开始生效；保存后的提示会写明是哪个模式。

## 安装

```bash
dsh plugin --profile web add dsh-mode-skills
```

从源码运行 dsh 时，在源码目录里执行 `pnpm dsh plugin --profile web add dsh-mode-skills`，然后重启 `dsh web`。想试用本地源码，把名字换成 `link:/你的路径/dsh-mode-skills`。

从 GitHub 安装需要运行 dsh 的这台机器能访问 `codeload.github.com`。在代理后面时，先设置 `HTTPS_PROXY` 和 `NODE_USE_ENV_PROXY=1` 再启动 dsh。

## 卸载

```bash
dsh plugin --profile web remove dsh-mode-skills
```

本插件往模式里加的那一行，保存时带一个条件：插件包不在了，这一行就自动关闭。所以卸载后，所有模式照常可用，被关掉的 Skill 在各模式里都会恢复。profile 目录下的 `.dsh-mode-skills/` 文件夹会保留，重新安装后设置都会回来；想清理可以删掉它。

## 更新

页面会检查这个插件有没有新版本，并且能直接装上。

- **检查**：打开页面时，插件向 DSH 配置的 npm 源（镜像也可以）询问 `dsh-mode-skills` 的最新版本，最多 12 小时一次，请求里只有包名。页面底部的「自动检查更新」可以关掉；底部的「检查插件更新」仍然可用。本地开发安装（`link:`）不检查。（列表上方的「检查更新」是另一回事：它检查从 GitHub 安装的 Skill。）
- **升级**：有新版本时，页面顶部出现提示，带「查看更新记录」和「升级…」。确认后，DSH 自带的安装器从 npm 源下载那个版本的压缩包并安装，显示进度，可以「取消安装」。安装失败或取消时，安装器会把配置文件恢复原样，提示里会给出安装器的原话和手动升级的命令。只提供 `latest` 正式版，不提供预发布版；压缩包地址必须是回答的那个源上这个包的文件。
- **升级之后**：取决于 DSH 版本，新版本要么立即换上（这个页面会关闭，重新打开即可），要么在重启 dsh 后生效（网页版：重新运行 `dsh web`；桌面应用：退出后重新打开）。下次打开页面会显示「已升级到」新版本。你的 Skill 和设置都会保留，正在运行的会话不受影响。提示里会给出退回旧版本的命令。
- **从 GitHub 安装的**：提示里显示 `dsh plugin --profile web add github:xiaohai-78/dsh-mode-skills`，不显示按钮。
- **手动升级**：运行 `dsh plugin --profile web add dsh-mode-skills@latest`，或者在「插件」页点「添加插件」，填 `https://registry.npmjs.org/dsh-mode-skills/-/dsh-mode-skills-<版本>.tgz`。不带 `@latest` 的命令什么都不做，因为 DSH 会保留已经装好的版本。
- **从 0.2.0 及更早的版本升级**：这些版本没有更新检查，需要手动升级一次。

## 计划

1. **只读一览**（已完成）：侧栏入口、全部 Skill、各模式状态。
2. **按模式开关**（已完成）：只装本插件也能用；卸载后模式照常可用；装了模式管理时通过它保存。
3. **Skill 库**（已完成）：新建、编辑、从 Codex / Claude Code / 文件夹导入、来源更新提醒、版本历史；装了模式管理时通过它保存。
4. **补齐常用功能**（已完成）：回收站、没被加载的 Skill 诊断和修复、token 开销、上传 zip 和文件夹、更多 Agent 目录、按模式「仅手动」。
5. **管理和 GitHub**（已完成）：仅模型、标签和显示名、正文搜索、项目里的 Skill、批量开关、Skill 文件夹里的文件、导出和移动、从 GitHub 安装并检查更新、把「关闭」交给模式管理。
6. **Skill 商城和使用统计**（已完成）：搜索 skills.sh 和推荐仓库，通过 GitHub 流程安装；从会话历史统计每个 Skill 在各模式的使用次数。
7. **以后**：skills.sh 之外自建的索引、和模式管理共用一份 Skill 数据、模式管理里支持「仅手动」「仅模型」、在对话里管理 Skill 的工具。

## 开发

| 文件 | 作用 |
|---|---|
| `index.js` | Host 插件：提供 `POST /api/dsh-mode-skills` 和策略行读取的 `dshModeSkills` 服务。操作有：`list`、`setModes`，和 dsh-modes 同名、同参数的 Skill 库操作（`createSkill`、`readSkillFile`、`writeSkillFile`、`saveSkillVersion`、`restoreSkillVersion`、`deleteSkillVersion`、`readSkillVersion`、`skillSources`、`importSkills`），以及本插件自己的：`deleteSkill` 和回收站、`readSkipped`、`writeSkipped`、`stageUpload`、`importUploads`、`agentSources`、`setMeta`、`searchSkills`、`listSkillFiles`、`readSkillAsset`、`writeSkillAsset`、`deleteSkillAsset`、`exportSkill`、`moveSkill`、`githubSources`、`checkUpdates`、`updateGithub`、`clearModes`、`usage`、`storeSearch`、`storeIndex`，以及插件更新相关的 `updateStatus`、`setUpdateCheck`、`dismissUpgraded`、`upgrade`、`upgradeStatus`、`cancelUpgrade`（这些总是由本插件回答）。装了 dsh-modes 时，Skill 库和设置类操作会拒绝（`managed-by-modes`）。`list` 用 `agentPresets.acquireScope` 为每个模式挂载作用域，读取 `skills.snapshot`（选了项目文件夹时带上 `cwd`）和是否有 `skill` 工具，再释放作用域；每个模式的结果缓存 60 秒，改动过的模式和页面的「刷新」会跳过缓存。启动时给本插件写过的模式补上卸载条件，并在模式只差本插件这一行时并入 DSH 的内置更新 |
| `policy.js` | 放进模式里的策略行：在模式自己的作用域注册一个 Skill 提供方，为每个关掉的 Skill 列出一条模型和用户都不能调用的条目；为每个「仅手动」或「仅模型」的 Skill 列出一条只有用户、或只有模型能调用的条目，加载时读 Skill 当前的文件（rank -1000）。装了 dsh-modes 时不列任何条目 |
| `mode-rows.js` | 策略行的增删、卸载条件（`disabled: !!js`，找不到 `dsh-mode-skills` 包时为真），以及用 `rebase.js` 并入内置行的更新 |
| `rebase.js`、`fs-retry.js` | 三方合并与 Windows 上的重命名重试，和 dsh-modes 相同 |
| `state.js` | `<profile>/.dsh-mode-skills/state.json`：各模式关掉、设为仅手动、设为仅模型的 Skill，上次合并时的内置行，以及每个 Skill 的 `info`（最近一次看到的说明，所有模式都关掉它时仍能显示）、`alias` 和 `tags`、`imported`（导入来源、指纹，GitHub 来源还有仓库、ref、文件夹、提交和发现的最新版本）和版本索引；版本文件在 `skill-versions/<skill>/<version>/`。原子写入，损坏的文件只报告、不覆盖 |
| `skill-store.js` | 版本号、SKILL.md frontmatter 解析、换行符处理，以及哪些 Skill 能改文件（`node_modules` 里的不能），和 dsh-modes 的规则相同 |
| `trash.js` | 回收站：Skill 文件夹或单文件移到 `<profile>/.dsh-mode-skills/trash/<id>/`，记下原位置，恢复时原样搬回；跨磁盘或 Windows 不让改名时改为复制后删除。「移动」按钮用的是同一个移动函数 |
| `diagnose.js` | 找出 Skill 目录里有 SKILL.md、但没有任何模式列出的文件，按 DSH 的检查顺序说明原因（BOM、frontmatter、常见 YAML 错误、name/description、name 格式、旧字段、调用开关），并给出能自动改的修复。YAML 只检查常见错误，其余情况写「原因见 DSH 日志」 |
| `tokens.js` | 按 DSH 的 Skill 目录格式（每个模型可调用的 Skill 一行 `` - `名字`: 描述 ``，描述压缩空白、截到 500 字，外加固定说明）估算 token：英文字符约 0.3、中文字符约 0.6（DeepSeek 公布的估算比例），不是真实分词结果 |
| `zip.js` | 读取 zip（只支持不压缩和 deflate；不支持加密和 zip64），跳过文件夹、链接和 macOS 元数据，拒绝越出压缩包的路径，解压时就按文件数和字节数限制；不解压就能读出压缩包注释和路径列表；也能写出导出用的 zip |
| `github.js` | 读粘贴的地址（URL、`owner/repo`、分支和文件夹），从 `codeload.github.com` 下载公开的源码压缩包（60 MB、60 秒），从压缩包注释取出提交，并找出里面的 Skill 文件夹 |
| `usage.js` | 从会话日志读取 Skill 的加载：`skill` 工具调用的结果不是错误才算一次；来源为 `skill-invocation` 的 `user/message` 算用户加载的一次。每次加载算在当时会话运行的模式下（头里的 `agentPreset`，被 `agent-preset/selected` 事件替换，都没有则是默认模式）。通过 `sessionQuery` 服务读会话，从新到旧、每次四个；已保存的会话缓存 10 分钟 |
| `store.js`、`store-index.json` | 搜索 skills.sh（`/api/search`，至少两个字符；来源不是 `owner/repo` 的结果会丢掉），以及随插件带的推荐仓库列表（中英文描述） |
| `skill-files.js`、`skill-import.js` | 保存和恢复版本的文件操作；查找 Codex、Claude Code 和文件夹里的 Skill，计算指纹、复制和覆盖 Skill 文件夹（含 Windows 上的处理），新建 SKILL.md，列出文件夹里能运行的脚本。大部分和 dsh-modes 相同 |
| `skill-view.js` | 把各模式的 Skill 目录合并成一份列表，记录每个模式里的状态（可用、仅手动调用、仅模型调用、固定版本、已关闭） |
| `update.js`、`self-update.js` | 插件自己的更新，和 dsh-request-params 里的一样：版本比较、要询问的源、核对源给的压缩包地址确实是那个源上这个包的文件；以及相关动作，`<profile>/.dsh-mode-skills/settings.json` 里的开关和升级留下的记录，通过 DSH 插件管理器安装 |
| `client.js` | Web 页面（中英文）：注册 `sidebar.panellist` 侧栏入口和同 id 的 `main` 主面板；装了 dsh-modes 时通过 `/api/dsh-modes` 的 `setSkillModes` 保存 |
| `cordis.patch.yml` | 插入 `index.js` 这一行 Host 插件 |

```bash
npm test
```

在 Node 22.19 和 24 上运行；本机 Node 不在这个范围时，用 `npx --yes node@22.19.0 --test "test/*.test.js"`。

### 验证方式

在 DSH `0.2.1-rc.2` 上用独立的 `DSH_HOME` 检查过：

- **只装本插件**：在标准模式关掉一个 Skill，模式里加上了带条件的策略行，列表显示该模式「已关闭」；页面上用开关关掉、再打开都正确保存，提示文字符合上面的生效时机。
- **卸载**：`dsh plugin remove` 并删掉插件文件后，标准模式仍在模式列表里，能新建会话；重新安装后，关掉的 Skill 又是关闭状态。
- **和 dsh-modes 一起装**：页面显示由模式管理负责；在这里关掉 PTC 模式的一个 Skill，设置写进了 dsh-modes 的 `skills.json`，本插件自己的设置没有变化。
- **Skill 库，只装本插件**：新建的 Skill 直接打开编辑器，只在选中的模式开启；编辑保存前存了版本；从 Codex 和 Claude Code 导入了两个 Skill，同名的没有预选；改动 Codex 里的来源后列表标出「来源有更新」，重新导入后提示消失并留下导入前的版本；保存（带备注）、查看、恢复、删除版本都正确。
- **Skill 库，和 dsh-modes 一起装**：页面上的新建、读文件、保存版本、导入列表和导入都发给了 `/api/dsh-modes`；Skill 信息、版本和导入记录写进了 dsh-modes 的数据，本插件自己的数据里没有。
- **常用功能**：各模式的 Skill 目录开销显示正确，按 token 排序有效；把一个 Skill 在标准模式设成「仅手动」后，标准模式的目录少了这一项，标准模式会话的 `/` 菜单里它仍在、并标为 user-only；删除、撤销、从回收站恢复都正确；一个 description 含冒号的 SKILL.md 被列为没被加载，保存给出的修复后 DSH 加载了它；能列出 `~/.cursor/skills`，上传 zip 后导入成功。和 dsh-modes 一起装时，「仅手动」不可选并写明原因，其余照常可用。
- **管理和 GitHub**：显示名和标签保存后显示在行上；把一个 Skill 设成「仅模型」后，注册表自己的列表里该模式显示「仅模型调用」；在 Skill 文件夹里新建的文件保存后出现在列表里；只出现在正文里的词能搜到对应的 Skill；填上项目文件夹后列出了该项目的 Skill（带来源和 token 开销）；对一个模式「列表全部关闭」后撤销，所有设置恢复；读取了真实仓库（`anthropics/skills`），从里面安装了三个 Skill，把其中一个伪造成旧版本后「检查更新」发现了它，「全部更新」覆盖成功。装了 dsh-modes 时，「交给模式管理」把一项「关闭」写进了模式管理的设置，并在这里清掉了。
- **Skill 商城和使用统计**：搜索 skills.sh 并打开一个结果，读取了它的仓库并且只选中了那个 Skill；推荐列表正常显示。用本地模拟模型，一个会话（标准模式）用 `skill` 工具加载了一个 Skill，另一个会话（PTC 模式）输入了 `/weekly-report`：「使用统计」从真实的会话日志里各数了一次，并算在各自的模式下。
- **模型实际看到的**（模拟模型收到的请求）：标准模式里一个 Skill 是「仅手动」、一个是「关」、一个是「仅模型」，目录里有「仅模型」的那个，另外两个没有；PTC 模式里都是「开」，`/weekly-report` 注入了这个 Skill 的内容；在标准模式（它是「仅模型」）里同样的一行只是普通文字。
- **更新**：对着真实的 npm 源，标成 0.1.9 的副本发现了 0.2.0，「升级…」通过 DSH 的安装器装上了它，配置随后依赖 0.2.0 的压缩包；在 0.2.1-rc.2 上新版本不用重启就换上了。再装一次同一个版本，会提示已经装好、重启后生效。手动写入的升级记录在页面上显示为「已升级到」，点「关闭」后记录被清掉。
- 还没检查：*正在运行*的会话何时拿到改动后的 Skill 目录；这一点和 dsh-modes 用的是同一种机制（提供方失效和文件监视）。

## 许可证

MIT
