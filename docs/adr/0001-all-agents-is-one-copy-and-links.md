# All agents is one copy and links, not copies

A skill for all agents is kept as one copy in the shared folder, which DSH and the tools that read that folder use as it is. Every other installed agent tool gets a link to that copy in its own skills folder (a directory junction on Windows, which needs no administrator rights). Copies would drift apart as soon as one tool's copy is edited, and this is the layout `npx skills add -g` makes, so the two understand each other's installs.

## Consequences

- A tool's own skill with the same name but different files is never replaced; an identical copy becomes a link, and the copy goes to the bin.
- DSH only, and deleting a skill, remove only links that lead to that skill; a folder or file is never removed from another tool's folder.
