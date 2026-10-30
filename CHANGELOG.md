# Changelog

Earlier versions are in the git history and the version tags (`v0.2.0` to `v0.4.1`).

## Unreleased

- **Paste a skill link into the store**: a link pasted into the **Skill store** search box reads that repository and lists its skills, instead of searching for the link's text; a typed link opens with Enter or **Open**. GitHub addresses (also to a folder or a `SKILL.md`), `owner/repo`, git addresses, raw file links, skills.sh pages, and `npx skills add … --skill …` commands work, in the store and under **Import skills → GitHub**. A skills.sh page, a `--skill` option, or a link to one skill's folder starts with that skill selected. An address on another host, such as GitLab, is refused with the host's name.
- **DSH only or all agents**: each skill in your own folders shows who uses it, on its row and as a switch in its details. **All agents** keeps one copy in `~/.agents/skills` and links it into the skills folder of Claude Code, Cursor, Gemini CLI, and the other agent tools installed on the computer; **DSH only** moves it back to `~/.dsh/skills` and removes those links. **Other agents** lists the tools found, adds the links a tool is missing, and gives every DSH-only skill to all agents at once. This replaces the move button under **Files and export**.
- The Chinese source label for `~/.agents/skills` is now 「共享目录」.
