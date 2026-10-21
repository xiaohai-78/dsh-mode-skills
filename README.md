# Skill Manager (dsh-mode-skills)

English | [中文](README.zh.md)

A skill manager plugin for DeepSeek Harness (dsh). It adds a **Skills** entry to the sidebar, below **Plugins**: see every skill, turn it on or off per agent mode, create, edit, import, and version skills, and install them from GitHub.

> A preview.

## What it does

- **Sidebar entry**: **Skills** sits beside **Plugins** and **Automation tasks**, outside Settings.
- **Every skill at a glance**: each skill shows its name, where it comes from (DSH user folder, shared folder, project, bundled with a mode, from an installed package, GitHub, and so on), and its description. Expanded, it shows the file location, when to use it, and its state in every mode.
- **Per-mode switches**: expand a skill to set it **On**, **Manual**, **Model**, or **Off** in each mode, or turn it on or off in all modes at once; choose a mode at the top to get that mode's switch on every row, and **Turn all on** or **Turn all off** for the list shown (Undo is offered). **Manual**: the model does not see the skill, but you can start it with `/name`. **Model**: the model sees it, but the `/` menu does not offer it. A mode that does not load skills (such as Minimal) and a skill the mode does not have cannot be set, and the reason is shown.
- **Search and organize**: search matches names, descriptions, display names, tags, and the text of the skill files (those matches are marked **Text match**). Give a skill a display name (such as a Chinese name) and tags, and filter by tag. Both are kept in this plugin's settings only; the skill file is not changed.
- **Project skills**: **Project** takes a project folder (checked when you press Show, with the recent ones offered) and also lists the skills in its `.dsh/skills` and `.agents/skills`. Switches apply to every project by name; a session loads a project skill only while it runs in that project.
- **Install from GitHub**: **Import skills → GitHub** takes a repository address (`github.com/owner/repo`, a branch and folder inside it, or `owner/repo`), downloads its public archive, and lists the skills in it, with a warning for skills that contain scripts. Nothing is selected until you choose. The commit is remembered: **Check for updates** compares each installed skill's folder with the repository's current one, and **Update all** installs the newer versions over them (the current files are saved as a version first). Private repositories are not supported.
- **Skill store**: **Skill store** (a button at the top right, next to **Import skills**) searches [skills.sh](https://skills.sh), a public skill directory (with its install counts), and lists a short set of well-known repositories that ships with the plugin. **View and install** opens that repository inside the store, with that skill selected, through the GitHub flow above: a filter box for long lists, **Back to Skill store** (or Esc) returns to your results as you left them, and **Import selected** stays at the bottom. Nothing is installed until you confirm; afterwards you can keep browsing or finish. If skills.sh lists a skill the repository no longer has, the page says so. The search text is sent to skills.sh.
- **Usage per mode**: **Usage** counts how often each skill was loaded in each mode's sessions over the last 7, 30, 90, or 365 days, both when the model called the `skill` tool and when you typed `/name`, and shows the last time. Choose a mode at the top to see what that mode loaded and what it never did. It lists the skills nobody loaded (in all modes, or in the chosen one) and can turn those off in a mode (Undo is offered). It reads names and times from the session history, never message text. The newest 400 sessions are read, for at most 25 seconds; a saved session is reused for 10 minutes.
- **Token cost**: each skill and each mode's skill catalog shows about how many tokens it costs, and the list can be sorted by tokens, to decide what to turn off where. See **Development** for how it is estimated.
- **Skills DSH does not load**: files in the skill folders that have a SKILL.md but that DSH does not load are listed with the reason (no frontmatter, a YAML mistake, an invalid name, an old field spelling, and so on). Where the fix is mechanical, the fixed content is offered to review and save; the old file is backed up first.
- **Trash**: deleted skills go to a trash to restore or delete for good; the notice right after a delete offers Undo. The trash is never emptied on its own.
- **Create and edit**: **New skill** takes a name and a description, the folder (DSH's own, or the one shared with other agent tools), and the modes it starts on in, then opens its SKILL.md in the editor. Any expanded skill's SKILL.md can be edited too: the current file is saved as a version before an edit is written, and a file changed elsewhere meanwhile is reported. Skills that belong to an installed package cannot be changed.
- **Files, export, move**: **Files and export** lists the other files of a skill folder to view, edit, add, or delete (a copy of the old file is kept in `.dsh-mode-skills/backups/`), exports the skill as a `.zip`, and moves it between `~/.dsh/skills` and `~/.agents/skills`.
- **Import**: **Import skills** lists the skills in Codex (`~/.codex/skills`), Claude Code (`~/.claude/skills` and plugin skills), and other agent tools (found by the `~/.<tool>/skills` convention, such as Cursor and Gemini CLI), reads any folder, or takes a dropped or picked `.zip` or skill folder. Selected skills are copied in; on a name clash they can be imported under a new name or replace the existing skill (after a version is saved). Uploaded skills keep no source.
- **Source change notices**: an imported skill remembers its source. When the source changes later, the list marks it **Source changed**, and expanding it offers to import it again.
- **Version history**: save versions by hand (with an optional note), view, restore to the file (the current file is saved first), or delete them; a deleted version's number is not reused.
- **Modes keep working after an uninstall**: see **Uninstall** below.
- **With Mode Manager**: when [dsh-modes](https://github.com/xiaohai-78/dsh-modes) is installed, it owns the per-mode settings, creating, importing, and versions; actions here are saved through it, the same settings, import records, and versions as its Skills tab, and skills it pinned to a saved version are marked. Manual and Model, which Mode Manager does not have, are unavailable then. A setting that only this plugin had saved earlier stays unused; **Hand over to Mode Manager** moves the Off ones across. The trash, the skipped-file check, token costs, uploads, GitHub installs, display names and tags, the project folder, the file editor, and other agent folders work as usual.

The list holds the skills each mode sees: user folders, custom folders, skills bundled with a mode, and, with a project folder chosen, that project's.

## When changes take effect

- In a mode that already has this plugin's settings, a change reaches running sessions from their next step.
- The first skill turned off, Manual, or Model in a mode adds a settings row to the mode, so that change reaches new sessions; the notice after saving names the mode.

## Install

```bash
dsh plugin --profile web add dsh-mode-skills
```

Run `pnpm dsh plugin --profile web add dsh-mode-skills` in the source folder if you run dsh from source, then restart `dsh web`. To try a checkout, use `link:/path/to/dsh-mode-skills` instead of the name.

Installing from GitHub needs to reach `codeload.github.com` from the machine that runs dsh. Behind a proxy, set `HTTPS_PROXY` and `NODE_USE_ENV_PROXY=1` before starting dsh.

## Uninstall

```bash
dsh plugin --profile web remove dsh-mode-skills
```

The row this plugin adds to a mode is saved with a condition that switches it off once the package is gone. After an uninstall every mode keeps working and the skills turned off come back in every mode. The `.dsh-mode-skills/` folder in the profile directory stays, so installing again brings the settings back. Delete it to clean up.

## Plan

1. **View only** (done): sidebar entry, every skill, its state in each mode.
2. **Per-mode switches** (done): work with only this plugin installed; modes keep working after an uninstall; saved through Mode Manager when it is installed.
3. **Skill library** (done): create, edit, import from Codex, Claude Code, or a folder, source change notices, version history; saved through Mode Manager when it is installed.
4. **Everyday gaps** (done): trash, checking and fixing skill files DSH skips, token costs, zip and folder uploads, more agent folders, per-mode Manual.
5. **Management and GitHub** (done): Model-only, tags and display names, text search, project skills, bulk switches, the files of a skill folder, export and move, GitHub installs with update checks, handing Off settings to Mode Manager.
6. **Store and usage** (done): search on skills.sh and recommended repositories, installing through the GitHub flow, usage counts per skill and mode from the session history.
7. **Later**: our own index beyond skills.sh, one set of skill data shared with Mode Manager, Manual and Model in Mode Manager, a chat tool that manages skills.

## Development

| File | Role |
|---|---|
| `index.js` | Host plugin: serves `POST /api/dsh-mode-skills` and the `dshModeSkills` service the policy row reads. Actions: `list`, `setModes`, the skill library actions with the same names and requests as dsh-modes's (`createSkill`, `readSkillFile`, `writeSkillFile`, `saveSkillVersion`, `restoreSkillVersion`, `deleteSkillVersion`, `readSkillVersion`, `skillSources`, `importSkills`), and this plugin's own: `deleteSkill` and the trash, `readSkipped`, `writeSkipped`, `stageUpload`, `importUploads`, `agentSources`, `setMeta`, `searchSkills`, `listSkillFiles`, `readSkillAsset`, `writeSkillAsset`, `deleteSkillAsset`, `exportSkill`, `moveSkill`, `githubSources`, `checkUpdates`, `updateGithub`, `clearModes`, `usage`, `storeSearch`, and `storeIndex`. While dsh-modes is installed the library and setting actions refuse with `managed-by-modes`. `list` mounts each mode's scope through `agentPresets.acquireScope`, reads `skills.snapshot` (with the project folder as `cwd` when one is chosen) and whether the mode has the `skill` tool, and releases the scope; each mode's result is reused for 60 seconds, except after a change to that mode or the page's **Refresh**. On start it adds the uninstall condition to the modes this plugin wrote, and takes in DSH's built-in updates where a mode differs from them only by this plugin's row |
| `policy.js` | The policy row placed in a mode: registers a skill provider in the mode's own scope that lists, for each skill turned off, an entry neither the model nor the user may invoke, and for each Manual or Model skill an entry only the user or only the model may invoke, loading the skill's current file (rank -1000). It lists nothing while dsh-modes is installed |
| `mode-rows.js` | Adding and removing the policy row, the uninstall condition (`disabled: !!js`, true once the `dsh-mode-skills` package no longer resolves), and merging built-in row updates with `rebase.js` |
| `rebase.js`, `fs-retry.js` | Three-way merge and rename retries on Windows, the same as in dsh-modes |
| `state.js` | `<profile>/.dsh-mode-skills/state.json`: the skills each mode turns off, sets to Manual, or sets to Model, the built-in rows of the last merge, and per skill its `info` (details when last seen, shown while every mode turns it off), `alias` and `tags`, `imported` (source, fingerprints, and for GitHub the repository, ref, folder, commit, and the latest version found), and version index; version files live in `skill-versions/<skill>/<version>/`. Writes are atomic; a damaged file is reported and never overwritten |
| `skill-store.js` | Version ids, SKILL.md frontmatter, line endings, and which skills may be changed (not those in `node_modules`), the same rules as dsh-modes |
| `trash.js` | The trash: a skill folder or flat file moves to `<profile>/.dsh-mode-skills/trash/<id>/` with a record of where it came from, and restoring moves it back unchanged; across disks, or when Windows refuses a rename, it copies and then removes. The same move serves the **Move** button |
| `diagnose.js` | Finds files in the skill folders that have a SKILL.md but that no mode lists, gives the reason in the order DSH checks (byte-order mark, frontmatter, common YAML mistakes, name and description, name grammar, old fields, invocation switches), and offers the fixes that are mechanical. YAML is checked for common mistakes only; anything else is reported as "see DSH's log" |
| `tokens.js` | Estimates tokens from DSH's catalog format (one `` - `name`: description `` line per skill the model may invoke, whitespace collapsed and cut to 500 characters, plus a fixed reminder) at about 0.3 tokens per English character and 0.6 per Chinese character (DeepSeek's published ratios); not a real tokenizer count |
| `zip.js` | Reads a zip (stored and deflate entries; no encryption or zip64), skipping folders, links, and macOS metadata, refusing paths that leave the archive, and holding to the file and byte limits while inflating; reads the archive comment and the list of paths without inflating; writes a zip for export |
| `github.js` | Reads a pasted address (URL, `owner/repo`, branch and folder), downloads the public source archive from `codeload.github.com` (60 MB, 60 seconds), takes the commit from the archive comment, and finds the skill folders in it |
| `usage.js` | Reads skill loads from session logs: a `skill` tool call counts once its result is not an error, and a `user/message` with source `skill-invocation` counts as the user's. A load belongs to the mode the session ran under then (the header's `agentPreset`, replaced by `agent-preset/selected` events, else the default mode). Reads sessions through the `sessionQuery` service, newest first, four at a time; saved sessions are cached for 10 minutes |
| `store.js`, `store-index.json` | Searches skills.sh (`/api/search`, two characters at least; results whose source is not an `owner/repo` pair are dropped), and holds the bundled list of recommended repositories with descriptions in both languages |
| `skill-files.js`, `skill-import.js` | File work for saving and restoring versions; finding skills in Codex, Claude Code, and folders, fingerprints, copying and replacing skill folders (Windows included), new SKILL.md files, and the list of scripts in a folder. Mostly the same as in dsh-modes |
| `skill-view.js` | Combines the modes' skill catalogs into one list with each skill's state in every mode (on, manual only, model only, pinned version, off) |
| `client.js` | The Web page (Chinese and English): registers the `sidebar.panellist` entry and the `main` panel with the same id; saves through `setSkillModes` of `/api/dsh-modes` while dsh-modes is installed |
| `cordis.patch.yml` | Inserts the `index.js` host row |

```bash
npm test
```

Runs on Node 22.19 and 24; when the local Node is outside that range, use `npx --yes node@22.19.0 --test "test/*.test.js"`.

### Verification

Checked on DSH `0.2.1-rc.2` with a separate `DSH_HOME`:

- **This plugin alone**: turning a skill off in Standard added the guarded policy row and listed the skill as off there; turning skills off and on with the page's switches saved correctly, with the notices described above.
- **Uninstall**: after `dsh plugin remove` and with the package files gone, Standard was still in the mode list and a new session started; installing again turned the skill off again.
- **With dsh-modes**: the page said Mode Manager owns the settings; turning a skill off in PTC here wrote it to dsh-modes's `skills.json` and left this plugin's own settings unchanged.
- **Skill library, this plugin alone**: a new skill opened in the editor and was on only in the chosen modes; an edit saved a version first; two skills were imported from Codex and Claude Code, and the clashing one was not preselected; changing the Codex source marked **Source changed**, and importing again cleared it and kept the version from before; saving (with a note), viewing, restoring, and deleting versions worked.
- **Skill library, with dsh-modes**: creating, reading the file, saving a version, the import list, and importing from the page all went to `/api/dsh-modes`; the skill's details, versions, and import record were written to dsh-modes's data and not to this plugin's.
- **Everyday gaps**: each mode's catalog cost was shown and sorting by tokens worked; setting a skill to Manual in Standard removed it from Standard's catalog while Standard sessions' `/` menu still offered it, marked user-only; delete, Undo, and restoring from the trash worked; a SKILL.md with a colon in its description was listed as not loaded, and after saving the offered fix DSH loaded it; `~/.cursor/skills` was listed and an uploaded zip was imported. With dsh-modes installed, Manual was unavailable with its reason, and the rest worked as usual.
- **Management and GitHub**: a display name and tags saved and showed on the row; setting a skill to Model showed "Model only" for that mode in the registry's own listing; a new file in a skill folder saved and listed; text search found a skill by a word only its body had; a project folder added that project's skill, with its source and token cost; **Turn all off** for a mode, then Undo, restored every setting; a real repository (`anthropics/skills`) was read, three skills installed from it, a faked older install was found by **Check for updates**, and **Update all** replaced it. With dsh-modes installed, **Hand over to Mode Manager** moved an Off setting into Mode Manager's settings and cleared it here.
- **Store and usage**: searching skills.sh and opening a result read its repository with that skill alone selected; the recommended list showed. Through a local mock model, one session loaded a skill with the `skill` tool (Standard mode) and another started `/weekly-report` (PTC mode): **Usage** counted each once, under its own mode, from the real session logs.
- **What the model saw** (the requests the mock model received): in Standard, where one skill was Manual, one Off, and one Model-only, the catalog listed the Model-only skill and left out the other two; in PTC, where all were On, `/weekly-report` injected the skill's content; in Standard, where it is Model-only, the same line was left as plain text.
- Not yet checked: when a *running* session picks up a changed skill catalog. It uses the same mechanisms as dsh-modes (provider invalidation and the file watcher).

## License

MIT
