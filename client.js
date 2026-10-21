window.__ModuleLoader__.load({
  id: 'dsh-mode-skills',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'dsh-mode-skills'
    const ROUTE = '/api/dsh-mode-skills'
    /** dsh-modes's route; while it is installed the skill settings are saved through it. */
    const MODES_ROUTE = '/api/dsh-modes'
    /** The sidebar entry and the central panel it opens share this id. */
    const PANEL_ID = 'dsh-mode-skills'
    /** Copy keys the official Agent presets page registers for the four shipped presets. */
    const BUILT_IN_COPY = { standard: 'Standard', ptc: 'Ptc', minimal: 'Minimal', cordis: 'Cordis' }
    const NOTICE_MS = 6000
    /** The skill name grammar of the DSH skill registry; the Host repeats this check. */
    const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

    const ZH = {
      'nav': 'Skill 管理',
      'title': 'Skill 管理',
      'intro': '查看所有 Skill，并按模式开关',
      'preview': '预览版',
      'search': '搜索名称、描述或正文',
      'allModes': '全部模式',
      'refresh': '刷新',
      'retry': '重试',
      'dismiss': '关闭',
      'count': '{n} 个 Skill',
      'available': '{n}/{total} 个模式可用',
      'default': '默认',
      'loadFailed': '加载失败：{reason}',
      'stateError': 'Skill 管理的设置文件读不了：{reason}',
      'modeError': '无法读取「{mode}」：{reason}',
      'noRegistry': '当前组合没有加载 Skill 注册表，所以这里没有 Skill',
      'empty.none': '还没有 Skill。把含有 SKILL.md 的文件夹放进 {dsh} 或 {agents}，再点刷新',
      'empty.filtered': '没有匹配的 Skill',
      'managedByModes': '已安装模式管理（dsh-modes）：这里的开关会通过模式管理保存，和它的「技能」页是同一份设置',
      'dormant': 'Skill 管理之前保存的 {n} 项开关现在不生效，卸载模式管理后会恢复',
      'detail.path': '位置',
      'detail.source': '来源',
      'detail.whenToUse': '何时使用',
      'detail.modes': '各模式',
      'state.on': '可用',
      'state.manual': '仅手动调用',
      'state.model': '仅模型调用',
      'state.pinned': '固定版本',
      'state.off': '已关闭',
      'state.missing': '没有',
      'state.error': '读取失败',
      'toggle.on': '在「{mode}」中关闭',
      'toggle.off': '在「{mode}」中打开',
      'reason.noTool': '这个模式不加载 Skill',
      'reason.notEditable': '这个模式不能在这里修改',
      'reason.missing': '这个模式里没有这个 Skill',
      'reason.pinnedBy': '由模式管理固定到保存的版本',
      'effect.applied': '已保存，正在运行的会话从下一步开始生效',
      'effect.newSessions': '已保存，「{modes}」从新会话开始生效',
      'effect.failed': '设置已保存，但「{modes}」的模式配置没改成：{reason}',
      'err.managed-by-modes': '已安装模式管理，请刷新页面后再试',
      'err.not-editable': '这个模式不能在这里修改',
      'err.state-damaged': '设置文件已损坏，请修复或删除后再试',
      'err.network': '连接不上 DSH，请稍后再试',
      'source.project-dsh': '项目（.dsh/skills）',
      'source.project-agents': '项目（.agents/skills）',
      'source.custom': '自定义目录',
      'source.user-dsh': 'DSH 用户目录',
      'source.user-agents': '通用目录',
      'source.bundled': '随模式提供',
      'source.package': '随插件包提供',
      'source.dsh-modes': '模式管理',
      'source.dsh-mode-skills': 'Skill 管理',
      'lib.create': '新建 Skill',
      'lib.import': '导入 Skill',
      'lib.cancel': '取消',
      'lib.save': '保存',
      'lib.remove': '删除',
      'lib.missing': '找不到文件',
      'lib.versions': '版本',
      'lib.notePlaceholder': '备注（可选）',
      'lib.saveVersion': '保存当前为新版本',
      'lib.noVersions': '还没有保存过版本',
      'lib.restore': '恢复到文件',
      'lib.view': '查看',
      'lib.hide': '收起',
      'lib.confirmRestore': '用 {version} 覆盖「{name}」的当前文件？当前文件会先保存成一个新版本；版本里没有的文件会保留',
      'lib.confirmDelete': '删除「{name}」的 {version}？删除后不能恢复',
      'lib.shared': '这个 Skill 在 ~/.agents/skills 里，和其他 Agent 工具共用；改动文件会影响它们',
      'lib.bundled': '这个 Skill 属于已安装的包（DSH 或某个插件），不能修改文件，但可以保存版本和按模式关闭',
      'lib.edit': '编辑 SKILL.md',
      'lib.editHint': '保存前会自动把当前文件存成一个版本',
      'lib.conflict': '文件在你编辑期间被改动了。最新内容：',
      'lib.loadLatest': '载入最新内容',
      'lib.overwrite': '仍然覆盖',
      'lib.source.manual': '手动保存',
      'lib.source.before-edit': '编辑前自动保存',
      'lib.source.before-restore': '恢复前自动保存',
      'lib.source.before-import': '导入前自动保存',
      'lib.newName': '名称',
      'lib.newNameHint': '小写字母、数字和连字符，例如 weekly-report',
      'lib.newNameInvalid': '只能用小写字母、数字和连字符，连字符不能在开头、结尾或连用',
      'lib.newNameTaken': '已有同名 Skill',
      'lib.newDescription': '描述',
      'lib.newDescriptionHint': '一句话说明什么时候用它，模型靠这句话决定是否加载',
      'lib.where': '放在',
      'lib.whereDsh': '{path}（只给 DSH 用）',
      'lib.whereAgents': '{path}（和其他 Agent 工具共用）',
      'lib.onIn': '在这些模式开启',
      'lib.createAction': '创建并编辑',
      'lib.created': '已创建「{name}」',
      'lib.newEffect': '正在运行的会话从下一步可用',
      'lib.saved': '已保存',
      'lib.versionSaved': '已保存新版本',
      'lib.restored': '已恢复到文件，原文件已存为新版本',
      'lib.deleted': '已删除版本',
      'lib.importFrom.agents': 'Codex / Claude Code',
      'lib.importFrom.folder': '文件夹',
      'lib.folderPlaceholder': '一个 Skill 文件夹，或装着多个 Skill 的文件夹，例如 ~/my-skills',
      'lib.read': '读取',
      'lib.group.codex': 'Codex',
      'lib.group.claude': 'Claude Code',
      'lib.group.claude-plugin': 'Claude Code 插件',
      'lib.group.codex-system': 'Codex 自带 Skill',
      'lib.group.folder': '文件夹',
      'lib.groupMissing': '没有这个文件夹',
      'lib.groupEmpty': '没有找到 Skill',
      'lib.systemHint': '这些 Skill 依赖 Codex 自己的工具，在 DSH 里可能用不了',
      'lib.st.new': '可导入',
      'lib.st.imported': '已导入为「{name}」',
      'lib.st.updated': '来源有更新',
      'lib.st.exists': '已有同名 Skill',
      'lib.st.rename': '名字需要修改',
      'lib.st.invalid': '无法导入',
      'lib.problem.no-frontmatter': 'SKILL.md 缺少 name 或 description',
      'lib.problem.unreadable': '读不了 SKILL.md',
      'lib.importAs': '导入为',
      'lib.conflictRename': '改名导入',
      'lib.conflictReplace': '覆盖现有 Skill（先存一个版本）',
      'lib.updatedHint': '重新导入会覆盖「{name}」，当前文件会先存成一个版本',
      'lib.nameDuplicate': '和另一个要导入的 Skill 重名',
      'lib.selectReady': '全选可导入',
      'lib.selectNone': '全不选',
      'lib.importSelected': '导入所选（{n}）',
      'lib.copyNote': '导入是复制：来源之后有变化，这里和 Skill 列表都会提示，可以一键重新导入',
      'lib.importDone': '已导入 {n} 个',
      'lib.importUpdated': '已更新 {n} 个',
      'lib.importFailed': '{n} 个没有完成',
      'lib.importFailure': '{name}：{reason}',
      'lib.importSkipped': '「{name}」里有 {n} 个链接指向 Skill 以外，没有复制',
      'lib.origin': '来源：{source} · {path}',
      'lib.origin.codex': 'Codex',
      'lib.origin.codex-system': 'Codex 自带',
      'lib.origin.claude': 'Claude Code',
      'lib.origin.claude-plugin': 'Claude Code 插件',
      'lib.origin.folder': '文件夹',
      'lib.sourceChanged': '来源有更新',
      'lib.sourceMissing': '来源已不存在',
      'lib.reimport': '从来源重新导入',
      'lib.confirmReimport': '用来源的最新内容覆盖「{name}」？当前文件会先存成一个版本',
      'lib.libraryFailed': '读不了模式管理里的版本和导入记录：{reason}',
      'tok.skill': '≈ {n} token',
      'tok.mode': '「{mode}」的 Skill 目录：{n} 个 Skill，约 {tokens} token',
      'tok.modes': 'Skill 目录开销：{list}',
      'tok.entry': '{mode} ≈ {tokens}',
      'tok.hint': '按 DeepSeek 的估算比例（英文字符约 0.3 token、中文字符约 0.6 token）估计模型在每个会话里看到的 Skill 目录；仅手动和已关闭的不计入',
      'detail.tokens': '目录开销',
      'sort.name': '按名称',
      'sort.tokens': '按 token（多到少）',
      'mode.on': '开',
      'mode.manual': '仅手动',
      'mode.model': '仅模型',
      'mode.off': '关',
      'mode.modelHint': '仅模型：模型能看到并加载它，/ 菜单里不显示',
      'reason.modelByModes': '装了模式管理时暂不支持「仅模型」',
      'mode.manualHint': '仅手动：模型看不到它，你仍可以输入 /{name} 调用',
      'reason.manualByModes': '装了模式管理时暂不支持「仅手动」',
      'lib.delete': '移到回收站',
      'lib.confirmDeleteSkill': '把「{name}」移到回收站？它的文件会移出 Skill 目录，各模式都不再加载；版本和设置会保留，可以从回收站恢复',
      'lib.trashed': '已把「{name}」移到回收站',
      'undo': '撤销',
      'trash.button': '回收站（{n}）',
      'trash.title': '回收站',
      'trash.empty': '回收站是空的',
      'trash.note': '回收站里的 Skill 不会自动清除',
      'trash.from': '原位置：{path}',
      'trash.restore': '恢复',
      'trash.purge': '彻底删除',
      'trash.emptyAll': '清空回收站',
      'trash.confirmPurge': '彻底删除「{name}」？删除后不能恢复',
      'trash.confirmEmpty': '彻底删除回收站里的 {n} 个 Skill？删除后不能恢复',
      'trash.restored': '已恢复「{name}」到 {path}',
      'trash.purged': '已彻底删除',
      'trash.emptied': '已清空回收站',
      'skipped.note': '有 {n} 个 Skill 文件没有被 DSH 加载',
      'skipped.show': '查看',
      'skipped.title': '没被加载的 Skill 文件',
      'skipped.intro': 'DSH 遇到这些文件会跳过，只在日志里记一笔。改好后 DSH 会自动重新读取',
      'skipped.reason.bom': '文件开头有不可见的 BOM 字符，DSH 认不出 frontmatter',
      'skipped.reason.no-frontmatter': '缺少 frontmatter：第一行必须正好是 ---，并用另一行 --- 结束',
      'skipped.reason.yaml.unquoted': '第 {line} 行「{key}」的值含有冒号或特殊符号，需要加引号',
      'skipped.reason.yaml.duplicate': '第 {line} 行「{key}」重复出现',
      'skipped.reason.yaml.quote': '第 {line} 行「{key}」的引号没有配对',
      'skipped.reason.yaml.tab': '第 {line} 行用了 Tab 缩进',
      'skipped.reason.missing-name': '缺少 name',
      'skipped.reason.missing-description': '缺少 description',
      'skipped.reason.not-text': '「{key}」不是文字（比如纯数字），需要加引号',
      'skipped.reason.name-invalid': 'name「{name}」不合规：只能用小写字母、数字和连字符',
      'skipped.reason.legacy-key': '「{key}」是旧写法，DSH 不再接受',
      'skipped.reason.invocation-invalid': '「{key}」只能是 true 或 false',
      'skipped.reason.shadowed': '和已加载的「{name}」同名，DSH 用的是 {by}',
      'skipped.reason.unknown': '这里的检查都通过了，具体原因请看 DSH 日志',
      'skipped.fix': '修复',
      'skipped.edit': '编辑',
      'skipped.fixTitle': '改好的内容（保存前还可以再改）',
      'skipped.fixIncomplete': '还需要你补全，比如写上 description',
      'skipped.save': '保存',
      'skipped.saved': '已保存，旧文件已备份',
      'skipped.stillBroken': '已保存，但还有问题：{reason}',
      'lib.importFrom.upload': '上传',
      'upload.drop': '把 Skill 文件夹或 .zip 拖到这里',
      'upload.pickZip': '选择 .zip',
      'upload.pickFolder': '选择文件夹',
      'upload.reading': '正在读取…',
      'upload.tooLarge': '超过 {megabytes} MB 或 {files} 个文件，不能上传',
      'upload.noSkill': '里面没有找到 SKILL.md',
      'upload.note': '上传的 Skill 不记录来源，之后不会提示更新',
      'lib.group.upload': '上传：{name}',
      'lib.origin.upload': '上传',
      'err.trash-unknown': '回收站里没有这一项',
      'err.trash-target-exists': '原位置已经有「{name}」，先处理它再恢复',
      'err.zip-invalid': '这不是有效的 zip 文件',
      'err.zip-unsupported': '不支持这种 zip（加密或 zip64）',
      'err.zip-unsafe-path': 'zip 里有不安全的路径：{path}',
      'err.upload-empty': '上传的内容是空的',
      'err.upload-gone': '上传已过期，请重新上传',
      'err.skill-name-invalid': 'Skill 名无效',
      'err.skill-no-file': '还不知道这个 Skill 的文件位置；请在某个模式列出它时打开一次这个页面',
      'err.skill-read-only': '这个 Skill 属于已安装的包，不能修改文件',
      'err.unknown-version': '没有这个版本',
      'err.version-pinned': '这个版本正在被这些模式使用：{modes}',
      'err.note-too-long': '备注不能超过 {max} 字',
      'err.skill-text-empty': 'Skill 文件不能为空',
      'err.skill-text-too-long': 'Skill 文件不能超过 {max} 字',
      'err.skill-conflict': '文件在你编辑期间被改动了',
      'err.skill-too-large': 'Skill 超过 {files} 个文件或 {megabytes} MB，不能保存版本',
      'err.skill-exists': '已有名为「{name}」的 Skill',
      'err.skill-description-empty': '请填写描述',
      'err.skill-description-invalid': '描述只能有一行，最多 {max} 字',
      'err.folder-missing': '找不到文件夹 {path}',
      'err.skill-no-frontmatter': 'SKILL.md 缺少 name 或 description',
      'err.skill-linked': '这个 Skill 文件夹是链接，覆盖它会改到其他工具的文件',
      'search.body': '正文匹配',
      'meta.alias': '显示名',
      'meta.aliasPlaceholder': '例如 周报（只在这里显示）',
      'meta.tags': '标签',
      'meta.tagsPlaceholder': '用逗号分隔，例如 工作, 写作',
      'meta.hint': '显示名和标签只保存在 Skill 管理里，不会改动 Skill 文件',
      'meta.saved': '已保存',
      'tag.all': '全部标签',
      'bulk.skillOn': '所有模式打开',
      'bulk.skillOff': '所有模式关闭',
      'bulk.listOn': '列表全部打开',
      'bulk.listOff': '列表全部关闭',
      'bulk.listConfirm': '在「{mode}」里关闭当前列表的 {n} 个 Skill？之后可以撤销',
      'bulk.done': '已更改 {n} 项',
      'bulk.nothing': '没有需要更改的项',
      'project.button': '项目',
      'project.title': '项目文件夹',
      'project.hint': '填一个项目文件夹，就能看到它 .dsh/skills 和 .agents/skills 里的 Skill。开关按名字对所有项目生效；会话在该项目里运行时才会加载这些 Skill',
      'project.placeholder': '例如 ~/code/my-app',
      'project.apply': '查看',
      'project.clear': '不看项目',
      'project.active': '正在查看项目 {path}',
      'project.gone': '项目文件夹 {path} 不可用，已改回不看项目',
      'files.title': '文件',
      'files.view': '查看',
      'files.reading': '读取中…',
      'files.show': '文件和导出',
      'files.hide': '收起文件',
      'files.edit': '编辑',
      'files.close': '关闭',
      'files.new': '新建文件',
      'files.newPlaceholder': '相对路径，例如 notes/todo.md',
      'files.saved': '已保存，旧文件已备份',
      'files.created': '已创建',
      'files.deleted': '已删除，旧文件已备份',
      'files.confirmDelete': '删除 {rel}？旧文件会先备份',
      'files.delete': '删除文件',
      'files.export': '导出 zip',
      'files.exported': '已导出 {name}',
      'files.moveAgents': '移到 ~/.agents/skills',
      'files.moveDsh': '移到 ~/.dsh/skills',
      'files.confirmMoveAgents': '把「{name}」移到 ~/.agents/skills？其他 Agent 工具也会读到它',
      'files.confirmMoveDsh': '把「{name}」移到 ~/.dsh/skills？其他 Agent 工具不再读到它',
      'files.moved': '已移到 {path}',
      'files.single': '这个 Skill 是单个 .md 文件，没有其他文件',
      'files.skippedLinks': '{n} 个链接没有列出',
      'lib.importFrom.github': 'GitHub',
      'github.placeholder': '粘贴 GitHub 地址，例如 github.com/anthropics/skills',
      'github.read': '读取',
      'github.reading': '正在从 GitHub 下载…',
      'github.note': '来源会被记住，之后可以检查并一键更新；只支持公开仓库',
      'github.noSkill': '这个地址下没有找到 SKILL.md',
      'github.truncated': '仓库里的 Skill 太多，只列出了前 300 个',
      'github.scripts': '含 {n} 个可运行的脚本（{files}）：安装前先确认来源可信',
      'upload.scripts': '含 {n} 个可运行的脚本（{files}）：先确认来源可信',
      'lib.group.github': 'GitHub：{name}',
      'lib.origin.github': 'GitHub',
      'github.commit': '提交 {commit}',
      'github.gone': '来源里已没有它',
      'github.check': '检查更新',
      'github.checking': '正在检查 GitHub…',
      'github.none': '已检查 {n} 个来自 GitHub 的 Skill，都是最新的',
      'github.found': '{n} 个 Skill 有更新：{names}',
      'github.all': '全部更新（{n}）',
      'github.banner': '{n} 个来自 GitHub 的 Skill 有更新',
      'github.update': '更新',
      'github.updated': '已更新 {n} 个',
      'github.failedRepo': '{repo} 没有检查成功：{reason}',
      'lib.confirmUpdateGithub': '用 GitHub 上的最新内容覆盖「{name}」？当前文件会先存成一个版本',
      'handoff.button': '交给模式管理',
      'handoff.leftover': '另有 {n} 项「仅手动 / 仅模型」模式管理不支持，仍留在 Skill 管理里',
      'handoff.done': '已把 {n} 项「关闭」交给模式管理',
      'err.github-url-invalid': '这不是 GitHub 仓库地址',
      'err.github-not-found': '找不到公开的仓库或分支：{repo}（私有仓库不支持）',
      'err.github-failed': 'GitHub 返回了 {status}',
      'err.github-network': '连不上 GitHub。需要代理时，请先设置 HTTPS_PROXY 和 NODE_USE_ENV_PROXY=1 再启动 DSH',
      'err.github-too-large': '仓库压缩包超过 {megabytes} MB',
      'err.github-gone': '{path} 已经不在仓库里了',
      'err.asset-outside': '路径不在 Skill 文件夹里：{rel}',
      'err.asset-binary': '{rel} 不是文本文件，不能在这里编辑',
      'err.asset-missing': '没有这个文件：{rel}',
      'err.asset-exists': '{rel} 已经存在',
      'err.asset-too-large': '文件太大，超过 {max} 字，不能在这里编辑',
      'err.skill-single-file': '这个 Skill 是单个文件，没有文件夹',
      'err.skill-already-there': '它已经在那个文件夹里了',
      'err.skill-not-in-user-folder': '只有两个用户目录里的 Skill 才能移动',
      'err.alias-invalid': '显示名只能一行，最多 {max} 字',
      'err.tags-invalid': '最多 {max} 个标签，每个不超过 {chars} 字，不能含逗号',
      'err.folder-relative': '请填项目文件夹的完整路径，例如 ~/code/my-app',
      'usage.button': '使用统计',
      'usage.title': '使用统计',
      'usage.intro': '统计各模式的会话里每个 Skill 被加载了多少次：模型调用 skill 工具，或你输入 /名字。只读名称和时间，不读对话内容',
      'usage.days': '最近 {n} 天',
      'usage.summary': '读取了 {scanned} 个会话（共 {total} 个）',
      'usage.truncated': '会话太多，只读了最新的 {n} 个',
      'usage.incomplete': '时间不够，只读了一部分会话；再点一次「重新统计」会接着读，读过的会话已缓存',
      'usage.failed': '{n} 个会话读取失败，没有计入',
      'usage.refresh': '重新统计',
      'usage.loading': '正在统计…',
      'usage.none': '这段时间里没有 Skill 被加载过',
      'usage.calls': '{n} 次',
      'usage.once': '1 次',
      'usage.split': '模型 {model} · 手动 {user}',
      'usage.last': '最近 {when}',
      'usage.inMode': '{mode} {n} 次',
      'usage.unused': '没用过的 Skill（{n}）',
      'usage.unusedHint': '这段时间里任何模式都没加载过它们。想少占点上下文，可以在某个模式里关掉',
      'usage.offIn': '在这个模式关闭',
      'usage.confirmOff': '在「{mode}」里关闭这 {n} 个没用过的 Skill？之后可以撤销',
      'usage.noneUnused': '每个 Skill 在这段时间里都用过',
      'detail.usage': '使用情况',
      'detail.usageNone': '这段时间里没用过',
      'detail.usageLine': '{times}（模型 {model}、手动 {user}），最近 {when}',
      'err.usage-unavailable': '当前组合没有会话历史服务，统计不了使用情况',
      'lib.importFrom.store': '商城',
      'store.placeholder': '搜索 Skill，例如 pdf、code review、数据库',
      'store.search': '搜索',
      'store.hint': '搜索来自 skills.sh（公开的 Skill 目录，数字是它统计的安装次数），搜索词会发给它。点「查看并安装」会先读取仓库、让你勾选，不会直接安装',
      'store.recommended': '推荐的仓库',
      'store.results': '搜索结果（{n}）',
      'store.empty': '没有找到匹配的 Skill',
      'store.installs': '{n} 次安装',
      'store.view': '查看并安装',
      'store.viewRepo': '查看这个仓库',
      'store.installed': '已安装',
      'store.sameName': '已有同名',
      'store.sameNameHint': '已经有一个叫这个名字的 Skill，不是从这个仓库装的；安装时要改名或覆盖',
      'store.searching': '正在搜索…',
      'err.store-query-short': '至少输入 {min} 个字',
      'err.store-network': '连不上 skills.sh。需要代理时，请先设置 HTTPS_PROXY 和 NODE_USE_ENV_PROXY=1 再启动 DSH',
      'err.store-rate-limited': 'skills.sh 请求太频繁，稍等一会儿再搜',
      'err.store-failed': 'skills.sh 返回了 {status}，稍后再试',
    }
    const EN = {
      'nav': 'Skills',
      'title': 'Skill Manager',
      'intro': 'See every skill and turn it on or off per mode',
      'preview': 'Preview',
      'search': 'Search names, descriptions, and text',
      'allModes': 'All modes',
      'refresh': 'Refresh',
      'retry': 'Retry',
      'dismiss': 'Dismiss',
      'count': '{n} skills',
      'available': 'On in {n} of {total} modes',
      'default': 'Default',
      'loadFailed': 'Could not load: {reason}',
      'stateError': 'The Skill Manager settings file cannot be read: {reason}',
      'modeError': 'Could not read "{mode}": {reason}',
      'noRegistry': 'This composition has no skill registry, so no skills are listed',
      'empty.none': 'No skills yet. Put a folder with a SKILL.md into {dsh} or {agents}, then click Refresh',
      'empty.filtered': 'No skills match',
      'managedByModes': 'Mode Manager (dsh-modes) is installed: switches here are saved through it, the same settings as its Skills tab',
      'dormant': '{n} switches saved earlier in Skill Manager are not applied now; they apply again once Mode Manager is uninstalled',
      'detail.path': 'Location',
      'detail.source': 'Source',
      'detail.whenToUse': 'When to use',
      'detail.modes': 'In each mode',
      'state.on': 'On',
      'state.manual': 'Manual only',
      'state.model': 'Model only',
      'state.pinned': 'Pinned version',
      'state.off': 'Off',
      'state.missing': 'Not there',
      'state.error': 'Could not read',
      'toggle.on': 'Turn off in "{mode}"',
      'toggle.off': 'Turn on in "{mode}"',
      'reason.noTool': 'This mode does not load skills',
      'reason.notEditable': 'This mode cannot be changed here',
      'reason.missing': 'This mode does not have this skill',
      'reason.pinnedBy': 'Pinned to a saved version by Mode Manager',
      'effect.applied': 'Saved; running sessions use it from their next step',
      'effect.newSessions': 'Saved; "{modes}" uses it in new sessions',
      'effect.failed': 'The setting is saved, but the rows of "{modes}" could not be changed: {reason}',
      'err.managed-by-modes': 'Mode Manager is installed; refresh the page and try again',
      'err.not-editable': 'This mode cannot be changed here',
      'err.state-damaged': 'The settings file is damaged; fix or delete it, then try again',
      'err.network': 'Cannot reach DSH; try again later',
      'source.project-dsh': 'Project (.dsh/skills)',
      'source.project-agents': 'Project (.agents/skills)',
      'source.custom': 'Custom folder',
      'source.user-dsh': 'DSH user folder',
      'source.user-agents': 'Shared folder',
      'source.bundled': 'Bundled with the mode',
      'source.package': 'From an installed package',
      'source.dsh-modes': 'Mode Manager',
      'source.dsh-mode-skills': 'Skill Manager',
      'lib.create': 'New skill',
      'lib.import': 'Import skills',
      'lib.cancel': 'Cancel',
      'lib.save': 'Save',
      'lib.remove': 'Delete',
      'lib.missing': 'File not found',
      'lib.versions': 'Versions',
      'lib.notePlaceholder': 'Note (optional)',
      'lib.saveVersion': 'Save current as a version',
      'lib.noVersions': 'No saved versions yet',
      'lib.restore': 'Restore to file',
      'lib.view': 'View',
      'lib.hide': 'Hide',
      'lib.confirmRestore': 'Replace the current files of "{name}" with {version}? The current files are saved as a new version first; files the version does not contain are kept',
      'lib.confirmDelete': 'Delete {version} of "{name}"? This cannot be undone',
      'lib.shared': 'This skill is in ~/.agents/skills, which other agent tools share; changing its files affects them too',
      'lib.bundled': 'This skill belongs to an installed package (DSH or a plugin): its files cannot be changed, but you can save versions and turn it off per mode',
      'lib.edit': 'Edit SKILL.md',
      'lib.editHint': 'The current file is saved as a version before your edit is written',
      'lib.conflict': 'The file changed while you were editing. Its current content:',
      'lib.loadLatest': 'Load the current content',
      'lib.overwrite': 'Overwrite anyway',
      'lib.source.manual': 'Saved by hand',
      'lib.source.before-edit': 'Saved before an edit',
      'lib.source.before-restore': 'Saved before a restore',
      'lib.source.before-import': 'Saved before an import',
      'lib.newName': 'Name',
      'lib.newNameHint': 'Lowercase letters, digits, and hyphens, e.g. weekly-report',
      'lib.newNameInvalid': 'Use lowercase letters, digits, and single hyphens, not at the start or end',
      'lib.newNameTaken': 'A skill with this name exists',
      'lib.newDescription': 'Description',
      'lib.newDescriptionHint': 'One sentence on when to use it; the model decides from it whether to load the skill',
      'lib.where': 'Save in',
      'lib.whereDsh': '{path} (DSH only)',
      'lib.whereAgents': '{path} (shared with other agent tools)',
      'lib.onIn': 'On in these modes',
      'lib.createAction': 'Create and edit',
      'lib.created': 'Created {name}',
      'lib.newEffect': 'Available to running sessions from their next step',
      'lib.saved': 'Saved',
      'lib.versionSaved': 'Version saved',
      'lib.restored': 'Restored to the file; the previous file was saved as a version',
      'lib.deleted': 'Version deleted',
      'lib.importFrom.agents': 'Codex / Claude Code',
      'lib.importFrom.folder': 'Folder',
      'lib.folderPlaceholder': 'A skill folder, or a folder of skills, e.g. ~/my-skills',
      'lib.read': 'Read',
      'lib.group.codex': 'Codex',
      'lib.group.claude': 'Claude Code',
      'lib.group.claude-plugin': 'Claude Code plugins',
      'lib.group.codex-system': 'Skills shipped with Codex',
      'lib.group.folder': 'Folder',
      'lib.groupMissing': 'This folder does not exist',
      'lib.groupEmpty': 'No skills found',
      'lib.systemHint': 'These skills rely on Codex\'s own tools and may not work in DSH',
      'lib.st.new': 'Ready',
      'lib.st.imported': 'Imported as {name}',
      'lib.st.updated': 'Source changed',
      'lib.st.exists': 'Name in use',
      'lib.st.rename': 'Needs a new name',
      'lib.st.invalid': 'Cannot import',
      'lib.problem.no-frontmatter': 'SKILL.md is missing name or description',
      'lib.problem.unreadable': 'SKILL.md cannot be read',
      'lib.importAs': 'Import as',
      'lib.conflictRename': 'Import under a new name',
      'lib.conflictReplace': 'Replace the existing skill (saves a version first)',
      'lib.updatedHint': 'Importing again replaces {name}; its current files are saved as a version first',
      'lib.nameDuplicate': 'Another skill being imported has this name',
      'lib.selectReady': 'Select all ready',
      'lib.selectNone': 'Select none',
      'lib.importSelected': 'Import selected ({n})',
      'lib.copyNote': 'Imports are copies: when a source changes later, this list and the skill list say so, and you can import it again',
      'lib.importDone': 'Imported {n}',
      'lib.importUpdated': 'Updated {n}',
      'lib.importFailed': '{n} did not complete',
      'lib.importFailure': '{name}: {reason}',
      'lib.importSkipped': '{name}: {n} links point outside the skill and were not copied',
      'lib.origin': 'From {source} · {path}',
      'lib.origin.codex': 'Codex',
      'lib.origin.codex-system': 'Codex (shipped)',
      'lib.origin.claude': 'Claude Code',
      'lib.origin.claude-plugin': 'Claude Code plugin',
      'lib.origin.folder': 'Folder',
      'lib.sourceChanged': 'Source changed',
      'lib.sourceMissing': 'Source is gone',
      'lib.reimport': 'Import again from the source',
      'lib.confirmReimport': 'Replace {name} with the latest content of its source? Its current files are saved as a version first',
      'lib.libraryFailed': 'Could not read the versions and import records of Mode Manager: {reason}',
      'tok.skill': '≈ {n} tokens',
      'tok.mode': 'Skill catalog of "{mode}": {n} skills, about {tokens} tokens',
      'tok.modes': 'Skill catalog cost: {list}',
      'tok.entry': '{mode} ≈ {tokens}',
      'tok.hint': 'Estimated with DeepSeek\'s ratios (about 0.3 tokens per English character, 0.6 per Chinese character) for the skill catalog the model sees in each session; manual-only and turned-off skills are not counted',
      'detail.tokens': 'Catalog cost',
      'sort.name': 'By name',
      'sort.tokens': 'By tokens (most first)',
      'mode.on': 'On',
      'mode.manual': 'Manual',
      'mode.model': 'Model',
      'mode.off': 'Off',
      'mode.modelHint': 'Model only: the model can see and load it; the / menu does not offer it',
      'reason.modelByModes': 'Model only is not supported while Mode Manager is installed',
      'mode.manualHint': 'Manual only: the model does not see it; you can still start it with /{name}',
      'reason.manualByModes': 'Manual only is not available while Mode Manager is installed',
      'lib.delete': 'Move to trash',
      'lib.confirmDeleteSkill': 'Move "{name}" to the trash? Its files leave the skill folder and no mode loads it; its versions and settings are kept, and it can be restored from the trash',
      'lib.trashed': 'Moved "{name}" to the trash',
      'undo': 'Undo',
      'trash.button': 'Trash ({n})',
      'trash.title': 'Trash',
      'trash.empty': 'The trash is empty',
      'trash.note': 'Skills in the trash are never removed on their own',
      'trash.from': 'From {path}',
      'trash.restore': 'Restore',
      'trash.purge': 'Delete for good',
      'trash.emptyAll': 'Empty the trash',
      'trash.confirmPurge': 'Delete "{name}" for good? This cannot be undone',
      'trash.confirmEmpty': 'Delete the {n} skills in the trash for good? This cannot be undone',
      'trash.restored': 'Restored "{name}" to {path}',
      'trash.purged': 'Deleted for good',
      'trash.emptied': 'The trash is empty',
      'skipped.note': '{n} skill files are not loaded by DSH',
      'skipped.show': 'Show',
      'skipped.title': 'Skill files DSH does not load',
      'skipped.intro': 'DSH skips these files and only notes it in its log. Once fixed, DSH reads them again by itself',
      'skipped.reason.bom': 'The file starts with an invisible byte-order mark, so DSH does not see the frontmatter',
      'skipped.reason.no-frontmatter': 'No frontmatter: the first line must be exactly --- and another --- line must end it',
      'skipped.reason.yaml.unquoted': 'Line {line}: the value of "{key}" has a colon or special character and needs quotes',
      'skipped.reason.yaml.duplicate': 'Line {line}: "{key}" appears twice',
      'skipped.reason.yaml.quote': 'Line {line}: the quotes of "{key}" do not match',
      'skipped.reason.yaml.tab': 'Line {line}: indented with a tab',
      'skipped.reason.missing-name': 'No name',
      'skipped.reason.missing-description': 'No description',
      'skipped.reason.not-text': '"{key}" is not text (a bare number, for example) and needs quotes',
      'skipped.reason.name-invalid': 'The name "{name}" is not valid: use lowercase letters, digits, and hyphens',
      'skipped.reason.legacy-key': '"{key}" is an old spelling DSH no longer accepts',
      'skipped.reason.invocation-invalid': '"{key}" must be true or false',
      'skipped.reason.shadowed': 'Same name as the loaded "{name}"; DSH uses {by}',
      'skipped.reason.unknown': 'It passes every check here; DSH\'s log has the reason',
      'skipped.fix': 'Fix',
      'skipped.edit': 'Edit',
      'skipped.fixTitle': 'The fixed content (you can still change it before saving)',
      'skipped.fixIncomplete': 'Still needs your input, such as a description',
      'skipped.save': 'Save',
      'skipped.saved': 'Saved; the old file was backed up',
      'skipped.stillBroken': 'Saved, but it still has a problem: {reason}',
      'lib.importFrom.upload': 'Upload',
      'upload.drop': 'Drop skill folders or a .zip here',
      'upload.pickZip': 'Choose a .zip',
      'upload.pickFolder': 'Choose a folder',
      'upload.reading': 'Reading…',
      'upload.tooLarge': 'More than {megabytes} MB or {files} files; it cannot be uploaded',
      'upload.noSkill': 'No SKILL.md found in it',
      'upload.note': 'Uploaded skills keep no source, so later changes are not flagged',
      'lib.group.upload': 'Upload: {name}',
      'lib.origin.upload': 'Upload',
      'err.trash-unknown': 'This entry is not in the trash',
      'err.trash-target-exists': '"{name}" is already there; deal with it before restoring',
      'err.zip-invalid': 'This is not a valid zip file',
      'err.zip-unsupported': 'This kind of zip is not supported (encrypted or zip64)',
      'err.zip-unsafe-path': 'The zip has an unsafe path: {path}',
      'err.upload-empty': 'The upload is empty',
      'err.upload-gone': 'The upload has expired; upload it again',
      'err.skill-name-invalid': 'Invalid skill name',
      'err.skill-no-file': 'The location of this skill is not known yet; open this page once while a mode lists it',
      'err.skill-read-only': 'This skill belongs to an installed package; its files cannot be changed',
      'err.unknown-version': 'No such version',
      'err.version-pinned': 'This version is used by: {modes}',
      'err.note-too-long': 'The note cannot exceed {max} characters',
      'err.skill-text-empty': 'The skill file cannot be empty',
      'err.skill-text-too-long': 'The skill file cannot exceed {max} characters',
      'err.skill-conflict': 'The file changed while you were editing',
      'err.skill-too-large': 'The skill has more than {files} files or {megabytes} MB, so it cannot be saved as a version',
      'err.skill-exists': 'A skill named {name} already exists',
      'err.skill-description-empty': 'Enter a description',
      'err.skill-description-invalid': 'The description must be one line of at most {max} characters',
      'err.folder-missing': 'No folder at {path}',
      'err.skill-no-frontmatter': 'SKILL.md is missing name or description',
      'err.skill-linked': 'This skill folder is a link; replacing it would change another tool\'s files',
      'search.body': 'Text match',
      'meta.alias': 'Display name',
      'meta.aliasPlaceholder': 'For example Weekly report (shown only here)',
      'meta.tags': 'Tags',
      'meta.tagsPlaceholder': 'Separated by commas, e.g. work, writing',
      'meta.hint': 'The display name and tags are kept in Skill Manager only; the skill file is not changed',
      'meta.saved': 'Saved',
      'tag.all': 'All tags',
      'bulk.skillOn': 'On in all modes',
      'bulk.skillOff': 'Off in all modes',
      'bulk.listOn': 'Turn all on',
      'bulk.listOff': 'Turn all off',
      'bulk.listConfirm': 'Turn off the {n} skills in this list in "{mode}"? You can undo it afterwards',
      'bulk.done': 'Changed {n}',
      'bulk.nothing': 'Nothing to change',
      'project.button': 'Project',
      'project.title': 'Project folder',
      'project.hint': 'Give a project folder to see the skills in its .dsh/skills and .agents/skills. Switches apply to every project by name; sessions load these skills only while they run in that project',
      'project.placeholder': 'For example ~/code/my-app',
      'project.apply': 'Show',
      'project.clear': 'No project',
      'project.active': 'Showing project {path}',
      'project.gone': 'The project folder {path} is not available; back to no project',
      'files.title': 'Files',
      'files.view': 'View',
      'files.reading': 'Reading…',
      'files.show': 'Files and export',
      'files.hide': 'Hide files',
      'files.edit': 'Edit',
      'files.close': 'Close',
      'files.new': 'New file',
      'files.newPlaceholder': 'Relative path, e.g. notes/todo.md',
      'files.saved': 'Saved; the old file was backed up',
      'files.created': 'Created',
      'files.deleted': 'Deleted; the old file was backed up',
      'files.confirmDelete': 'Delete {rel}? The old file is backed up first',
      'files.delete': 'Delete file',
      'files.export': 'Export zip',
      'files.exported': 'Exported {name}',
      'files.moveAgents': 'Move to ~/.agents/skills',
      'files.moveDsh': 'Move to ~/.dsh/skills',
      'files.confirmMoveAgents': 'Move "{name}" to ~/.agents/skills? Other agent tools will read it too',
      'files.confirmMoveDsh': 'Move "{name}" to ~/.dsh/skills? Other agent tools will stop reading it',
      'files.moved': 'Moved to {path}',
      'files.single': 'This skill is a single .md file with no other files',
      'files.skippedLinks': '{n} links are not listed',
      'lib.importFrom.github': 'GitHub',
      'github.placeholder': 'Paste a GitHub address, e.g. github.com/anthropics/skills',
      'github.read': 'Read',
      'github.reading': 'Downloading from GitHub…',
      'github.note': 'The source is remembered, so you can check for updates and apply them in one click; public repositories only',
      'github.noSkill': 'No SKILL.md found at this address',
      'github.truncated': 'The repository has too many skills; only the first 300 are listed',
      'github.scripts': '{n} runnable scripts ({files}): make sure you trust the source before installing',
      'upload.scripts': '{n} runnable scripts ({files}): make sure you trust the source',
      'lib.group.github': 'GitHub: {name}',
      'lib.origin.github': 'GitHub',
      'github.commit': 'commit {commit}',
      'github.gone': 'No longer in the source',
      'github.check': 'Check for updates',
      'github.checking': 'Checking GitHub…',
      'github.none': 'Checked {n} skills from GitHub; all are up to date',
      'github.found': '{n} skills have updates: {names}',
      'github.all': 'Update all ({n})',
      'github.banner': '{n} skills from GitHub have updates',
      'github.update': 'Update',
      'github.updated': 'Updated {n}',
      'github.failedRepo': 'Could not check {repo}: {reason}',
      'lib.confirmUpdateGithub': 'Replace "{name}" with the latest from GitHub? The current files are saved as a version first',
      'handoff.button': 'Hand over to Mode Manager',
      'handoff.leftover': '{n} Manual / Model-only settings are not supported by Mode Manager and stay in Skill Manager',
      'handoff.done': 'Handed {n} Off settings over to Mode Manager',
      'err.github-url-invalid': 'This is not a GitHub repository address',
      'err.github-not-found': 'No public repository or branch found: {repo} (private repositories are not supported)',
      'err.github-failed': 'GitHub answered {status}',
      'err.github-network': 'Cannot reach GitHub. If you need a proxy, set HTTPS_PROXY and NODE_USE_ENV_PROXY=1 before starting DSH',
      'err.github-too-large': 'The repository archive is larger than {megabytes} MB',
      'err.github-gone': '{path} is no longer in the repository',
      'err.asset-outside': 'Not a path inside the skill folder: {rel}',
      'err.asset-binary': '{rel} is not a text file and cannot be edited here',
      'err.asset-missing': 'No such file: {rel}',
      'err.asset-exists': '{rel} already exists',
      'err.asset-too-large': 'The file is larger than {max} characters and cannot be edited here',
      'err.skill-single-file': 'This skill is a single file, not a folder',
      'err.skill-already-there': 'It is already in that folder',
      'err.skill-not-in-user-folder': 'Only skills in the two user folders can be moved',
      'err.alias-invalid': 'The display name must be one line of at most {max} characters',
      'err.tags-invalid': 'At most {max} tags of {chars} characters each, without commas',
      'err.folder-relative': 'Give the full path of the project folder, e.g. ~/code/my-app',
      'usage.button': 'Usage',
      'usage.title': 'Usage',
      'usage.intro': 'How often each skill was loaded in each mode\'s sessions: the model calling the skill tool, or you typing /name. Only names and times are read, never message text',
      'usage.days': 'Last {n} days',
      'usage.summary': 'Read {scanned} sessions (of {total})',
      'usage.truncated': 'There are many sessions; only the newest {n} were read',
      'usage.incomplete': 'Time ran out and only some sessions were read; press Count again to continue, sessions already read are cached',
      'usage.failed': '{n} sessions could not be read and are not counted',
      'usage.refresh': 'Count again',
      'usage.loading': 'Counting…',
      'usage.none': 'No skill was loaded in this time',
      'usage.calls': '{n} times',
      'usage.once': '1 time',
      'usage.split': 'model {model} · manual {user}',
      'usage.last': 'last {when}',
      'usage.inMode': '{mode} {n}',
      'usage.unused': 'Skills never used ({n})',
      'usage.unusedHint': 'No mode loaded these in this time. To save context, turn them off in a mode',
      'usage.offIn': 'Turn off in this mode',
      'usage.confirmOff': 'Turn off these {n} unused skills in "{mode}"? You can undo it afterwards',
      'usage.noneUnused': 'Every skill was used in this time',
      'detail.usage': 'Usage',
      'detail.usageNone': 'Not used in this time',
      'detail.usageLine': '{times} (model {model}, manual {user}), last {when}',
      'err.usage-unavailable': 'This composition has no session history, so usage cannot be counted',
      'lib.importFrom.store': 'Store',
      'store.placeholder': 'Search skills, e.g. pdf, code review, database',
      'store.search': 'Search',
      'store.hint': 'Search is served by skills.sh, a public skill directory (the number is its install count); your search text is sent to it. View and install reads the repository and lets you choose; nothing is installed right away',
      'store.recommended': 'Recommended repositories',
      'store.results': 'Results ({n})',
      'store.empty': 'No matching skills',
      'store.installs': '{n} installs',
      'store.view': 'View and install',
      'store.viewRepo': 'View this repository',
      'store.installed': 'Installed',
      'store.sameName': 'Name taken',
      'store.sameNameHint': 'A skill with this name exists that did not come from this repository; installing means renaming or replacing it',
      'store.searching': 'Searching…',
      'err.store-query-short': 'Type at least {min} characters',
      'err.store-network': 'Cannot reach skills.sh. If you need a proxy, set HTTPS_PROXY and NODE_USE_ENV_PROXY=1 before starting DSH',
      'err.store-rate-limited': 'skills.sh asks to slow down; search again in a moment',
      'err.store-failed': 'skills.sh answered {status}; try again later',
    }

    const CSS = `
.sk { --sk-r-sm: var(--dsw-radius-sm, 8px); --sk-r-md: var(--dsw-radius-md, 12px); --sk-tint: var(--dsw-alias-interactive-bg-hover); box-sizing: border-box; height: 100%; overflow-y: auto; color: var(--dsw-alias-label-primary); font-size: 13px; }
.sk-inner { container-type: inline-size; box-sizing: border-box; max-width: 880px; margin: 0 auto; padding: 28px 32px 40px; display: flex; flex-direction: column; gap: 14px; }
.sk h1 { margin: 0; font-size: 20px; font-weight: 500; }
.sk-sub { margin: 4px 0 0; color: var(--dsw-alias-label-secondary); }
.sk-bar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.sk-grow { flex: 1 1 auto; min-width: 0; }
.sk-input, .sk-select { box-sizing: border-box; min-width: 0; font: inherit; padding: 6px 10px; border-radius: var(--sk-r-sm); border: .5px solid var(--dsw-alias-border-l3); background: var(--dsw-alias-bg-layer-1); color: inherit; }
.sk-input { flex: 1 1 220px; }
.sk-btn { font: inherit; font-size: 12px; padding: 5px 12px; border-radius: var(--sk-r-sm); border: .5px solid var(--dsw-alias-border-l3); background: transparent; color: inherit; cursor: pointer; white-space: nowrap; }
.sk-btn:disabled { opacity: .5; cursor: default; }
.sk-hint { color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 1.5; }
.sk-note { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 8px 10px; border-radius: var(--sk-r-sm); background: var(--sk-tint); font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-secondary); }
.sk-note.is-warn { color: var(--dsw-alias-state-warn-primary); }
.sk-note.is-done { color: var(--dsw-alias-state-success-primary); }
.sk-list { display: flex; flex-direction: column; gap: 8px; }
.sk-row { border: .5px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l3)); border-radius: var(--sk-r-md); background: var(--dsw-alias-settings-card-fill, transparent); }
.sk-top { display: flex; align-items: center; border-radius: var(--sk-r-md); }
.sk-head { flex: 1 1 auto; min-width: 0; display: flex; gap: 10px; align-items: center; box-sizing: border-box; padding: 10px 12px; font: inherit; text-align: left; border: 0; border-radius: var(--sk-r-md); background: none; color: inherit; cursor: pointer; }
.sk-name { font-family: var(--dsw-font-mono, ui-monospace, monospace); font-weight: 500; white-space: nowrap; }
.sk-desc { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-secondary); }
.sk-row.is-open .sk-desc { visibility: hidden; }
.sk-chip { flex: none; font: inherit; font-size: 11px; line-height: 18px; padding: 0 7px; border: 0; border-radius: var(--sk-r-sm); background: var(--sk-tint); color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.sk-chip.is-off { color: var(--dsw-alias-label-tertiary); text-decoration: line-through; }
.sk-chip.is-pinned { color: var(--dsw-alias-state-business-primary); }
button.sk-chip { cursor: pointer; }
button.sk-chip:disabled { cursor: default; opacity: .6; }
.sk-meta { flex: none; color: var(--dsw-alias-label-tertiary); font-size: 12px; white-space: nowrap; }
.sk-caret { flex: none; color: var(--dsw-alias-label-tertiary); transition: transform .16s; }
.sk-row.is-open .sk-caret { transform: rotate(90deg); }
.sk-body { display: flex; flex-direction: column; gap: 10px; padding: 0 12px 12px 12px; }
.sk-full { margin: 0; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; }
.sk-details { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 6px 12px; padding: 8px 10px; border-radius: var(--sk-r-sm); background: var(--sk-tint); font-size: 12px; line-height: 1.5; }
.sk-details dt { color: var(--dsw-alias-label-tertiary); }
.sk-details dd { margin: 0; overflow-wrap: anywhere; }
.sk-path { font-family: var(--dsw-font-mono, ui-monospace, monospace); }
.sk-modes { display: flex; gap: 6px; flex-wrap: wrap; }
.sk-switch { flex: none; position: relative; width: 30px; height: 18px; margin-right: 12px; padding: 0; border: 0; border-radius: 9px; background: var(--dsw-alias-border-l3); cursor: pointer; transition: background .16s; }
.sk-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, .2); transition: transform .16s; }
.sk-switch[aria-checked="true"] { background: var(--dsw-alias-state-business-primary); }
.sk-switch[aria-checked="true"]::after { transform: translateX(12px); }
.sk-switch:disabled { opacity: .4; cursor: default; }
.sk-skeleton { display: flex; flex-direction: column; gap: 8px; }
.sk-skeleton span { display: block; height: 40px; border-radius: var(--sk-r-md); background: var(--sk-tint); animation: sk-pulse .9s ease-in-out infinite alternate; }
.sk-end { justify-content: flex-end; }
.sk-primary { background: var(--dsw-alias-button-primary-fill); border-color: transparent; color: var(--dsw-alias-bg-layer-1); }
.sk-danger { color: var(--dsw-alias-state-danger-primary, #d93025); }
.sk-panel { display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; border-radius: var(--sk-r-md); border: .5px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l3)); background: var(--dsw-alias-settings-card-fill, transparent); }
.sk-form { display: flex; gap: 12px; flex-wrap: wrap; }
.sk-field { display: flex; flex-direction: column; gap: 4px; flex: 1 1 240px; min-width: 0; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.sk-field .sk-input, .sk-field .sk-select { flex: none; width: 100%; color: var(--dsw-alias-label-primary); }
.sk-hint.is-error, .sk-error { color: var(--dsw-alias-state-danger-primary, #d93025); }
.sk-hint.is-warn { color: var(--dsw-alias-state-warn-primary); }
.sk-alias { font-weight: 500; white-space: nowrap; }
.sk-name.is-dim { font-weight: 400; font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.sk-chip.is-tag { color: var(--dsw-alias-state-business-primary); }
.sk-option { display: inline-flex; gap: 6px; align-items: center; font-size: 12px; }
.sk-textarea { width: 100%; box-sizing: border-box; min-height: 260px; font-family: var(--dsw-font-mono, ui-monospace, monospace); font-size: 12px; line-height: 1.5; resize: vertical; }
.sk-confirm { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border-radius: var(--sk-r-sm); background: var(--sk-tint); }
.sk-section { display: flex; flex-direction: column; gap: 6px; }
.sk-label { font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.sk-version { display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; border-radius: var(--sk-r-sm); border: .5px solid var(--dsw-alias-border-l3); }
.sk-pre { margin: 0; max-height: 200px; overflow: auto; padding: 8px 10px; border-radius: var(--sk-r-sm); background: var(--sk-tint); white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; line-height: 1.5; }
.sk-badge { flex: none; font-size: 11px; line-height: 18px; padding: 0 7px; border-radius: var(--sk-r-sm); background: var(--sk-tint); color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.sk-badge.is-accent { color: var(--dsw-alias-state-business-primary); }
.sk-badge.is-warn { color: var(--dsw-alias-state-warn-primary); }
.sk-badge.is-error { color: var(--dsw-alias-state-danger-primary, #d93025); }
.sk-seg { display: inline-flex; align-self: flex-start; border: .5px solid var(--dsw-alias-border-l3); border-radius: var(--sk-r-sm); overflow: hidden; }
.sk-seg button { font: inherit; font-size: 12px; padding: 4px 12px; border: 0; background: transparent; color: inherit; cursor: pointer; }
.sk-seg button[aria-checked="true"] { background: var(--sk-tint); font-weight: 500; }
.sk-group { display: flex; flex-direction: column; gap: 6px; }
.sk-grouphead { display: flex; gap: 8px; align-items: center; padding: 4px 0; font: inherit; border: 0; background: none; color: inherit; cursor: pointer; text-align: left; }
.sk-importrow { display: flex; gap: 10px; align-items: flex-start; padding: 8px 10px; border-radius: var(--sk-r-sm); border: .5px solid var(--dsw-alias-border-l3); }
.sk-importrow input[type="checkbox"] { margin-top: 3px; }
.sk-rowmain { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1 1 auto; }
.sk-link { font: inherit; font-size: 12px; padding: 0; border: 0; background: none; color: var(--dsw-alias-state-business-primary); cursor: pointer; }
.sk-seg.is-small button { padding: 2px 9px; font-size: 11px; }
.sk-seg button:disabled { opacity: .45; cursor: default; }
.sk-moderows { display: flex; flex-direction: column; gap: 6px; }
.sk-moderow { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.sk-moderow .sk-modename { min-width: 96px; }
.sk-drop { display: flex; flex-direction: column; gap: 8px; align-items: center; justify-content: center; padding: 22px 12px; border-radius: var(--sk-r-md); border: 1px dashed var(--dsw-alias-border-l3); text-align: center; color: var(--dsw-alias-label-secondary); }
.sk-drop.is-over { border-color: var(--dsw-alias-state-business-primary); background: var(--sk-tint); }
.sk-entry { display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; border-radius: var(--sk-r-sm); border: .5px solid var(--dsw-alias-border-l3); }
@keyframes sk-pulse { from { opacity: .45 } to { opacity: .9 } }
@media (prefers-reduced-motion: reduce) { .sk-skeleton span { animation: none; } .sk-caret, .sk-switch, .sk-switch::after { transition: none; } }
@media (hover: hover) { .sk-head:hover, .sk-btn:hover:not(:disabled), button.sk-chip:hover:not(:disabled), .sk-seg button:hover, .sk-grouphead:hover { background: var(--dsw-alias-interactive-bg-hover-accent, var(--sk-tint)); } .sk-primary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover, var(--dsw-alias-button-primary-fill)); } .sk-link:hover { text-decoration: underline; } }
@container (max-width: 560px) { .sk-desc { display: none; } }
`

    class ActionFailure extends Error {
      constructor(code, message, details) {
        super(message)
        this.code = code
        this.details = details
      }
    }

    async function post(route, action, payload) {
      let response
      try {
        response = await fetch(route, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action, ...payload }),
        })
      } catch {
        throw new ActionFailure('network', 'Network error')
      }
      if (!response.ok) throw new ActionFailure(response.status === 404 ? 'network' : 'failed', `HTTP ${response.status}`)
      const body = await response.json()
      if (body.ok !== true) throw new ActionFailure(body.code ?? 'failed', body.error, body.details)
      return body.value
    }

    /**
     * Run a skill library action of whichever plugin owns the library. dsh-modes answers a change with its whole
     * list plus `effect`, and names the modes it could not update `rows`; the answer is read the same either way.
     */
    async function lib(manager, action, payload) {
      const value = await post(manager === 'dsh-modes' ? MODES_ROUTE : ROUTE, action, payload)
      const effect = manager === 'dsh-modes' && value?.effect !== undefined ? value.effect : value
      return effect?.rows !== undefined && effect.failed === undefined ? { ...effect, failed: effect.rows } : effect
    }

    /**
     * Save `{ preset, skill, enabled }` changes through whichever plugin owns the skill settings.
     * @returns {Promise<{ failed: { id: string, error: string }[], mounted: string[] }>}
     */
    async function saveChanges(manager, changes) {
      if (manager === 'dsh-modes') {
        const value = await post(MODES_ROUTE, 'setSkillModes', { changes })
        return { failed: value.effect?.rows ?? [], mounted: value.effect?.mounted ?? [] }
      }
      return post(ROUTE, 'setModes', { changes })
    }

    /** The most an upload may hold, as the Host's version limits allow. */
    const UPLOAD_MAX_BYTES = 25 * 1024 * 1024
    const UPLOAD_MAX_FILES = 1000
    /** Display names of agent tools whose skill folders the import list reads. */
    const AGENT_LABELS = {
      amp: 'Amp', antigravity: 'Antigravity', augment: 'Augment', cline: 'Cline', codebuddy: 'CodeBuddy', continue: 'Continue',
      copilot: 'GitHub Copilot', cursor: 'Cursor', factory: 'Factory', gemini: 'Gemini CLI', goose: 'Goose', kiro: 'Kiro',
      opencode: 'OpenCode', qwen: 'Qwen Code', roo: 'Roo Code', trae: 'Trae', windsurf: 'Windsurf', workbuddy: 'WorkBuddy', zcode: 'ZCode',
    }

    /** Where an imported skill came from, for its source line. */
    function originLabel(t, source) {
      if (typeof source === 'string' && source.startsWith('agent:')) return AGENT_LABELS[source.slice(6)] ?? `~/.${source.slice(6)}`
      return t(`lib.origin.${source}`)
    }

    function toBase64(buffer) {
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(at, at + 0x8000))
      return btoa(binary)
    }

    /** Every file below a dropped file or folder entry, with its path from the drop. */
    async function filesOfEntry(entry, out) {
      if (entry.isFile) {
        out.push({ path: entry.fullPath.replace(/^\/+/, ''), file: await new Promise((resolve, reject) => entry.file(resolve, reject)) })
        return
      }
      if (!entry.isDirectory) return
      const reader = entry.createReader()
      for (;;) {
        const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject))
        if (batch.length === 0) return
        for (const child of batch) await filesOfEntry(child, out)
      }
    }

    /**
     * The request body for what was dropped or picked: one `.zip`, or files with their relative paths.
     * @returns {Promise<object | undefined>} undefined when it is past the upload limits.
     */
    async function uploadBody(items) {
      const total = items.reduce((sum, item) => sum + item.file.size, 0)
      if (total > UPLOAD_MAX_BYTES || items.length > UPLOAD_MAX_FILES) return undefined
      if (items.length === 1 && /\.zip$/i.test(items[0].file.name)) return { name: items[0].file.name, zip: toBase64(await items[0].file.arrayBuffer()) }
      const name = items[0]?.path.split('/')[0] ?? 'upload'
      return { name, files: await Promise.all(items.map(async item => ({ path: item.path, data: toBase64(await item.file.arrayBuffer()) }))) }
    }

    /** A confirmation shown in place: the question, Cancel, and the action. */
    function ConfirmBox({ ui, text, action, danger, busy, onCancel, onConfirm }) {
      return h('div', { className: 'sk-confirm', role: 'alertdialog', 'aria-label': action, onKeyDown: onEscape(onCancel) },
        h('div', null, text),
        h('div', { className: 'sk-bar sk-end' },
          h('button', { type: 'button', className: 'sk-btn', autoFocus: true, onClick: onCancel }, ui.t('lib.cancel')),
          h('button', { type: 'button', className: `sk-btn ${danger ? 'sk-danger' : 'sk-primary'}`, disabled: busy, onClick: onConfirm }, action)))
    }

    function SidebarIcon({ size }) {
      return h('svg', { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, strokeLinejoin: 'round', 'aria-hidden': true },
        h('path', { d: 'M2.5 3.5c0-.6.4-1 1-1H6c.8 0 1.5.7 1.5 1.5v9c0-.6-.5-1-1-1h-3c-.6 0-1-.4-1-1v-7.5z' }),
        h('path', { d: 'M13.5 3.5c0-.6-.4-1-1-1H10c-.8 0-1.5.7-1.5 1.5v9c0-.6.5-1 1-1h3c.6 0 1-.4 1-1v-7.5z' }),
        h('path', { d: 'M11 5.2l.4 1 1 .4-1 .4-.4 1-.4-1-1-.4 1-.4z', fill: 'currentColor', stroke: 'none' }))
    }

    /** How a skill stands in one mode, and why it cannot be switched there when it cannot. */
    function cell(ui, data, skill, mode) {
      const state = data.errors[mode.id] !== undefined ? 'error' : skill.modes[mode.id] ?? 'missing'
      let reason
      if (state === 'error') reason = data.errors[mode.id]
      else if (!mode.hasSkillTool) reason = ui.t('reason.noTool')
      else if (data.manager === 'self' && !mode.editable) reason = ui.t('reason.notEditable')
      else if (state === 'missing') reason = ui.t('reason.missing')
      return { state, on: state !== 'off' && state !== 'missing' && state !== 'error', reason }
    }

    function versionLabel(lang, version) {
      const when = new Date(version.at).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })
      return [version.id, when, version.note].filter(Boolean).join(' · ')
    }

    /** Escape closes a panel or a confirmation without also closing what surrounds it. */
    function onEscape(close) {
      return (event) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        event.stopPropagation()
        close()
      }
    }

    /** The folder menu for new skills: DSH's own folder or the one shared with other agent tools. */
    function WhereSelect({ ui, roots, value, onChange, id }) {
      const { t } = ui
      return h('select', { id, className: 'sk-select', value, onChange: event => onChange(event.target.value) },
        h('option', { value: 'dsh' }, t('lib.whereDsh', { path: roots.dsh })),
        h('option', { value: 'agents' }, t('lib.whereAgents', { path: roots.agents })))
    }

    /** The modes a new skill can start on in: those that load skills and whose settings can be saved. */
    function usableModes(data) {
      return data.modes.filter(mode => mode.hasSkillTool && data.errors[mode.id] === undefined && (data.manager === 'dsh-modes' || mode.editable))
    }

    /** The form for a new skill: name, description, folder, and the modes it starts on in. */
    function CreateSkillPanel({ ui, data, busy, onCancel, onCreate }) {
      const { t } = ui
      const usable = usableModes(data)
      const [name, setName] = React.useState('')
      const [description, setDescription] = React.useState('')
      const [target, setTarget] = React.useState('dsh')
      const [modes, setModes] = React.useState(() => new Set(usable.map(mode => mode.id)))
      const trimmed = name.trim()
      const nameError = trimmed === '' ? undefined : !SKILL_NAME.test(trimmed) ? t('lib.newNameInvalid') : data.skills.some(skill => skill.name === trimmed) ? t('lib.newNameTaken') : undefined
      const ready = trimmed !== '' && nameError === undefined && description.trim() !== '' && !busy
      const toggle = (id, on) => setModes((previous) => {
        const next = new Set(previous)
        if (on) next.add(id)
        else next.delete(id)
        return next
      })
      const submit = (event) => {
        event.preventDefault()
        if (ready) onCreate({ name: trimmed, description: description.trim(), target, ...modes.size === usable.length ? {} : { modes: [...modes] } })
      }
      return h('form', { className: 'sk-panel', onSubmit: submit, 'aria-label': t('lib.create'), onKeyDown: onEscape(onCancel) },
        h('strong', null, t('lib.create')),
        h('div', { className: 'sk-form' },
          h('label', { className: 'sk-field' }, t('lib.newName'),
            h('input', { className: 'sk-input', value: name, autoFocus: true, spellCheck: false, placeholder: 'weekly-report', 'aria-invalid': nameError !== undefined, onChange: event => setName(event.target.value) }),
            h('span', { className: `sk-hint${nameError === undefined ? '' : ' is-error'}` }, nameError ?? t('lib.newNameHint'))),
          h('label', { className: 'sk-field' }, t('lib.where'), h(WhereSelect, { ui, roots: data.roots, value: target, onChange: setTarget }))),
        h('label', { className: 'sk-field' }, t('lib.newDescription'),
          h('input', { className: 'sk-input', value: description, maxLength: 1024, onChange: event => setDescription(event.target.value) }),
          h('span', { className: 'sk-hint' }, t('lib.newDescriptionHint'))),
        usable.length === 0 ? null : h('div', { className: 'sk-section', role: 'group', 'aria-label': t('lib.onIn') },
          h('span', { className: 'sk-label' }, t('lib.onIn')),
          h('div', { className: 'sk-modes' }, usable.map(mode => h('label', { key: mode.id, className: 'sk-option' },
            h('input', { type: 'checkbox', checked: modes.has(mode.id), onChange: event => toggle(mode.id, event.target.checked) }),
            h('span', null, ui.modeName(mode)))))),
        h('div', { className: 'sk-bar sk-end' },
          h('button', { type: 'button', className: 'sk-btn', onClick: onCancel }, t('lib.cancel')),
          h('button', { type: 'submit', className: 'sk-btn sk-primary', disabled: !ready }, t('lib.createAction'))))
    }

    /** The name a selected import item gets, and whether it is imported as a new skill (and so must not clash). */
    function importName(item, choice) {
      if (item.status === 'updated') return { name: item.as, fresh: false }
      if (item.status === 'exists' && choice.replace) return { name: item.name, fresh: false }
      if (item.status === 'exists' || item.status === 'rename') return { name: choice.name.trim(), fresh: true }
      return { name: item.name, fresh: true }
    }

    /** The import list: skills in the Codex and Claude Code folders, or in one folder, to copy in. */
    function ImportSkillsPanel({ ui, data, busy, onClose, onImport }) {
      const { t } = ui
      const [from, setFrom] = React.useState('agents')
      const [folder, setFolder] = React.useState('')
      const [sources, setSources] = React.useState(null)
      const [loading, setLoading] = React.useState(false)
      const [error, setError] = React.useState(null)
      const [choices, setChoices] = React.useState(() => new Map())
      const [target, setTarget] = React.useState('dsh')
      const [openGroups, setOpenGroups] = React.useState(() => new Set())
      const [report, setReport] = React.useState([])
      const [upload, setUpload] = React.useState(null)
      const [over, setOver] = React.useState(false)
      const [address, setAddress] = React.useState('')
      const [storeQuery, setStoreQuery] = React.useState('')
      const [storeResults, setStoreResults] = React.useState(null)
      const [storeRepos, setStoreRepos] = React.useState(null)
      const [storeLoading, setStoreLoading] = React.useState(false)
      const [storeError, setStoreError] = React.useState(null)
      const staged = from === 'upload' || from === 'github'
      const choicesFor = groups => new Map(groups.flatMap(group => group.items.map((item) => {
        const prefix = group.source === 'folder' || group.source === 'upload' || group.source === 'github' ? '' : `${group.source.split(/[-:]/)[0]}-`
        return [item.path, {
          on: (item.status === 'new' || item.status === 'rename') && group.source !== 'codex-system' && group.source !== 'github',
          name: item.status === 'rename' ? item.suggested : item.status === 'exists' ? `${prefix}${item.name}${prefix === '' ? '-2' : ''}` : item.name ?? '',
          replace: false,
        }]
      })))
      const load = (path) => {
        setLoading(true)
        setError(null)
        return ui.lib('skillSources', path === undefined ? {} : { folder: path }).then(async (value) => {
          // dsh-modes reads Codex and Claude Code only; the other tools' folders come from this plugin.
          if (path === undefined && ui.manager === 'dsh-modes') {
            const extra = await post(ROUTE, 'agentSources', {}).catch(() => ({ groups: [] }))
            value = { ...value, groups: [...value.groups, ...extra.groups] }
          }
          setSources(value)
          setChoices(choicesFor(value.groups))
        }, (failure) => {
          setSources(null)
          setError(ui.describe(failure))
        }).finally(() => setLoading(false))
      }
      React.useEffect(() => { if (from === 'agents') void load() }, [from])
      const items = sources === null ? [] : sources.groups.flatMap(group => group.items)
      const selectable = item => ['new', 'rename', 'exists', 'updated'].includes(item.status)
      const selected = items.filter(item => selectable(item) && choices.get(item.path)?.on)
      const taken = new Set(data.skills.map(skill => skill.name))
      const names = selected.map(item => importName(item, choices.get(item.path)))
      const errorOf = (item) => {
        if (!choices.get(item.path)?.on) return undefined
        const { name, fresh } = importName(item, choices.get(item.path))
        if (!fresh) return undefined
        if (!SKILL_NAME.test(name)) return t('lib.newNameInvalid')
        if (taken.has(name)) return t('lib.newNameTaken')
        if (names.filter(entry => entry.name === name).length > 1) return t('lib.nameDuplicate')
        return undefined
      }
      const ready = selected.length > 0 && selected.every(item => errorOf(item) === undefined) && !busy && !loading
      const choose = (path, fields) => setChoices(previous => new Map(previous).set(path, { ...previous.get(path), ...fields }))
      const selectAll = on => setChoices((previous) => {
        const next = new Map(previous)
        for (const group of sources?.groups ?? []) {
          for (const item of group.items) {
            if (on && (item.status === 'new' || item.status === 'rename') && group.source !== 'codex-system') next.set(item.path, { ...next.get(item.path), on: true })
            if (!on) next.set(item.path, { ...next.get(item.path), on: false })
          }
        }
        return next
      })
      /** Keep what was dropped or picked on the Host and list the skills in it. */
      const stage = (picked) => {
        setLoading(true)
        setError(null)
        setSources(null)
        uploadBody(picked).then((body) => {
          if (body === undefined) throw new Error(t('upload.tooLarge', { megabytes: UPLOAD_MAX_BYTES / 1024 / 1024, files: UPLOAD_MAX_FILES }))
          return post(ROUTE, 'stageUpload', body)
        }).then((value) => {
          const group = { source: 'upload', label: t('lib.group.upload', { name: value.label }), dir: value.label, exists: true, items: value.items }
          setUpload(value.upload)
          setSources({ roots: data.roots, groups: [group] })
          setChoices(choicesFor([group]))
          if (value.items.length === 0) setError(t('upload.noSkill'))
        }, failure => setError(ui.describe(failure))).finally(() => setLoading(false))
      }
      /** Download a GitHub repository to the Host and list the skills in it. */
      const stageGithub = (url, pick) => {
        setLoading(true)
        setError(null)
        setSources(null)
        setReport([])
        post(ROUTE, 'githubSources', { url }).then((value) => {
          const where = value.github.commit === undefined ? value.github.ref : `${value.github.ref} @ ${value.github.commit.slice(0, 7)}`
          const group = { source: 'github', label: t('lib.group.github', { name: value.label }), dir: where, exists: true, items: value.items }
          setUpload(value.upload)
          setSources({ roots: data.roots, groups: [group] })
          const initial = choicesFor([group])
          // Coming from the store, only the skill that was asked for starts selected.
          if (pick !== undefined) {
            for (const item of value.items) {
              const wanted = item.name === pick || item.path.split(/[\\/]/).pop() === pick
              if (wanted && (item.status === 'new' || item.status === 'rename')) initial.set(item.path, { ...initial.get(item.path), on: true })
            }
          }
          setChoices(initial)
          if (value.items.length === 0) setError(t('github.noSkill'))
          else if (value.truncated) setReport([{ key: 'truncated', text: t('github.truncated') }])
        }, failure => setError(ui.describe(failure))).finally(() => setLoading(false))
      }
      /** Search the store; an empty store answer is not an error. */
      const searchStore = () => {
        setStoreLoading(true)
        setStoreError(null)
        post(ROUTE, 'storeSearch', { query: storeQuery }).then(value => setStoreResults(value.results), failure => setStoreError(ui.describe(failure))).finally(() => setStoreLoading(false))
      }
      React.useEffect(() => {
        if (from !== 'store' || storeRepos !== null) return
        post(ROUTE, 'storeIndex', {}).then(value => setStoreRepos(value.repos), () => setStoreRepos([]))
      }, [from])
      /** Read a store entry's repository through the GitHub flow, with its skill selected. */
      const openRepo = (repo, pick) => {
        setFrom('github')
        setAddress(repo)
        setUpload(null)
        setReport([])
        stageGithub(repo, pick)
      }
      const onDrop = (event) => {
        event.preventDefault()
        setOver(false)
        const entries = [...event.dataTransfer.items].map(item => item.webkitGetAsEntry?.()).filter(Boolean)
        const picked = []
        Promise.all(entries.map(entry => filesOfEntry(entry, picked))).then(() => { if (picked.length > 0) stage(picked) }, failure => setError(failure.message))
      }
      const onPick = (event) => {
        const picked = [...event.target.files].map(file => ({ path: file.webkitRelativePath || file.name, file }))
        event.target.value = ''
        if (picked.length > 0) stage(picked)
      }
      const submit = () => {
        const payload = selected.map((item) => {
          const choice = choices.get(item.path)
          const { name, fresh } = importName(item, choice)
          return { path: item.path, source: item.source, ...fresh && name !== item.name ? { name } : {}, ...item.status === 'exists' && choice.replace ? { replace: true } : {} }
        })
        const run = staged ? ui.importUpload(upload, payload, target) : onImport(payload, target)
        run.then((results) => {
          if (results === null) return
          setReport(results.flatMap((result) => {
            const label = result.name ?? result.path
            if (result.status === 'error') return [{ key: result.path, error: true, text: t('lib.importFailure', { name: label, reason: ui.describeCode(result.code, result.details, result.error) }) }]
            return result.skipped?.length > 0 ? [{ key: result.path, text: t('lib.importSkipped', { name: label, n: result.skipped.length }) }] : []
          }))
          if (staged) {
            setSources(null)
            setUpload(null)
          } else {
            void load(from === 'folder' ? folder : undefined)
          }
        })
      }
      const badge = (item) => {
        const tone = { new: ' is-accent', updated: ' is-accent', exists: ' is-warn', rename: ' is-warn', invalid: ' is-error' }[item.status] ?? ''
        return h('span', { className: `sk-badge${tone}` }, t(`lib.st.${item.status}`, { name: item.as ?? '' }))
      }
      const row = (item) => {
        const choice = choices.get(item.path) ?? { on: false, name: '', replace: false }
        const problem = errorOf(item)
        const id = `sk-import-${item.path}`
        return h('div', { key: item.path, className: 'sk-importrow' },
          h('input', { id, type: 'checkbox', checked: selectable(item) && choice.on, disabled: !selectable(item) || busy, onChange: event => choose(item.path, { on: event.target.checked }) }),
          h('div', { className: 'sk-rowmain' },
            h('label', { className: 'sk-bar', htmlFor: id },
              h('span', { className: 'sk-name' }, item.name ?? item.folder),
              badge(item)),
            item.description ? h('div', { className: 'sk-hint' }, item.description) : null,
            item.scripts?.length > 0 ? h('div', { className: 'sk-hint is-warn' }, t(from === 'github' ? 'github.scripts' : 'upload.scripts', { n: item.scripts.length, files: `${item.scripts.slice(0, 3).join(', ')}${item.scripts.length > 3 ? '…' : ''}` })) : null,
            item.status === 'invalid' ? h('div', { className: 'sk-hint is-error' }, t(`lib.problem.${item.problem}`)) : null,
            choice.on && item.status === 'updated' ? h('div', { className: 'sk-hint' }, t('lib.updatedHint', { name: item.as })) : null,
            choice.on && item.status === 'exists' ? h('div', { className: 'sk-bar' },
              h('select', { className: 'sk-select', value: choice.replace ? 'replace' : 'rename', 'aria-label': t('lib.st.exists'), onChange: event => choose(item.path, { replace: event.target.value === 'replace' }) },
                h('option', { value: 'rename' }, t('lib.conflictRename')),
                h('option', { value: 'replace' }, t('lib.conflictReplace')))) : null,
            choice.on && (item.status === 'rename' || (item.status === 'exists' && !choice.replace)) ? h('div', { className: 'sk-bar' },
              h('span', { className: 'sk-hint' }, t('lib.importAs')),
              h('input', { className: 'sk-input', value: choice.name, spellCheck: false, 'aria-label': t('lib.importAs'), 'aria-invalid': problem !== undefined, onChange: event => choose(item.path, { name: event.target.value }) })) : null,
            problem === undefined ? null : h('div', { className: 'sk-hint is-error' }, problem),
            h('div', { className: 'sk-hint sk-path' }, item.display)))
      }
      const group = (entry) => {
        const system = entry.source === 'codex-system'
        if (system && entry.items.length === 0) return null
        const open = !system || openGroups.has(entry.source)
        const title = entry.label ?? t(`lib.group.${entry.source}`)
        return h('section', { key: entry.source, className: 'sk-group', 'aria-label': title },
          h('button', {
            type: 'button', className: 'sk-grouphead', 'aria-expanded': open,
            onClick: () => setOpenGroups((previous) => {
              const next = new Set(previous)
              if (next.has(entry.source)) next.delete(entry.source)
              else next.add(entry.source)
              return next
            }),
          },
          h('span', { className: 'sk-caret', 'aria-hidden': true, style: open ? { transform: 'rotate(90deg)' } : undefined }, '›'),
          h('strong', null, title),
          h('span', { className: 'sk-hint sk-path' }, entry.dir),
          entry.items.length > 0 ? h('span', { className: 'sk-badge' }, String(entry.items.length)) : null),
          !open ? null : h(React.Fragment, null,
            system ? h('div', { className: 'sk-hint' }, t('lib.systemHint')) : null,
            !entry.exists ? h('div', { className: 'sk-hint' }, t('lib.groupMissing'))
              : entry.items.length === 0 ? h('div', { className: 'sk-hint' }, t('lib.groupEmpty'))
                : entry.items.map(row)))
      }
      return h('div', { className: 'sk-panel', role: 'group', 'aria-label': t('lib.import'), onKeyDown: onEscape(onClose) },
        h('div', { className: 'sk-bar' },
          h('strong', { className: 'sk-grow' }, t('lib.import')),
          h('button', { type: 'button', className: 'sk-btn', onClick: onClose }, t('lib.cancel'))),
        h('div', { className: 'sk-seg', role: 'radiogroup', 'aria-label': t('lib.import') }, ['agents', 'folder', 'upload', 'github', 'store'].map(name => h('button', {
          key: name, type: 'button', role: 'radio', 'aria-checked': from === name,
          onClick: () => { setFrom(name); setSources(null); setUpload(null); setError(null); setReport([]) },
        }, t(`lib.importFrom.${name}`)))),
        from === 'upload' && sources === null ? h('div', {
          className: `sk-drop${over ? ' is-over' : ''}`,
          onDragOver: (event) => { event.preventDefault(); setOver(true) },
          onDragLeave: () => setOver(false),
          onDrop,
        },
        h('div', null, loading ? t('upload.reading') : t('upload.drop')),
        h('div', { className: 'sk-bar' },
          h('label', { className: 'sk-btn' }, t('upload.pickZip'), h('input', { type: 'file', accept: '.zip,application/zip', hidden: true, onChange: onPick })),
          h('label', { className: 'sk-btn' }, t('upload.pickFolder'), h('input', { type: 'file', webkitdirectory: '', multiple: true, hidden: true, onChange: onPick })))) : null,
        from === 'store' ? h('div', { className: 'sk-section' },
          h('form', { className: 'sk-bar', onSubmit: (event) => { event.preventDefault(); if ([...storeQuery.trim()].length >= 2) searchStore() } },
            h('input', { className: 'sk-input', value: storeQuery, spellCheck: false, placeholder: t('store.placeholder'), 'aria-label': t('lib.importFrom.store'), onChange: event => setStoreQuery(event.target.value) }),
            h('button', { type: 'submit', className: 'sk-btn', disabled: storeLoading || [...storeQuery.trim()].length < 2 }, t('store.search'))),
          h('div', { className: 'sk-hint' }, t('store.hint')),
          storeError === null ? null : h('div', { className: 'sk-note is-warn', role: 'alert' }, storeError),
          storeLoading ? h('div', { className: 'sk-hint' }, t('store.searching')) : null,
          storeResults !== null ? h(React.Fragment, null,
            h('div', { className: 'sk-bar' },
              h('strong', { className: 'sk-grow' }, t('store.results', { n: storeResults.length })),
              h('button', { type: 'button', className: 'sk-link', onClick: () => setStoreResults(null) }, t('store.recommended'))),
            storeResults.length === 0 ? h('div', { className: 'sk-hint' }, t('store.empty')) : storeResults.map(result => h('div', { key: result.id, className: 'sk-entry' },
              h('div', { className: 'sk-bar' },
                h('span', { className: 'sk-name sk-grow' }, result.skill),
                taken.has(result.skill) ? (data.skills.find(skill => skill.name === result.skill)?.imported?.github?.repo === result.repo
                  ? h('span', { className: 'sk-badge' }, t('store.installed'))
                  : h('span', { className: 'sk-badge is-warn', title: t('store.sameNameHint') }, t('store.sameName'))) : null,
                h('span', { className: 'sk-hint' }, t('store.installs', { n: result.installs.toLocaleString(ui.lang === 'zh' ? 'zh-CN' : 'en-US') })),
                h('button', { type: 'button', className: 'sk-btn', disabled: loading, onClick: () => openRepo(result.repo, result.skill) }, t('store.view'))),
              h('div', { className: 'sk-hint sk-path' }, result.repo)))) : h(React.Fragment, null,
            h('strong', null, t('store.recommended')),
            (storeRepos ?? []).map(entry => h('div', { key: entry.repo, className: 'sk-entry' },
              h('div', { className: 'sk-bar' },
                h('span', { className: 'sk-name sk-grow' }, entry.repo),
                h('button', { type: 'button', className: 'sk-btn', disabled: loading, onClick: () => openRepo(entry.repo) }, t('store.viewRepo'))),
              h('div', { className: 'sk-hint' }, ui.lang === 'zh' ? entry.zh : entry.en),
              entry.note === undefined ? null : h('div', { className: 'sk-hint is-warn' }, ui.lang === 'zh' ? entry.note.zh : entry.note.en))))) : null,
        from === 'github' ? h('form', { className: 'sk-bar', onSubmit: (event) => { event.preventDefault(); if (address.trim() !== '') stageGithub(address.trim()) } },
          h('input', { className: 'sk-input', value: address, spellCheck: false, placeholder: t('github.placeholder'), 'aria-label': t('lib.importFrom.github'), onChange: event => setAddress(event.target.value) }),
          h('button', { type: 'submit', className: 'sk-btn', disabled: loading || address.trim() === '' }, t('github.read'))) : null,
        from === 'folder' ? h('form', { className: 'sk-bar', onSubmit: (event) => { event.preventDefault(); if (folder.trim() !== '') void load(folder.trim()) } },
          h('input', { className: 'sk-input', value: folder, spellCheck: false, placeholder: t('lib.folderPlaceholder'), 'aria-label': t('lib.importFrom.folder'), onChange: event => setFolder(event.target.value) }),
          h('button', { type: 'submit', className: 'sk-btn', disabled: loading || folder.trim() === '' }, t('lib.read'))) : null,
        error === null ? null : h('div', { className: 'sk-note is-warn', role: 'alert' }, error),
        loading && sources === null && from !== 'upload' ? h('div', { className: 'sk-skeleton', 'aria-busy': true }, from === 'github' ? h('div', { className: 'sk-hint' }, t('github.reading')) : null, h('span'), h('span')) : null,
        sources === null ? null : h(React.Fragment, null,
          items.some(selectable) ? h('div', { className: 'sk-bar' },
            h('button', { type: 'button', className: 'sk-link', onClick: () => selectAll(true) }, t('lib.selectReady')),
            h('button', { type: 'button', className: 'sk-link', onClick: () => selectAll(false) }, t('lib.selectNone'))) : null,
          sources.groups.map(group),
          report.length === 0 ? null : h('ul', { className: 'sk-hint', style: { margin: 0, paddingLeft: 18 } }, report.map(line => h('li', { key: line.key, className: line.error ? 'is-error' : undefined }, line.text))),
          h('div', { className: 'sk-hint' }, t(from === 'upload' ? 'upload.note' : from === 'github' ? 'github.note' : 'lib.copyNote')),
          h('div', { className: 'sk-bar' },
            h('label', { className: 'sk-hint', htmlFor: 'sk-import-where' }, t('lib.where')),
            h(WhereSelect, { ui, roots: sources.roots, value: target, onChange: setTarget, id: 'sk-import-where' }),
            h('span', { className: 'sk-grow' }),
            h('button', { type: 'button', className: 'sk-btn sk-primary', disabled: !ready, onClick: submit }, t('lib.importSelected', { n: selected.length })))))
    }

    /** A byte count for a file list. */
    function sizeLabel(bytes) {
      return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
    }

    /** The other files of a skill folder: open and edit text files, add or delete one, export a zip, move the folder. */
    function SkillFiles({ ui, skill }) {
      const { t } = ui
      const busy = ui.libBusy
      const [open, setOpen] = React.useState(false)
      const [listing, setListing] = React.useState(null)
      const [editor, setEditor] = React.useState(null)
      const [confirm, setConfirm] = React.useState(null)
      const [newPath, setNewPath] = React.useState('')
      const refresh = () => post(ROUTE, 'listSkillFiles', { skill: skill.name }).then(setListing, error => ui.fail(error))
      React.useEffect(() => { if (open) void refresh() }, [open, skill.path])
      const edit = rel => post(ROUTE, 'readSkillAsset', { skill: skill.name, rel }).then((value) => {
        const text = value.text.replace(/\r\n?/g, '\n')
        setEditor({ rel, text, base: text, editable: value.editable })
      }, error => ui.fail(error))
      const save = overwrite => post(ROUTE, 'writeSkillAsset', { skill: skill.name, rel: editor.rel, text: editor.text, ...overwrite || editor.create ? {} : { base: editor.base }, ...editor.create ? { create: true } : {} }).then(() => {
        ui.notify('done', t(editor.create ? 'files.created' : 'files.saved'))
        setEditor(null)
        return refresh()
      }, (failure) => {
        if (failure?.code === 'skill-conflict') setEditor(previous => ({ ...previous, conflict: failure.details?.current ?? '' }))
        else ui.fail(failure)
      })
      const remove = () => post(ROUTE, 'deleteSkillAsset', { skill: skill.name, rel: editor.rel }).then(() => {
        ui.notify('done', t('files.deleted'))
        setEditor(null)
        setConfirm(null)
        return refresh()
      }, error => ui.fail(error))
      const exportZip = () => post(ROUTE, 'exportSkill', { skill: skill.name }).then((value) => {
        const url = URL.createObjectURL(new Blob([Uint8Array.from(atob(value.zip), char => char.charCodeAt(0))], { type: 'application/zip' }))
        const link = document.createElement('a')
        link.href = url
        link.download = value.name
        document.body.append(link)
        link.click()
        link.remove()
        setTimeout(() => URL.revokeObjectURL(url), 10000)
        ui.notify('done', t('files.exported', { name: value.name }))
      }, error => ui.fail(error))
      const moveTarget = skill.source === 'user-dsh' ? 'agents' : skill.source === 'user-agents' ? 'dsh' : undefined
      const movable = skill.editable && moveTarget !== undefined && listing !== null && listing.single !== true
      const others = listing === null ? [] : listing.files.filter(file => file.rel !== 'SKILL.md')
      return h('div', { className: 'sk-section' },
        h('div', { className: 'sk-bar' },
          h('button', { type: 'button', className: 'sk-btn', 'aria-expanded': open, onClick: () => setOpen(!open) }, t(open ? 'files.hide' : 'files.show')),
          open ? h('button', { type: 'button', className: 'sk-btn', disabled: busy, onClick: exportZip }, t('files.export')) : null,
          open && movable ? h('button', { type: 'button', className: 'sk-btn', disabled: busy, onClick: () => setConfirm({ kind: 'move' }) }, t(moveTarget === 'agents' ? 'files.moveAgents' : 'files.moveDsh')) : null),
        !open ? null : h(React.Fragment, null,
          confirm?.kind === 'move' ? h(ConfirmBox, {
            ui, text: t(moveTarget === 'agents' ? 'files.confirmMoveAgents' : 'files.confirmMoveDsh', { name: skill.name }), action: t(moveTarget === 'agents' ? 'files.moveAgents' : 'files.moveDsh'), busy,
            onCancel: () => setConfirm(null), onConfirm: () => ui.own('moveSkill', { skill: skill.name, target: moveTarget }, value => t('files.moved', { path: value.display })).then(() => setConfirm(null)),
          }) : null,
          listing === null ? h('div', { className: 'sk-hint' }, t('files.reading')) : listing.single ? h('div', { className: 'sk-hint' }, t('files.single')) : h(React.Fragment, null,
            others.map(file => h('div', { key: file.rel, className: 'sk-bar' },
              h('span', { className: 'sk-path sk-grow' }, file.rel),
              h('span', { className: 'sk-hint' }, sizeLabel(file.size)),
              h('button', { type: 'button', className: 'sk-btn', disabled: busy || editor?.rel === file.rel, onClick: () => edit(file.rel) }, t(listing.editable ? 'files.edit' : 'files.view')))),
            listing.skipped.length > 0 ? h('div', { className: 'sk-hint' }, t('files.skippedLinks', { n: listing.skipped.length })) : null,
            listing.editable ? h('form', {
              className: 'sk-bar',
              onSubmit: (event) => { event.preventDefault(); if (newPath.trim() !== '') { setEditor({ rel: newPath.trim(), text: '', base: '', create: true, editable: true }); setNewPath('') } },
            },
            h('input', { className: 'sk-input', value: newPath, spellCheck: false, placeholder: t('files.newPlaceholder'), 'aria-label': t('files.new'), onChange: event => setNewPath(event.target.value) }),
            h('button', { type: 'submit', className: 'sk-btn', disabled: newPath.trim() === '' }, t('files.new'))) : null),
          editor === null ? null : h('div', { className: 'sk-section', role: 'group', 'aria-label': editor.rel, onKeyDown: onEscape(() => setEditor(null)) },
            h('span', { className: 'sk-label sk-path' }, editor.rel),
            h('textarea', { className: 'sk-input sk-textarea', rows: 12, value: editor.text, spellCheck: false, readOnly: !editor.editable, autoFocus: editor.create === true, 'aria-label': editor.rel, onChange: event => setEditor(previous => ({ ...previous, text: event.target.value })) }),
            editor.conflict === undefined ? null : h('div', { className: 'sk-confirm', role: 'alert' },
              h('div', null, t('lib.conflict')),
              h('pre', { className: 'sk-pre' }, editor.conflict),
              h('div', { className: 'sk-bar' },
                h('button', { type: 'button', className: 'sk-btn', onClick: () => setEditor(previous => ({ rel: previous.rel, editable: previous.editable, text: previous.conflict, base: previous.conflict })) }, t('lib.loadLatest')),
                h('button', { type: 'button', className: 'sk-btn sk-danger', disabled: busy, onClick: () => save(true) }, t('lib.overwrite')))),
            confirm?.kind === 'delete' ? h(ConfirmBox, {
              ui, text: t('files.confirmDelete', { rel: editor.rel }), action: t('files.delete'), danger: true, busy,
              onCancel: () => setConfirm(null), onConfirm: remove,
            }) : null,
            h('div', { className: 'sk-bar sk-end' },
              editor.editable && editor.create !== true ? h('button', { type: 'button', className: 'sk-btn sk-danger', disabled: busy, onClick: () => setConfirm({ kind: 'delete' }) }, t('files.delete')) : null,
              h('button', { type: 'button', className: 'sk-btn', onClick: () => setEditor(null) }, t('files.close')),
              editor.editable ? h('button', { type: 'button', className: 'sk-btn sk-primary', disabled: busy || (editor.create !== true && editor.text === editor.base), onClick: () => save(false) }, t('lib.save')) : null))))
    }

    /** A skill's display name and tags, kept in the settings file apart from the skill. */
    function MetaEditor({ ui, skill }) {
      const { t } = ui
      const saved = { alias: skill.alias ?? '', tags: (skill.tags ?? []).join(', ') }
      const [alias, setAlias] = React.useState(saved.alias)
      const [tags, setTags] = React.useState(saved.tags)
      const changed = alias.trim() !== saved.alias || tags.trim() !== saved.tags
      const submit = (event) => {
        event.preventDefault()
        void ui.own('setMeta', { skill: skill.name, alias, tags: tags.split(/[,，、]/).map(tag => tag.trim()).filter(Boolean) }, 'meta.saved', false)
      }
      return h('form', { className: 'sk-section', onSubmit: submit },
        h('div', { className: 'sk-form' },
          h('label', { className: 'sk-field' }, t('meta.alias'),
            h('input', { className: 'sk-input', value: alias, maxLength: 40, placeholder: t('meta.aliasPlaceholder'), onChange: event => setAlias(event.target.value) })),
          h('label', { className: 'sk-field' }, t('meta.tags'),
            h('input', { className: 'sk-input', value: tags, placeholder: t('meta.tagsPlaceholder'), onChange: event => setTags(event.target.value) }))),
        h('div', { className: 'sk-bar' },
          h('span', { className: 'sk-hint sk-grow' }, t('meta.hint')),
          h('button', { type: 'submit', className: 'sk-btn', disabled: !changed || ui.libBusy }, t('lib.save'))))
    }

    /** A skill's file, where it was imported from, its editor, and its saved versions. */
    function SkillLibrary({ ui, skill, autoEdit, onAutoEdited }) {
      const { t } = ui
      const busy = ui.libBusy
      const [reimport, setReimport] = React.useState(false)
      const [note, setNote] = React.useState('')
      const [confirm, setConfirm] = React.useState(null)
      const [preview, setPreview] = React.useState(null)
      const [editor, setEditor] = React.useState(null)
      const [trashing, setTrashing] = React.useState(false)
      const versions = skill.versions ?? []
      const origin = skill.imported
      const showVersion = (version) => {
        if (preview?.id === version.id) {
          setPreview(null)
          return
        }
        ui.lib('readSkillVersion', { skill: skill.name, version: version.id }).then(value => setPreview({ id: version.id, text: value.text }), error => ui.fail(error))
      }
      // A text area reports LF line endings; the Host keeps the file's own endings when it writes.
      const openEditor = () => ui.lib('readSkillFile', { skill: skill.name }).then((value) => {
        const text = value.text.replace(/\r\n?/g, '\n')
        setEditor({ text, base: text })
      }, error => ui.fail(error))
      // A skill created in the page opens with its file in the editor.
      React.useEffect(() => {
        if (!autoEdit) return
        onAutoEdited()
        void openEditor()
      }, [autoEdit])
      const saveEditor = overwrite => ui.run('writeSkillFile', { skill: skill.name, text: editor.text, ...overwrite ? {} : { base: editor.base } }, 'lib.saved')
        .then((ok) => { if (ok) setEditor(null) }, (failure) => {
          if (failure?.code === 'skill-conflict') setEditor(previous => ({ ...previous, conflict: failure.details?.current ?? '' }))
        })
      return h(React.Fragment, null,
        origin === undefined ? null : h('div', { className: 'sk-bar' },
          h('span', { className: 'sk-hint sk-grow' }, t('lib.origin', { source: originLabel(t, origin.source), path: origin.display }), origin.github?.commit === undefined ? '' : ` · ${t('github.commit', { commit: origin.github.commit.slice(0, 7) })}`),
          origin.state === 'missing' ? h('span', { className: 'sk-badge' }, t('lib.sourceMissing')) : null,
          origin.github?.gone ? h('span', { className: 'sk-badge' }, t('github.gone')) : null,
          origin.state === 'changed' && !reimport ? h('button', { type: 'button', className: 'sk-btn', disabled: busy, onClick: () => setReimport(true) }, t(origin.source === 'github' ? 'github.update' : 'lib.reimport')) : null),
        reimport ? h('div', { className: 'sk-confirm', role: 'alertdialog', 'aria-label': t('lib.reimport'), onKeyDown: onEscape(() => setReimport(false)) },
          h('div', null, t(origin.source === 'github' ? 'lib.confirmUpdateGithub' : 'lib.confirmReimport', { name: skill.name })),
          h('div', { className: 'sk-bar sk-end' },
            h('button', { type: 'button', className: 'sk-btn', autoFocus: true, onClick: () => setReimport(false) }, t('lib.cancel')),
            h('button', {
              type: 'button', className: 'sk-btn sk-primary', disabled: busy,
              onClick: () => (origin.source === 'github' ? ui.updateGithub([skill.name]) : ui.runImport([{ path: origin.from, source: origin.source }], 'dsh')).then(() => setReimport(false)),
            }, t(origin.source === 'github' ? 'github.update' : 'lib.reimport')))) : null,
        skill.source === 'user-agents' ? h('div', { className: 'sk-hint' }, t('lib.shared')) : null,
        !skill.editable && skill.path ? h('div', { className: 'sk-hint' }, t('lib.bundled')) : null,
        skill.editable && editor === null ? h('div', { className: 'sk-bar' },
          h('button', { type: 'button', className: 'sk-btn', disabled: busy || skill.exists === false, onClick: openEditor }, t('lib.edit')),
          h('button', { type: 'button', className: 'sk-btn sk-danger', disabled: busy || skill.exists === false || trashing, onClick: () => setTrashing(true) }, t('lib.delete'))) : null,
        trashing ? h(ConfirmBox, {
          ui, text: t('lib.confirmDeleteSkill', { name: skill.name }), action: t('lib.delete'), danger: true, busy,
          onCancel: () => setTrashing(false), onConfirm: () => ui.trashSkill(skill.name).then(() => setTrashing(false)),
        }) : null,
        skill.path === undefined || skill.exists === false || editor !== null ? null : h(SkillFiles, { ui, skill }),
        editor === null ? null : h('div', { className: 'sk-section' },
          h('textarea', { className: 'sk-input sk-textarea', rows: 14, value: editor.text, spellCheck: false, 'aria-label': t('lib.edit'), onChange: event => setEditor(previous => ({ ...previous, text: event.target.value })) }),
          editor.conflict === undefined ? null : h('div', { className: 'sk-confirm', role: 'alert' },
            h('div', null, t('lib.conflict')),
            h('pre', { className: 'sk-pre' }, editor.conflict),
            h('div', { className: 'sk-bar' },
              h('button', { type: 'button', className: 'sk-btn', onClick: () => setEditor({ text: editor.conflict, base: editor.conflict }) }, t('lib.loadLatest')),
              h('button', { type: 'button', className: 'sk-btn sk-danger', disabled: busy, onClick: () => saveEditor(true) }, t('lib.overwrite')))),
          h('div', { className: 'sk-hint' }, t('lib.editHint')),
          h('div', { className: 'sk-bar sk-end' },
            h('button', { type: 'button', className: 'sk-btn', onClick: () => setEditor(null) }, t('lib.cancel')),
            h('button', { type: 'button', className: 'sk-btn sk-primary', disabled: busy || editor.text === editor.base || editor.text.trim() === '', onClick: () => saveEditor(false) }, t('lib.save')))),
        h('div', { className: 'sk-section' },
          h('span', { className: 'sk-label' }, t('lib.versions')),
          h('div', { className: 'sk-bar' },
            h('input', { className: 'sk-input', value: note, maxLength: 200, placeholder: t('lib.notePlaceholder'), 'aria-label': t('lib.notePlaceholder'), onChange: event => setNote(event.target.value) }),
            h('button', {
              type: 'button', className: 'sk-btn', disabled: busy || skill.exists === false || skill.path === undefined,
              onClick: () => ui.quiet('saveSkillVersion', { skill: skill.name, note }, 'lib.versionSaved').then((ok) => { if (ok) setNote('') }),
            }, t('lib.saveVersion'))),
          versions.length === 0 ? h('div', { className: 'sk-hint' }, t('lib.noVersions')) : versions.map(version => h('div', { key: version.id, className: 'sk-version' },
            h('div', { className: 'sk-bar' },
              h('strong', { className: 'sk-grow' }, versionLabel(ui.lang, version)),
              h('span', { className: 'sk-hint' }, t(`lib.source.${version.source}`))),
            version.description ? h('div', { className: 'sk-hint' }, version.description) : null,
            preview?.id === version.id ? h('pre', { className: 'sk-pre' }, preview.text) : null,
            confirm?.id === version.id ? h('div', { className: 'sk-confirm', role: 'alertdialog', 'aria-label': version.id, onKeyDown: onEscape(() => setConfirm(null)) },
              h('div', null, t(confirm.kind === 'restore' ? 'lib.confirmRestore' : 'lib.confirmDelete', { version: version.id, name: skill.name })),
              h('div', { className: 'sk-bar sk-end' },
                h('button', { type: 'button', className: 'sk-btn', autoFocus: true, onClick: () => setConfirm(null) }, t('lib.cancel')),
                h('button', {
                  type: 'button', className: `sk-btn ${confirm.kind === 'restore' ? 'sk-primary' : 'sk-danger'}`, disabled: busy,
                  onClick: () => ui.quiet(confirm.kind === 'restore' ? 'restoreSkillVersion' : 'deleteSkillVersion', { skill: skill.name, version: version.id }, confirm.kind === 'restore' ? 'lib.restored' : 'lib.deleted').then(() => setConfirm(null)),
                }, t(confirm.kind === 'restore' ? 'lib.restore' : 'lib.remove')))) : null,
            h('div', { className: 'sk-bar' },
              h('button', { type: 'button', className: 'sk-btn', onClick: () => showVersion(version) }, t(preview?.id === version.id ? 'lib.hide' : 'lib.view')),
              skill.editable ? h('button', { type: 'button', className: 'sk-btn', disabled: busy, onClick: () => setConfirm({ kind: 'restore', id: version.id }) }, t('lib.restore')) : null,
              h('button', { type: 'button', className: 'sk-btn sk-danger', disabled: busy, onClick: () => setConfirm({ kind: 'delete', id: version.id }) }, t('lib.remove')))))))
    }

    /** The settings a skill can have in a mode, in the order the control shows them. */
    const MODE_CHOICES = ['on', 'manual', 'model', 'off']

    /** Each mode's setting for a skill (on, manual only, model only, off) beside how the mode treats it now. */
    function ModeControls({ ui, data, skill }) {
      const { t } = ui
      const settable = data.modes.filter(mode => cell(ui, data, skill, mode).reason === undefined)
      const rows = data.modes.map((mode) => {
        const current = cell(ui, data, skill, mode)
        const key = `${mode.id}\0${skill.name}`
        const state = h('span', { className: `sk-chip${current.on ? '' : ' is-off'}${current.state === 'pinned' ? ' is-pinned' : ''}`, title: current.state === 'pinned' ? t('reason.pinnedBy') : undefined }, t(`state.${current.state}`))
        const name = h('span', { className: 'sk-modename' }, ui.modeName(mode))
        if (current.reason !== undefined) return h('div', { key: mode.id, className: 'sk-moderow' }, name, state, h('span', { className: 'sk-hint' }, current.reason))
        const choice = ui.choiceOf(mode, skill)
        return h('div', { key: mode.id, className: 'sk-moderow' }, name,
          h('div', { className: 'sk-seg is-small', role: 'radiogroup', 'aria-label': ui.modeName(mode) }, MODE_CHOICES.map((target) => {
            const blocked = (target === 'manual' || target === 'model') && data.manager === 'dsh-modes'
            return h('button', {
              key: target, type: 'button', role: 'radio', 'aria-checked': choice === target, disabled: blocked || ui.busy.has(key),
              title: blocked ? t(`reason.${target}ByModes`) : target === 'manual' || target === 'model' ? t(`mode.${target}Hint`, { name: skill.name }) : undefined,
              onClick: () => { if (choice !== target) ui.setState(mode, skill.name, target) },
            }, t(`mode.${target}`))
          })),
          state)
      })
      return h('div', { className: 'sk-moderows' }, rows,
        settable.length < 2 ? null : h('div', { className: 'sk-bar' },
          ['on', 'off'].map(target => h('button', {
            key: target, type: 'button', className: 'sk-btn', disabled: ui.busy.has('bulk'),
            onClick: () => ui.setMany(settable.map(mode => ({ mode, skill, target }))),
          }, t(target === 'on' ? 'bulk.skillOn' : 'bulk.skillOff')))))
    }

    function SkillRow({ skill, data, filter, open, onToggle, ui, autoEdit, onAutoEdited, bodyOnly }) {
      const { t } = ui
      const modes = data.modes
      const on = modes.filter(mode => cell(ui, data, skill, mode).on)
      const chosen = filter === '' ? undefined : modes.find(mode => mode.id === filter)
      const key = mode => `${mode.id}\0${skill.name}`
      const flip = (mode, current) => ui.setState(mode, skill.name, current.on ? 'off' : 'on')
      let side = null
      if (chosen !== undefined) {
        const current = cell(ui, data, skill, chosen)
        side = h('button', {
          type: 'button', className: 'sk-switch', role: 'switch', 'aria-checked': current.on,
          'aria-label': t(current.on ? 'toggle.on' : 'toggle.off', { mode: ui.modeName(chosen) }),
          title: current.reason, disabled: current.reason !== undefined || ui.busy.has(key(chosen)),
          onClick: () => flip(chosen, current),
        })
      }
      const summary = chosen === undefined
        ? t('available', { n: on.length, total: modes.length })
        : t(`state.${cell(ui, data, skill, chosen).state}`)
      return h('div', { className: `sk-row${open ? ' is-open' : ''}` },
        h('div', { className: 'sk-top' },
          h('button', { type: 'button', className: 'sk-head', 'aria-expanded': open, onClick: onToggle },
            h('span', { className: 'sk-caret', 'aria-hidden': true }, '›'),
            skill.alias === undefined ? h('span', { className: 'sk-name' }, skill.name) : h(React.Fragment, null, h('span', { className: 'sk-alias' }, skill.alias), h('span', { className: 'sk-name is-dim' }, skill.name)),
            skill.source === undefined ? null : h('span', { className: 'sk-chip' }, ui.sourceName(skill)),
            (skill.tags ?? []).map(tag => h('span', { key: `tag:${tag}`, className: 'sk-chip is-tag' }, tag)),
            bodyOnly ? h('span', { className: 'sk-badge' }, t('search.body')) : null,
            skill.exists === false ? h('span', { className: 'sk-badge is-error' }, t('lib.missing')) : null,
            skill.imported?.state === 'changed' ? h('span', { className: 'sk-badge is-accent' }, t('lib.sourceChanged')) : null,
            skill.imported?.github?.gone ? h('span', { className: 'sk-badge' }, t('github.gone')) : null,
            h('span', { className: 'sk-desc' }, skill.description ?? ''),
            skill.tokens === undefined ? null : h('span', { className: 'sk-meta', title: t('tok.hint') }, t('tok.skill', { n: skill.tokens })),
            usageOf(ui.usage, skill.name) === undefined ? null : h('span', { className: 'sk-meta' }, times(t, usageOf(ui.usage, skill.name).model + usageOf(ui.usage, skill.name).user)),
            h('span', { className: 'sk-meta' }, summary)),
          side),
        open ? h('div', { className: 'sk-body' },
          skill.description === undefined ? null : h('p', { className: 'sk-full' }, skill.description),
          h('dl', { className: 'sk-details' },
            skill.display === undefined ? null : [h('dt', { key: 'p:t' }, t('detail.path')), h('dd', { key: 'p:d', className: 'sk-path' }, skill.display)],
            skill.source === undefined ? null : [h('dt', { key: 's:t' }, t('detail.source')), h('dd', { key: 's:d' }, ui.sourceName(skill))],
            skill.whenToUse === undefined ? null : [h('dt', { key: 'w:t' }, t('detail.whenToUse')), h('dd', { key: 'w:d' }, skill.whenToUse)],
            skill.tokens === undefined ? null : [h('dt', { key: 'k:t' }, t('detail.tokens')), h('dd', { key: 'k:d', title: t('tok.hint') }, t('tok.skill', { n: skill.tokens }))],
            ui.usage === null ? null : [h('dt', { key: 'u:t' }, t('detail.usage')), h('dd', { key: 'u:d' }, usageOf(ui.usage, skill.name) === undefined
              ? t('detail.usageNone')
              : t('detail.usageLine', { times: times(t, usageOf(ui.usage, skill.name).model + usageOf(ui.usage, skill.name).user), model: usageOf(ui.usage, skill.name).model, user: usageOf(ui.usage, skill.name).user, when: ago(ui.lang, usageOf(ui.usage, skill.name).lastAt) }))],
            h('dt', { key: 'm:t' }, t('detail.modes')),
            h('dd', { key: 'm:d' }, h(ModeControls, { ui, data, skill }))),
          h(MetaEditor, { key: `${skill.name}\0${skill.alias ?? ''}\0${(skill.tags ?? []).join()}`, ui, skill }),
          h(SkillLibrary, { ui, skill, autoEdit, onAutoEdited })) : null)
    }

    /** A moment as "3 days ago" or "in 2 hours", in the page's language. */
    function ago(lang, at) {
      const rtf = new Intl.RelativeTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', { numeric: 'auto' })
      const minutes = Math.round((at - Date.now()) / 60000)
      if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute')
      const hours = Math.round(minutes / 60)
      return Math.abs(hours) < 24 ? rtf.format(hours, 'hour') : rtf.format(Math.round(hours / 24), 'day')
    }

    /** "1 time" or "3 times". */
    function times(t, n) {
      return n === 1 ? t('usage.once') : t('usage.calls', { n })
    }

    /** The usage figures of one skill, or undefined when it was not loaded in the window. */
    function usageOf(usage, name) {
      return usage !== null && Object.hasOwn(usage.skills, name) ? usage.skills[name] : undefined
    }

    /** How often each skill was loaded, in which mode, and the skills nobody loaded, with a way to turn those off. */
    function UsagePanel({ ui, data, usage, loading, error, days, onDays, onRefresh, onClose }) {
      const { t } = ui
      const usable = usableModes(data)
      const [mode, setMode] = React.useState(() => usable[0]?.id ?? '')
      const [confirm, setConfirm] = React.useState(false)
      const used = usage === null ? [] : Object.entries(usage.skills).map(([name, figures]) => ({ name, ...figures })).sort((a, b) => b.model + b.user - (a.model + a.user) || b.lastAt - a.lastAt)
      const unused = usage === null ? [] : data.skills.filter(skill => !Object.hasOwn(usage.skills, skill.name))
      const chosen = data.modes.find(entry => entry.id === mode)
      const candidates = chosen === undefined ? [] : unused.filter(skill => cell(ui, data, skill, chosen).reason === undefined && ui.choiceOf(chosen, skill) !== 'off')
      const label = id => ui.modeName(data.modes.find(entry => entry.id === id) ?? { id })
      return h('div', { className: 'sk-panel', role: 'group', 'aria-label': t('usage.title'), onKeyDown: onEscape(onClose) },
        h('div', { className: 'sk-bar' },
          h('strong', { className: 'sk-grow' }, t('usage.title')),
          h('select', { className: 'sk-select', value: days, 'aria-label': t('usage.days', { n: days }), onChange: event => onDays(Number(event.target.value)) },
            [7, 30, 90, 365].map(n => h('option', { key: n, value: n }, t('usage.days', { n })))),
          h('button', { type: 'button', className: 'sk-btn', disabled: loading, onClick: onRefresh }, t(loading ? 'usage.loading' : 'usage.refresh')),
          h('button', { type: 'button', className: 'sk-btn', onClick: onClose }, t('lib.cancel'))),
        h('div', { className: 'sk-hint' }, t('usage.intro')),
        error === null ? null : h('div', { className: 'sk-note is-warn', role: 'alert' }, error),
        usage === null ? (loading ? h('div', { className: 'sk-skeleton', 'aria-busy': true }, h('span')) : null) : h(React.Fragment, null,
          h('div', { className: 'sk-hint' },
            [t('usage.summary', { scanned: usage.scanned, total: usage.total }),
              usage.truncated ? t('usage.truncated', { n: usage.scanned + usage.failed }) : undefined,
              usage.complete ? undefined : t('usage.incomplete'),
              usage.failed > 0 ? t('usage.failed', { n: usage.failed }) : undefined].filter(Boolean).join(' · ')),
          used.length === 0 ? h('div', { className: 'sk-hint' }, t('usage.none')) : used.map(entry => h('div', { key: entry.name, className: 'sk-entry' },
            h('div', { className: 'sk-bar' },
              h('span', { className: 'sk-name sk-grow' }, entry.name),
              h('strong', null, times(t, entry.model + entry.user)),
              h('span', { className: 'sk-hint' }, t('usage.split', { model: entry.model, user: entry.user })),
              h('span', { className: 'sk-hint' }, t('usage.last', { when: ago(ui.lang, entry.lastAt) }))),
            h('div', { className: 'sk-modes' }, Object.entries(entry.modes).sort(([, a], [, b]) => b.model + b.user - (a.model + a.user)).map(([id, figures]) => h('span', { key: id, className: 'sk-chip' }, t('usage.inMode', { mode: label(id), n: figures.model + figures.user })))))),
          h('div', { className: 'sk-section' },
            h('strong', null, t('usage.unused', { n: unused.length })),
            unused.length === 0 ? h('div', { className: 'sk-hint' }, t('usage.noneUnused')) : h(React.Fragment, null,
              h('div', { className: 'sk-hint' }, t('usage.unusedHint')),
              h('div', { className: 'sk-modes' }, unused.map(skill => h('span', { key: skill.name, className: 'sk-chip' }, skill.name))),
              usable.length === 0 ? null : h('div', { className: 'sk-bar' },
                h('select', { className: 'sk-select', value: mode, 'aria-label': t('usage.offIn'), onChange: (event) => { setMode(event.target.value); setConfirm(false) } },
                  usable.map(entry => h('option', { key: entry.id, value: entry.id }, ui.modeName(entry)))),
                h('button', { type: 'button', className: 'sk-btn sk-danger', disabled: candidates.length === 0 || ui.busy.has('bulk'), onClick: () => setConfirm(true) }, `${t('usage.offIn')} (${candidates.length})`)),
              confirm && chosen !== undefined ? h(ConfirmBox, {
                ui, text: t('usage.confirmOff', { mode: ui.modeName(chosen), n: candidates.length }), action: t('usage.offIn'), danger: true, busy: ui.busy.has('bulk'),
                onCancel: () => setConfirm(false), onConfirm: () => { setConfirm(false); ui.setMany(candidates.map(skill => ({ mode: chosen, skill, target: 'off' }))) },
              }) : null))))
    }

    /** The project folder whose own skills the list also shows. */
    function ProjectPanel({ ui, project, onApply, onClose }) {
      const { t } = ui
      const [text, setText] = React.useState(project)
      return h('form', { className: 'sk-panel', 'aria-label': t('project.title'), onKeyDown: onEscape(onClose), onSubmit: (event) => { event.preventDefault(); onApply(text) } },
        h('div', { className: 'sk-bar' },
          h('strong', { className: 'sk-grow' }, t('project.title')),
          h('button', { type: 'button', className: 'sk-btn', onClick: onClose }, t('lib.cancel'))),
        h('div', { className: 'sk-hint' }, t('project.hint')),
        h('div', { className: 'sk-bar' },
          h('input', { className: 'sk-input', value: text, autoFocus: true, spellCheck: false, placeholder: t('project.placeholder'), 'aria-label': t('project.title'), onChange: event => setText(event.target.value) }),
          h('button', { type: 'submit', className: 'sk-btn sk-primary', disabled: text.trim() === '' }, t('project.apply')),
          project === '' ? null : h('button', { type: 'button', className: 'sk-btn', onClick: () => onApply('') }, t('project.clear'))))
    }

    /** The bin: deleted skills to restore or remove for good. */
    function TrashPanel({ ui, data, busy, onClose }) {
      const { t } = ui
      const [confirm, setConfirm] = React.useState(null)
      const when = at => new Date(at).toLocaleString(ui.lang === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })
      return h('div', { className: 'sk-panel', role: 'group', 'aria-label': t('trash.title'), onKeyDown: onEscape(onClose) },
        h('div', { className: 'sk-bar' },
          h('strong', { className: 'sk-grow' }, t('trash.title')),
          data.trash.length > 0 ? h('button', { type: 'button', className: 'sk-btn sk-danger', disabled: busy, onClick: () => setConfirm({ kind: 'empty' }) }, t('trash.emptyAll')) : null,
          h('button', { type: 'button', className: 'sk-btn', onClick: onClose }, t('lib.cancel'))),
        confirm?.kind === 'empty' ? h(ConfirmBox, {
          ui, text: t('trash.confirmEmpty', { n: data.trash.length }), action: t('trash.emptyAll'), danger: true, busy,
          onCancel: () => setConfirm(null), onConfirm: () => ui.own('emptyTrash', {}, 'trash.emptied').then(() => setConfirm(null)),
        }) : null,
        data.trash.length === 0 ? h('div', { className: 'sk-hint' }, t('trash.empty')) : data.trash.map(entry => h('div', { key: entry.id, className: 'sk-entry' },
          h('div', { className: 'sk-bar' },
            h('span', { className: 'sk-name sk-grow' }, entry.name),
            h('span', { className: 'sk-hint' }, when(entry.at))),
          entry.description ? h('div', { className: 'sk-hint' }, entry.description) : null,
          h('div', { className: 'sk-hint sk-path' }, t('trash.from', { path: entry.display })),
          confirm?.id === entry.id ? h(ConfirmBox, {
            ui, text: t('trash.confirmPurge', { name: entry.name }), action: t('trash.purge'), danger: true, busy,
            onCancel: () => setConfirm(null), onConfirm: () => ui.own('purgeTrash', { id: entry.id }, 'trash.purged').then(() => setConfirm(null)),
          }) : null,
          h('div', { className: 'sk-bar' },
            h('button', { type: 'button', className: 'sk-btn', disabled: busy, onClick: () => ui.restoreTrash(entry.id) }, t('trash.restore')),
            h('button', { type: 'button', className: 'sk-btn sk-danger', disabled: busy, onClick: () => setConfirm({ kind: 'purge', id: entry.id }) }, t('trash.purge'))))),
        h('div', { className: 'sk-hint' }, t('trash.note')))
    }

    /** Why DSH skips a file, in the page's words. */
    function skippedReason(t, problem) {
      if (problem.reason === 'yaml') return t(`skipped.reason.yaml.${problem.detail.what}`, problem.detail)
      return t(`skipped.reason.${problem.reason}`, problem.detail ?? {})
    }

    /** The skill files DSH skips, each with its reason and an editor that starts from the offered fix. */
    function SkippedPanel({ ui, data, busy, onClose }) {
      const { t } = ui
      const [editing, setEditing] = React.useState(null)
      const open = item => post(ROUTE, 'readSkipped', { path: item.path, ...ui.project === '' ? {} : { cwd: ui.project } }).then((value) => {
        setEditing({ path: item.path, text: item.fixable ? value.proposal.text : value.text, base: value.text, complete: item.fixable ? value.proposal.complete : false })
      }, error => ui.fail(error))
      return h('div', { className: 'sk-panel', role: 'group', 'aria-label': t('skipped.title'), onKeyDown: onEscape(onClose) },
        h('div', { className: 'sk-bar' },
          h('strong', { className: 'sk-grow' }, t('skipped.title')),
          h('button', { type: 'button', className: 'sk-btn', onClick: onClose }, t('lib.cancel'))),
        h('div', { className: 'sk-hint' }, t('skipped.intro')),
        data.skipped.map(item => h('div', { key: item.path, className: 'sk-entry' },
          h('div', { className: 'sk-bar' },
            h('span', { className: 'sk-name sk-grow' }, item.folder),
            item.reason === 'shadowed' || editing?.path === item.path ? null
              : h('button', { type: 'button', className: 'sk-btn', disabled: busy, onClick: () => open(item) }, t(item.fixable ? 'skipped.fix' : 'skipped.edit'))),
          h('div', { className: 'sk-hint is-error' }, skippedReason(t, item)),
          h('div', { className: 'sk-hint sk-path' }, item.display),
          editing?.path !== item.path ? null : h('div', { className: 'sk-section' },
            h('span', { className: 'sk-label' }, t('skipped.fixTitle')),
            h('textarea', { className: 'sk-input sk-textarea', rows: 12, value: editing.text, spellCheck: false, 'aria-label': t('skipped.fixTitle'), onChange: event => setEditing(previous => ({ ...previous, text: event.target.value })) }),
            editing.complete ? null : h('div', { className: 'sk-hint' }, t('skipped.fixIncomplete')),
            h('div', { className: 'sk-bar sk-end' },
              h('button', { type: 'button', className: 'sk-btn', onClick: () => setEditing(null) }, t('lib.cancel')),
              h('button', {
                type: 'button', className: 'sk-btn sk-primary', disabled: busy || editing.text.trim() === '',
                onClick: () => ui.saveSkipped(editing.path, editing.text, editing.base).then((ok) => { if (ok) setEditing(null) }),
              }, t('skipped.save')))))))
    }

    /** Where the page remembers the project folder it was last looking at. */
    const PROJECT_KEY = 'dsh-mode-skills.project'
    function savedProject() {
      try {
        return window.localStorage.getItem(PROJECT_KEY) ?? ''
      } catch {
        // Storage can be blocked; the page then starts without a project.
        return ''
      }
    }
    function rememberProject(value) {
      try {
        if (value === '') window.localStorage.removeItem(PROJECT_KEY)
        else window.localStorage.setItem(PROJECT_KEY, value)
      } catch {
        // Storage can be blocked; the project is then not remembered.
      }
    }

    function Page({ ctx, t }) {
      React.useSyncExternalStore(listener => ctx.locale.subscribe(listener), () => ctx.locale.getSnapshot())
      const [data, setData] = React.useState(null)
      const [failure, setFailure] = React.useState(null)
      const [loading, setLoading] = React.useState(false)
      const [query, setQuery] = React.useState('')
      const [filter, setFilter] = React.useState('')
      const [openNames, setOpenNames] = React.useState(() => new Set())
      const [busy, setBusy] = React.useState(() => new Set())
      const [notice, setNotice] = React.useState(null)
      const [libBusy, setLibBusy] = React.useState(false)
      const [panel, setPanel] = React.useState(null)
      const [sort, setSort] = React.useState('name')
      const [editName, setEditName] = React.useState(null)
      const [tag, setTag] = React.useState('')
      const [project, setProject] = React.useState(savedProject)
      const [bodyHits, setBodyHits] = React.useState(() => new Set())
      const [bulk, setBulk] = React.useState(null)
      const [usage, setUsage] = React.useState(null)
      const [usageDays, setUsageDays] = React.useState(30)
      const [usageLoading, setUsageLoading] = React.useState(false)
      const [usageError, setUsageError] = React.useState(null)
      const projectRef = React.useRef(project)
      const alive = React.useRef(true)
      const noticeTimer = React.useRef(undefined)

      const load = React.useCallback(function reload(refresh) {
        setLoading(true)
        return post(ROUTE, 'list', { ...refresh ? { refresh: true } : {}, ...projectRef.current === '' ? {} : { cwd: projectRef.current } })
          .then(async (value) => {
            // While dsh-modes owns the library, a skill's versions and import record are the ones it keeps.
            if (value.manager === 'dsh-modes') {
              try {
                const library = await post(MODES_ROUTE, 'skills', refresh ? { refresh: true } : {})
                const byName = new Map(library.skills.map(skill => [skill.name, skill]))
                value = {
                  ...value,
                  skills: value.skills.map((skill) => {
                    const kept = byName.get(skill.name)
                    if (kept === undefined) return skill
                    return {
                      ...skill,
                      versions: kept.versions ?? [],
                      editable: kept.editable ?? skill.editable,
                      ...kept.imported === undefined ? {} : { imported: kept.imported },
                      ...kept.exists === false ? { exists: false } : {},
                      ...skill.path === undefined && typeof kept.path === 'string' ? { path: kept.path, display: kept.display } : {},
                    }
                  }),
                }
              } catch (error) {
                value = { ...value, libraryError: error.message }
              }
            }
            if (!alive.current) return
            setData(value)
            setFailure(null)
          })
          .catch((error) => {
            if (!alive.current) return undefined
            // A remembered project folder that is gone or not a full path would block the page for good.
            if (projectRef.current !== '' && (error.code === 'folder-missing' || error.code === 'folder-relative')) {
              const gone = projectRef.current
              projectRef.current = ''
              setProject('')
              rememberProject('')
              show({ kind: 'warn', text: t('project.gone', { path: gone }) })
              return reload(refresh)
            }
            setFailure(error.message)
            return undefined
          })
          .finally(() => { if (alive.current) setLoading(false) })
      }, [])
      React.useEffect(() => {
        alive.current = true
        load(false)
        return () => {
          alive.current = false
          clearTimeout(noticeTimer.current)
        }
      }, [load])

      const ready = data !== null
      React.useEffect(() => {
        const text = query.trim()
        if (text.length < 2 || !ready) {
          setBodyHits(new Set())
          return undefined
        }
        let live = true
        const timer = setTimeout(() => {
          post(ROUTE, 'searchSkills', { query: text }).then(value => (live && alive.current ? setBodyHits(new Set(value.names)) : undefined), () => (live && alive.current ? setBodyHits(new Set()) : undefined))
        }, 300)
        return () => {
          live = false
          clearTimeout(timer)
        }
      }, [query, ready])

      const presetT = ctx.locale.bind('settings.agentPreset')
      const modeName = (mode) => {
        const stem = mode.name === undefined ? BUILT_IN_COPY[mode.id] : undefined
        if (stem !== undefined) {
          const key = `preset${stem}Name`
          const value = presetT(key)
          if (value !== key) return value
        }
        return mode.name ?? mode.id
      }
      /** Localized text for a failure code, with its details as parameters; the Host's English message otherwise. */
      const describeCode = (code, details, fallback) => {
        const key = `err.${code}`
        const text = t(key, details)
        return text === key ? fallback : text
      }
      const describe = error => (error instanceof ActionFailure ? describeCode(error.code, error.details, error.message) : error.message)
      const show = (next) => {
        clearTimeout(noticeTimer.current)
        setNotice(next)
        // A notice that offers an action stays longer, so there is time to take it.
        if (next?.kind === 'done') noticeTimer.current = setTimeout(() => { if (alive.current) setNotice(null) }, next.action === undefined ? NOTICE_MS : NOTICE_MS * 3)
      }
      const zh = String(ctx.locale.getSnapshot().active).toLowerCase().startsWith('zh')
      const namesOf = ids => ids.map(id => modeName(data?.modes.find(mode => mode.id === id) ?? { id })).join(zh ? '、' : ', ')

      const save = (changes, key, undo) => {
        if (data === null) return
        setBusy(current => new Set(current).add(key))
        saveChanges(data.manager, changes)
          .then((effect) => {
            if (!alive.current) return
            const lead = undo === undefined ? '' : `${t('bulk.done', { n: changes.length })} · `
            const action = undo === undefined ? undefined : { label: t('undo'), run: () => save(undo, key) }
            if (effect.failed.length > 0) show({ kind: 'warn', text: t('effect.failed', { modes: namesOf(effect.failed.map(item => item.id)), reason: effect.failed[0].error }) })
            else if (effect.mounted.length > 0) show({ kind: 'done', text: `${lead}${t('effect.newSessions', { modes: namesOf(effect.mounted) })}`, action })
            else show({ kind: 'done', text: `${lead}${t('effect.applied')}`, action })
            return load(data.manager === 'dsh-modes')
          })
          .catch((error) => { if (alive.current) show({ kind: 'warn', text: describe(error) }) })
          .finally(() => {
            if (alive.current) setBusy((current) => {
              const next = new Set(current)
              next.delete(key)
              return next
            })
          })
      }

      /** Run one library change; resolves true on success and rejects with the failure for callers that handle it. */
      const run = (action, payload, success) => {
        setLibBusy(true)
        return lib(data.manager, action, payload).then(() => {
          if (alive.current) show({ kind: 'done', text: t(success) })
          return load(true).then(() => true)
        }, (error) => {
          if (alive.current) show({ kind: 'warn', text: describe(error) })
          throw error
        }).finally(() => { if (alive.current) setLibBusy(false) })
      }
      /** Create a skill, then open it with its file in the editor. */
      const createSkill = (payload) => {
        setLibBusy(true)
        lib(data.manager, 'createSkill', payload).then((value) => {
          if (!alive.current) return
          setPanel(null)
          setOpenNames(current => new Set(current).add(value.name))
          setEditName(value.name)
          const failed = value.failed ?? []
          if (failed.length > 0) show({ kind: 'warn', text: t('effect.failed', { modes: namesOf(failed.map(item => item.id)), reason: failed[0].error }) })
          else show({ kind: 'done', text: `${t('lib.created', { name: value.name })} · ${t('lib.newEffect')}` })
          return load(true)
        }, (error) => { if (alive.current) show({ kind: 'warn', text: describe(error) }) })
          .finally(() => { if (alive.current) setLibBusy(false) })
      }
      /**
       * Import skill folders.
       * @returns {Promise<object[] | null>} one result per item, or null when the request failed as a whole.
       */
      const runImport = (items, target, uploaded) => {
        setLibBusy(true)
        const request = uploaded === undefined ? lib(data.manager, 'importSkills', { items, target }) : post(ROUTE, 'importUploads', { upload: uploaded, items, target })
        return request.then((value) => {
          const results = value.results
          const count = (...statuses) => results.filter(result => statuses.includes(result.status)).length
          const failed = count('error')
          const parts = [
            count('imported') > 0 ? t('lib.importDone', { n: count('imported') }) : undefined,
            count('updated', 'replaced') > 0 ? t('lib.importUpdated', { n: count('updated', 'replaced') }) : undefined,
            failed > 0 ? t('lib.importFailed', { n: failed }) : undefined,
            results.length > failed ? t('lib.newEffect') : undefined,
          ].filter(Boolean)
          if (alive.current) show({ kind: failed > 0 ? 'warn' : 'done', text: parts.join(' · ') })
          return load(true).then(() => results)
        }, (error) => {
          if (alive.current) show({ kind: 'warn', text: describe(error) })
          return null
        }).finally(() => { if (alive.current) setLibBusy(false) })
      }

      /** Run one of this plugin's own actions, which it serves with or without dsh-modes; resolves true on success. */
      const own = (action, payload, success, refresh = true) => {
        setLibBusy(true)
        return post(ROUTE, action, payload).then((value) => {
          if (alive.current && success !== undefined) show({ kind: 'done', text: typeof success === 'function' ? success(value) : t(success) })
          return load(refresh).then(() => value ?? true)
        }, (error) => {
          if (alive.current) show({ kind: 'warn', text: describe(error) })
          return false
        }).finally(() => { if (alive.current) setLibBusy(false) })
      }
      const restoreTrash = id => own('restoreTrash', { id }, value => t('trash.restored', { name: value.name, path: value.display }))
      /** Move a skill to the bin, with Undo in the notice. */
      const trashSkill = name => own('deleteSkill', { skill: name }).then((value) => {
        if (value === false || !alive.current) return
        show({ kind: 'done', text: t('lib.trashed', { name }), action: { label: t('undo'), run: () => restoreTrash(value.id) } })
      })
      const saveSkipped = (path, text, base) => own('writeSkipped', { path, text, base, ...projectRef.current === '' ? {} : { cwd: projectRef.current } }).then((value) => {
        if (value === false) return false
        if (alive.current) show(value.problem === null ? { kind: 'done', text: t('skipped.saved') } : { kind: 'warn', text: t('skipped.stillBroken', { reason: skippedReason(t, value.problem) }) })
        return true
      })
      /** One skill's setting in a mode as the page reads it: `on`, `manual`, `model`, or `off`. */
      const choiceOf = (mode, skill) => (data.manager === 'dsh-modes'
        ? skill.modes[mode.id] === 'off' ? 'off' : 'on'
        : mode.off.includes(skill.name) ? 'off' : mode.manual.includes(skill.name) ? 'manual' : (mode.model ?? []).includes(skill.name) ? 'model' : 'on')
      const changeFor = (mode, skill, target) => (data.manager === 'dsh-modes'
        ? { preset: mode.id, skill, enabled: target !== 'off' }
        : { preset: mode.id, skill, state: target })
      /** Set a skill on, manual only, model only, or off in a mode, through whichever plugin owns the settings. */
      const setState = (mode, skill, target) => save([changeFor(mode, skill, target)], `${mode.id}\0${skill}`)
      /** Set several skill/mode pairs at once; the notice offers to undo them. */
      const setMany = (items) => {
        const changing = items.filter(item => choiceOf(item.mode, item.skill) !== item.target)
        if (changing.length === 0) {
          show({ kind: 'done', text: t('bulk.nothing') })
          return
        }
        save(changing.map(item => changeFor(item.mode, item.skill.name, item.target)), 'bulk', changing.map(item => changeFor(item.mode, item.skill.name, choiceOf(item.mode, item.skill))))
      }

      /** Update skills installed from GitHub; resolves to the results, or null when the request failed as a whole. */
      const updateGithub = (names) => {
        setLibBusy(true)
        return post(ROUTE, 'updateGithub', { skills: names }).then((value) => {
          const done = value.results.filter(result => result.status !== 'error').length
          const failed = value.results.filter(result => result.status === 'error')
          if (alive.current) {
            show(failed.length === 0
              ? { kind: 'done', text: `${t('github.updated', { n: done })} · ${t('lib.newEffect')}` }
              : { kind: 'warn', text: `${t('github.updated', { n: done })} · ${failed.map(result => t('lib.importFailure', { name: result.name ?? result.path, reason: describeCode(result.code, result.details, result.error) })).join('；')}` })
          }
          return load(true).then(() => value.results)
        }, (error) => {
          if (alive.current) show({ kind: 'warn', text: describe(error) })
          return null
        }).finally(() => { if (alive.current) setLibBusy(false) })
      }
      /** Look for newer versions of every skill installed from GitHub. */
      const checkUpdates = () => {
        setLibBusy(true)
        show({ kind: 'done', text: t('github.checking') })
        return post(ROUTE, 'checkUpdates', {}).then((value) => {
          if (alive.current) {
            if (value.updates.length > 0) {
              show({ kind: 'done', text: t('github.found', { n: value.updates.length, names: value.updates.join(', ') }), action: { label: t('github.all', { n: value.updates.length }), run: () => updateGithub(value.updates) } })
            } else if (value.failed.length > 0) {
              show({ kind: 'warn', text: value.failed.map(item => t('github.failedRepo', { repo: item.repo, reason: describeCode(item.code, item.details, item.error) })).join('；') })
            } else {
              show({ kind: 'done', text: t('github.none', { n: value.checked }) })
            }
          }
          return load(false)
        }, (error) => {
          if (alive.current) show({ kind: 'warn', text: describe(error) })
        }).finally(() => { if (alive.current) setLibBusy(false) })
      }
      /** Move this plugin's dormant Off settings to dsh-modes, which applies them while it is installed. */
      const handOff = () => {
        setLibBusy(true)
        const changes = data.modes.flatMap(mode => mode.off.map(skill => ({ preset: mode.id, skill, enabled: false })))
        return post(MODES_ROUTE, 'setSkillModes', { changes })
          .then(() => post(ROUTE, 'clearModes', { kinds: ['off'] }))
          .then(() => {
            if (alive.current) show({ kind: 'done', text: t('handoff.done', { n: changes.length }) })
            return load(true)
          }, (error) => { if (alive.current) show({ kind: 'warn', text: describe(error) }) })
          .finally(() => { if (alive.current) setLibBusy(false) })
      }
      /** Count skill loads in the session history over `days` days. */
      const loadUsage = (days, refresh) => {
        setUsageLoading(true)
        setUsageError(null)
        return post(ROUTE, 'usage', { days, ...refresh ? { refresh: true } : {} }).then((value) => { if (alive.current) setUsage(value) }, (error) => {
          if (alive.current) setUsageError(describe(error))
        }).finally(() => { if (alive.current) setUsageLoading(false) })
      }
      const openUsage = () => {
        const opening = panel !== 'usage'
        setPanel(opening ? 'usage' : null)
        if (opening && usage === null && !usageLoading) void loadUsage(usageDays, false)
      }
      /** Show the skills of a project folder (or none, for an empty path). */
      const applyProject = (value) => {
        const next = value.trim()
        projectRef.current = next
        setProject(next)
        rememberProject(next)
        setPanel(null)
        void load(true)
      }

      const ui = {
        t,
        lang: zh ? 'zh' : 'en',
        manager: data?.manager,
        own,
        restoreTrash,
        trashSkill,
        saveSkipped,
        setState,
        setMany,
        choiceOf,
        updateGithub,
        project,
        usage,
        notify: (kind, text) => { if (alive.current) show({ kind, text }) },
        importUpload: (upload, items, target) => runImport(items, target, upload),
        busy,
        libBusy,
        save,
        run,
        quiet: (action, payload, success) => run(action, payload, success).catch(() => false),
        runImport,
        lib: (action, payload) => lib(data.manager, action, payload),
        fail: (error) => { if (alive.current) show({ kind: 'warn', text: describe(error) }) },
        describe,
        describeCode,
        modeName,
        sourceName: (skill) => {
          if (skill.packaged === true) return t('source.package')
          const key = `source.${skill.source}`
          const value = t(key)
          return value === key ? skill.provider ?? skill.source : value
        },
      }

      const modes = data?.modes ?? []
      const needle = query.trim().toLowerCase()
      const namesMatch = skill => skill.name.toLowerCase().includes(needle) || (skill.description ?? '').toLowerCase().includes(needle)
        || (skill.alias ?? '').toLowerCase().includes(needle) || (skill.tags ?? []).some(entry => entry.toLowerCase().includes(needle))
      const allTags = [...new Set((data?.skills ?? []).flatMap(skill => skill.tags ?? []))].sort((a, b) => a.localeCompare(b))
      const skills = (data?.skills ?? []).filter(skill =>
        (filter === '' || skill.modes[filter] !== undefined)
        && (tag === '' || (skill.tags ?? []).includes(tag))
        && (needle === '' || namesMatch(skill) || bodyHits.has(skill.name)))
      if (sort === 'tokens') skills.sort((a, b) => (b.tokens ?? 0) - (a.tokens ?? 0) || a.name.localeCompare(b.name))
      const chosenMode = filter === '' ? undefined : modes.find(mode => mode.id === filter)
      const costs = modes.filter(mode => mode.catalog !== undefined)
      const toggleOpen = name => setOpenNames((current) => {
        const next = new Set(current)
        if (next.has(name)) next.delete(name)
        else next.add(name)
        return next
      })
      const dormantOff = data?.manager === 'dsh-modes' ? modes.reduce((sum, mode) => sum + mode.off.length, 0) : 0
      const dormantOther = data?.manager === 'dsh-modes' ? modes.reduce((sum, mode) => sum + mode.manual.length + (mode.model ?? []).length, 0) : 0
      const githubSkills = (data?.skills ?? []).filter(skill => skill.imported?.source === 'github')
      const githubChanged = githubSkills.filter(skill => skill.imported.state === 'changed')
      const settableHere = chosenMode === undefined ? [] : skills.filter(skill => cell(ui, data, skill, chosenMode).reason === undefined)
      const bulkList = (target) => {
        setBulk(null)
        setMany(settableHere.map(skill => ({ mode: chosenMode, skill, target })))
      }

      let body
      if (data === null && failure === null) {
        body = h('div', { className: 'sk-skeleton', 'aria-busy': true }, h('span'), h('span'), h('span'))
      } else if (data === null) {
        body = h('div', { className: 'sk-note is-warn', role: 'alert' },
          h('span', { className: 'sk-grow' }, t('loadFailed', { reason: failure })),
          h('button', { type: 'button', className: 'sk-btn', onClick: () => load(true) }, t('retry')))
      } else if (data.registry === false) {
        body = h('div', { className: 'sk-note' }, t('noRegistry'))
      } else if (data.skills.length === 0) {
        body = h('div', { className: 'sk-note' }, t('empty.none', { dsh: data.roots.dsh, agents: data.roots.agents }))
      } else if (skills.length === 0) {
        body = h('div', { className: 'sk-hint' }, t('empty.filtered'))
      } else {
        body = h('div', { className: 'sk-list' }, skills.map(skill => h(SkillRow, {
          key: skill.name, skill, data, filter, ui, open: openNames.has(skill.name), onToggle: () => toggleOpen(skill.name),
          bodyOnly: needle !== '' && !namesMatch(skill) && bodyHits.has(skill.name),
          autoEdit: editName === skill.name, onAutoEdited: () => setEditName(null),
        })))
      }

      return h('div', { className: 'sk' },
        h('style', null, CSS),
        h('div', { className: 'sk-inner' },
          h('header', null,
            h('h1', null, t('title')),
            h('p', { className: 'sk-sub' }, t('intro'))),
          h('div', { className: 'sk-note' }, t('preview')),
          data?.manager === 'dsh-modes' ? h('div', { className: 'sk-note' }, t('managedByModes')) : null,
          dormantOff + dormantOther > 0 ? h('div', { className: 'sk-note' },
            h('div', { className: 'sk-grow' },
              h('div', null, t('dormant', { n: dormantOff + dormantOther })),
              dormantOff > 0 && dormantOther > 0 ? h('div', null, t('handoff.leftover', { n: dormantOther })) : null),
            dormantOff > 0 ? h('button', { type: 'button', className: 'sk-btn', disabled: libBusy, onClick: handOff }, t('handoff.button')) : null) : null,
          githubChanged.length > 0 ? h('div', { className: 'sk-note' },
            h('span', { className: 'sk-grow' }, t('github.banner', { n: githubChanged.length })),
            h('button', { type: 'button', className: 'sk-btn', disabled: libBusy, onClick: () => updateGithub(githubChanged.map(skill => skill.name)) }, t('github.all', { n: githubChanged.length }))) : null,
          data?.stateError === undefined ? null : h('div', { className: 'sk-note is-warn', role: 'alert' }, t('stateError', { reason: data.stateError })),
          data?.libraryError === undefined ? null : h('div', { className: 'sk-note is-warn', role: 'alert' }, t('lib.libraryFailed', { reason: data.libraryError })),
          h('div', { className: 'sk-bar' },
            h('input', { type: 'search', className: 'sk-input', value: query, placeholder: t('search'), 'aria-label': t('search'), onChange: event => setQuery(event.target.value) }),
            h('select', { className: 'sk-select', value: filter, 'aria-label': t('allModes'), onChange: event => setFilter(event.target.value) },
              h('option', { value: '' }, t('allModes')),
              modes.map(mode => h('option', { key: mode.id, value: mode.id }, mode.isDefault ? `${modeName(mode)} · ${t('default')}` : modeName(mode)))),
            allTags.length === 0 ? null : h('select', { className: 'sk-select', value: tag, 'aria-label': t('tag.all'), onChange: event => setTag(event.target.value) },
              h('option', { value: '' }, t('tag.all')),
              allTags.map(entry => h('option', { key: entry, value: entry }, entry))),
            h('select', { className: 'sk-select', value: sort, 'aria-label': t('sort.name'), onChange: event => setSort(event.target.value) },
              h('option', { value: 'name' }, t('sort.name')),
              h('option', { value: 'tokens' }, t('sort.tokens'))),
            h('button', { type: 'button', className: 'sk-btn', 'aria-expanded': panel === 'create', disabled: data === null || libBusy, onClick: () => setPanel(panel === 'create' ? null : 'create') }, t('lib.create')),
            h('button', { type: 'button', className: 'sk-btn', 'aria-expanded': panel === 'import', disabled: data === null || (libBusy && panel !== 'import'), onClick: () => setPanel(panel === 'import' ? null : 'import') }, t('lib.import')),
            h('button', { type: 'button', className: 'sk-btn', 'aria-expanded': panel === 'project', disabled: data === null, onClick: () => setPanel(panel === 'project' ? null : 'project') }, project === '' ? t('project.button') : `${t('project.button')} ✓`),
            h('button', { type: 'button', className: 'sk-btn', 'aria-expanded': panel === 'usage', disabled: data === null, onClick: openUsage }, t('usage.button')),
            githubSkills.length === 0 ? null : h('button', { type: 'button', className: 'sk-btn', disabled: libBusy, onClick: checkUpdates }, t('github.check')),
            data === null || data.trash.length === 0 ? null : h('button', { type: 'button', className: 'sk-btn', 'aria-expanded': panel === 'trash', onClick: () => setPanel(panel === 'trash' ? null : 'trash') }, t('trash.button', { n: data.trash.length })),
            h('button', { type: 'button', className: 'sk-btn', disabled: loading, onClick: () => load(true) }, t('refresh'))),
          data !== null && panel === 'usage' ? h(UsagePanel, {
            ui, data, usage, loading: usageLoading, error: usageError, days: usageDays,
            onDays: (days) => { setUsageDays(days); void loadUsage(days, false) }, onRefresh: () => loadUsage(usageDays, true), onClose: () => setPanel(null),
          }) : null,
          data !== null && panel === 'project' ? h(ProjectPanel, { ui, project, onApply: applyProject, onClose: () => setPanel(null) }) : null,
          data !== null && data.project !== undefined && panel !== 'project' ? h('div', { className: 'sk-note' },
            h('span', { className: 'sk-grow' }, t('project.active', { path: data.project })),
            h('button', { type: 'button', className: 'sk-btn', onClick: () => applyProject('') }, t('project.clear'))) : null,
          data !== null && panel === 'trash' ? h(TrashPanel, { ui, data, busy: libBusy, onClose: () => setPanel(null) }) : null,
          data !== null && panel === 'skipped' ? h(SkippedPanel, { ui, data, busy: libBusy, onClose: () => setPanel(null) }) : null,
          data === null || data.skipped.length === 0 || panel === 'skipped' ? null : h('div', { className: 'sk-note is-warn' },
            h('span', { className: 'sk-grow' }, t('skipped.note', { n: data.skipped.length })),
            h('button', { type: 'button', className: 'sk-btn', onClick: () => setPanel('skipped') }, t('skipped.show'))),
          data !== null && panel === 'create' ? h(CreateSkillPanel, { ui, data, busy: libBusy, onCancel: () => setPanel(null), onCreate: createSkill }) : null,
          data !== null && panel === 'import' ? h(ImportSkillsPanel, { ui, data, busy: libBusy, onClose: () => setPanel(null), onImport: runImport }) : null,
          notice === null ? null : h('div', { className: `sk-note ${notice.kind === 'done' ? 'is-done' : 'is-warn'}`, role: notice.kind === 'done' ? 'status' : 'alert' },
            h('span', { className: 'sk-grow' }, notice.text),
            notice.action === undefined ? null : h('button', { type: 'button', className: 'sk-btn', disabled: libBusy, onClick: () => { const { run } = notice.action; show(null); run() } }, notice.action.label),
            h('button', { type: 'button', className: 'sk-btn', onClick: () => show(null) }, t('dismiss'))),
          data === null || failure === null ? null : h('div', { className: 'sk-note is-warn', role: 'alert' }, t('loadFailed', { reason: failure })),
          ...Object.entries(data?.errors ?? {}).map(([id, reason]) => h('div', { key: `e:${id}`, className: 'sk-note is-warn' },
            t('modeError', { mode: modeName(modes.find(mode => mode.id === id) ?? { id }), reason }))),
          chosenMode === undefined || settableHere.length === 0 ? null : h('div', { className: 'sk-bar' },
            h('button', { type: 'button', className: 'sk-btn', disabled: busy.has('bulk'), onClick: () => bulkList('on') }, t('bulk.listOn')),
            h('button', { type: 'button', className: 'sk-btn', disabled: busy.has('bulk'), onClick: () => setBulk('off') }, t('bulk.listOff'))),
          bulk === 'off' && chosenMode !== undefined ? h(ConfirmBox, {
            ui, text: t('bulk.listConfirm', { mode: modeName(chosenMode), n: settableHere.length }), action: t('bulk.listOff'), danger: true, busy: busy.has('bulk'),
            onCancel: () => setBulk(null), onConfirm: () => bulkList('off'),
          }) : null,
          data === null || data.skills.length === 0 ? null : h('div', { className: 'sk-hint', title: t('tok.hint') },
            chosenMode !== undefined
              ? chosenMode.catalog === undefined ? t('count', { n: skills.length }) : t('tok.mode', { mode: modeName(chosenMode), n: chosenMode.catalog.skills, tokens: chosenMode.catalog.tokens })
              : costs.length === 0 ? t('count', { n: skills.length }) : `${t('count', { n: skills.length })} · ${t('tok.modes', { list: costs.map(mode => t('tok.entry', { mode: modeName(mode), tokens: mode.catalog.tokens })).join(zh ? '、' : ', ') })}`),
          body))
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'dsh-mode-skills: dictionaries')
        const t = ctx.locale.bind(NS)
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 5, label: () => t('nav') }, SidebarIcon))
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID }, () => h(Page, { ctx, t })))
      },
    }
  },
})
