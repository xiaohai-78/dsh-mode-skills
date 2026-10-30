# Requirements

What Skill Manager must do, and how each part was verified. This is the one place the requirements live: a feature's spec under `.scratch/<feature>/` is folded in here when the feature is done. Terms follow [GLOSSARY.md](../GLOSSARY.md); the reasons behind the design are in [docs/adr/](adr/).

## Who it is for

People who use DSH with several agent modes and more than a handful of skills. DSH puts every skill it finds into every mode that has the skill tool. Turning a skill off for one mode, seeing what each mode loads and what that costs, or installing a skill someone published means editing configuration and folders by hand.

## Goals

- One page, in the sidebar, for every skill on the computer.
- Turn each skill on or off per mode, with Manual and Model in between.
- Create, edit, import, install, version, and delete skills without leaving DSH.
- Choose a skill's audience: DSH only, or all agents.

## Out of scope

- Installing from hosts other than GitHub, such as GitLab or Gitee.
- Installing from private repositories.
- Offering All agents for skills inside a project.
- Removing anything from another agent tool's folder for good: only this plugin's links are removed, and an identical copy is moved to the bin.

## Constraints

- Installed alone, it manages skills per mode.
- Installed together with dsh-modes, there is one copy of the data: per-mode settings, creating, importing, and versions go through dsh-modes ([ADR 0002](adr/0002-mode-manager-owns-shared-data.md)).
- Modes keep working after it is uninstalled ([ADR 0003](adr/0003-policy-row-switches-off-after-uninstall.md)).
- Its entry sits in the sidebar, below Plugins.
- The page follows DSH's language and has every text in Chinese and English.
- The page can check for a newer release and upgrade the plugin.
- When the page fails to draw, it shows the error text and Reload, never an empty panel.
- It works on Windows, macOS, and Linux, on Node `^22.19.0 || >=24`.
- The README and market text claim only what was verified.

## Features

### Per-mode switches

**Acceptance criteria**

- Each skill can be set to On, Manual, Model, or Off in each mode that loads skills, and turned on or off in all modes at once.
- Manual hides the skill from the model but keeps `/name`; Model offers it to the model but not in the `/` menu.
- A mode that does not load skills, and a skill the mode does not have, cannot be set, and the reason is shown.
- Turn all on or Turn all off applies to the list shown and offers Undo.
- In a mode that already has this plugin's row, a change reaches running sessions from their next step; the first change in a mode reaches new sessions, and the notice names the mode.

**Verified**

- With this plugin alone, turning a skill off in Standard added the guarded policy row and listed the skill as off there; turning skills off and on with the page's switches saved correctly, with the notices described above.
- Setting a skill to Manual in Standard removed it from Standard's catalog while Standard sessions' `/` menu still offered it, marked user-only. Setting a skill to Model showed "Model only" for that mode in the registry's own listing. **Turn all off** for a mode, then Undo, restored every setting.
- What the model saw (the requests a mock model received): in Standard, where one skill was Manual, one Off, and one Model-only, the catalog listed the Model-only skill and left out the other two; in PTC, where all were On, `/weekly-report` injected the skill's content; in Standard, where it is Model-only, the same line was left as plain text.
- Not yet verified: when a running session picks up a changed skill catalog. It uses the same mechanisms as dsh-modes (provider invalidation and the file watcher).

### Working with Mode Manager

**Acceptance criteria**

- While dsh-modes is installed, per-mode settings, creating, importing, and versions are saved through it, and both pages show the same data.
- Manual and Model, which dsh-modes does not have, are unavailable then, with the reason.
- Off settings this plugin saved before dsh-modes was installed can be handed over to dsh-modes.

**Verified**

- The page said Mode Manager owns the settings; turning a skill off in PTC here wrote it to dsh-modes's `skills.json` and left this plugin's own settings unchanged.
- Creating, reading the file, saving a version, the import list, and importing from the page all went to `/api/dsh-modes`; the skill's details, versions, and import record were written to dsh-modes's data and not to this plugin's.
- Manual was unavailable with its reason, and the rest worked as usual.
- **Hand over to Mode Manager** moved an Off setting into Mode Manager's settings and cleared it here.

### Modes keep working after an uninstall

**Acceptance criteria**

- After the plugin is removed, every mode it changed still loads and starts sessions.
- Installing it again brings back the settings it had.

**Verified**

- After `dsh plugin remove` and with the package files gone, Standard was still in the mode list and a new session started; installing again turned the skill off again.

### Seeing and organizing skills

**Acceptance criteria**

- The list shows every skill the modes see, with its source, description, and state in each mode.
- Search matches names, descriptions, display names, tags, and the text of the skill files.
- Display names and tags are kept in this plugin's settings, never in the skill file.
- A chosen project folder adds that project's skills.
- Each skill and each mode's catalog shows its estimated token cost, and the list sorts by it.

**Verified**

- Each mode's catalog cost was shown and sorting by tokens worked.
- A display name and tags saved and showed on the row; text search found a skill by a word only its body had; a project folder added that project's skill, with its source and token cost.

### Creating, editing, versions, and the trash

**Acceptance criteria**

- A new skill opens in the editor and is on only in the modes chosen for it.
- An edit to SKILL.md or another file saves the current file first, and a file changed elsewhere meanwhile is reported.
- Unsaved edits survive collapsing the row or visiting another page.
- Versions can be saved with a note, viewed, restored, and deleted.
- A deleted skill goes to the trash, can be restored or deleted for good, and the notice offers Undo.
- Skills that belong to an installed package cannot be changed.

**Verified**

- A new skill opened in the editor and was on only in the chosen modes; an edit saved a version first; saving (with a note), viewing, restoring, and deleting versions worked.
- A new file in a skill folder saved and listed.
- Delete, Undo, and restoring from the trash worked.

### Importing from other tools and folders

**Acceptance criteria**

- Skills in Codex, Claude Code (including plugin skills), other agent tools' `~/.<tool>/skills`, any folder, and an uploaded `.zip` or folder can be imported.
- A name clash is imported under a new name or replaces the existing skill after a version is saved.
- Another tool's link to a skill DSH already has shows as Already a DSH skill.
- An imported skill whose source changes later is marked Source changed and can be imported again.

**Verified**

- Two skills were imported from Codex and Claude Code, and the clashing one was not preselected; changing the Codex source marked **Source changed**, and importing again cleared it and kept the version from before.
- `~/.cursor/skills` was listed and an uploaded zip was imported.
- The import list showed links into Claude Code, Cursor, and Gemini CLI as **Already a DSH skill**.

### Installing from GitHub

**Acceptance criteria**

- A repository address, a branch and folder in it, a link to a SKILL.md or its raw file, a git address, a skills.sh page, or a `skills add` command lists the skills in that public repository.
- Nothing is selected except the skill the address names; skills with scripts are marked.
- An address on another host is refused with that host's name.
- Check for updates finds installed skills whose folder changed in the repository, and Update all replaces them after saving the current files as a version.

**Verified**

- A real repository (`anthropics/skills`) was read, three skills installed from it, a faked older install was found by **Check for updates**, and **Update all** replaced it.

### Skill store

**Acceptance criteria**

- The store searches skills.sh and lists the recommended repositories that ship with the plugin.
- Opening a result reads its repository with that skill selected; nothing is installed until the user confirms.
- A link pasted into the search box, when the box is empty or all its text is selected, opens its repository at once; a typed link opens with Enter or Open.
- When skills.sh lists a skill the repository no longer has, the page says so.

**Verified**

- Searching skills.sh and opening a result read its repository with that skill alone selected; the recommended list showed.
- Pasting `https://skills.sh/anthropics/skills/pdf`, `npx skills add https://github.com/anthropics/skills --skill docx`, and a `tree` link to one skill's folder into the store box each read `anthropics/skills` with that one skill selected; typing `anthropics/skills` and pressing Enter listed all 20 with none selected; a GitLab address was refused with its host name.

### Usage per mode

**Acceptance criteria**

- Usage counts each skill's loads per mode over 7, 30, 90, or 365 days, by the model and by `/name`, with the last time.
- It lists the skills nobody loaded and can turn them off in a mode, with Undo.
- It reads names and times from the session history, never message text.

**Verified**

- Through a local mock model, one session loaded a skill with the `skill` tool (Standard mode) and another started `/weekly-report` (PTC mode): **Usage** counted each once, under its own mode, from the real session logs.

### Skills DSH does not load

**Acceptance criteria**

- Files with a SKILL.md that DSH does not load are listed with the reason.
- A mechanical fix is offered to review and save, and the old file is backed up first.

**Verified**

- A SKILL.md with a colon in its description was listed as not loaded, and after saving the offered fix DSH loaded it.

### Audience: DSH only or all agents

**Acceptance criteria**

- Each skill in the user's own folders shows its audience on its row and can be switched in its details.
- All agents keeps one copy in the shared folder and links it into every other installed agent tool ([ADR 0001](adr/0001-all-agents-is-one-copy-and-links.md)); DSH only moves it back to `~/.dsh/skills` and removes those links.
- Before a change, the page says what it will do to each tool; a tool's different skill of the same name is left alone, and an identical copy becomes a link with the copy in the bin.
- Other agents lists the tools found, adds missing links, and gives every DSH-only skill to all agents at once.
- Creating or importing for all agents links the skill at once; deleting removes its links, and restoring adds them again.

**Verified**

- In a home with Claude Code, Codex, Cursor, and Gemini CLI folders and dsh-modes installed, **All agents** on a skill moved it to `~/.agents/skills`, put relative links in the Claude Code and Cursor folders, and left Gemini CLI's different skill of that name alone, as the confirmation had said.
- **Other agents** listed the four tools with their counts and gave the remaining DSH-only skill to all agents, turning Cursor's identical copy into a link with the copy in the trash.
- **DSH only** moved a skill back and removed its links; a new skill created for all agents was linked at once.

### Updating the plugin

**Acceptance criteria**

- The page says when a newer release is out and installs it through DSH's plugin manager after the user confirms ([ADR 0006](adr/0006-plugin-updates-itself-through-dsh-plugin-manager.md)).
- The automatic check can be turned off; a development install is never checked.
- After an upgrade, the new version says it is running.

**Verified**

- On the real npm registry, a copy labelled 0.1.9 found 0.2.0, **Upgrade…** installed it through DSH's installer, and the profile then depended on the 0.2.0 tarball; on 0.2.1-rc.2 the new version took over without a restart.
- Installing the same release again reported it as installed and waiting for a restart.
- A planted upgrade note showed **Upgraded to** on the page, and dismissing it cleared the note.

### When the page fails

**Acceptance criteria**

- When the page throws while drawing, it shows the error text and a Reload button that loads the page again.
