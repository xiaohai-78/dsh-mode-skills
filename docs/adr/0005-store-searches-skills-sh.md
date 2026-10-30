# The store searches skills.sh

The store searches skills.sh, the public directory the `skills` CLI uses, with the same request that CLI makes, which needs no account, and adds a short list of well-known repositories that ships with the plugin. A result is installed through the GitHub flow, so nothing is copied until the user picks skills in that repository.

## Consequences

- The search text is sent to skills.sh.
- Results whose source is not a GitHub repository are left out.
