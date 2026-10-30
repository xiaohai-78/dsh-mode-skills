# GitHub installs come from codeload archives

A skill is installed from GitHub by downloading the repository's source archive from `codeload.github.com`, which needs no account, token, or API quota; the commit comes from the archive's comment. An update check downloads the archive again and compares each installed skill folder's content fingerprint with the one recorded at install, so a commit that leaves a skill's folder alone is not an update for it.

## Consequences

- Only public repositories can be installed.
- A check downloads the whole archive (at most 60 MB) even when only one skill comes from that repository.
