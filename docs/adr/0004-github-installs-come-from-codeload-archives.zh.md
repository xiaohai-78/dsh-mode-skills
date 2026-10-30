# GitHub 安装走 codeload 压缩包

从 GitHub 安装 Skill，是从 `codeload.github.com` 下载仓库的源码压缩包，不需要账号、token，也不占 API 额度；提交号取自压缩包的注释。检查更新时重新下载压缩包，把每个已安装 Skill 文件夹的内容指纹和安装时记下的对比，所以一个提交没动某个 Skill 的文件夹，对这个 Skill 就不算更新。

## 后果

- 只能安装公开仓库。
- 即使只从某个仓库装了一个 Skill，检查时也要下载整个压缩包（最多 60 MB）。
