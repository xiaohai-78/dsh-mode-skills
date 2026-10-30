# Skill Manager

A DSH plugin page for every skill on the computer: turning it on or off per mode, editing and installing it, and choosing which agent tools can use it.

## Language

**Skill**:
Instructions for one kind of task, kept as a folder with a `SKILL.md`, that an agent loads when that task comes up.
_Avoid_: ability, prompt file

**Shared folder**:
The user skills folder that DSH and other agent tools read, `~/.agents/skills`.
_Avoid_: general folder, common folder

**Audience**:
Who can use a skill in the user's own folders: All agents or DSH only. The page labels it "Used by".
_Avoid_: scope (DSH's word for a mode's own set of plugins), sharing

**All agents**:
The audience of a skill kept as one copy in the shared folder, which DSH and every agent tool on the computer use.
_Avoid_: global, shared with other agent tools

**DSH only**:
The audience of a skill kept in DSH's own skills folder, `~/.dsh/skills`, which no other agent tool reads.
_Avoid_: private, local
