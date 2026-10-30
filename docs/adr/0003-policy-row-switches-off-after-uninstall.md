# The policy row switches itself off after an uninstall

A mode with skills turned off gets this plugin's row in its profile override, and DSH rejects a whole mode when one of its rows cannot be loaded. The row is therefore saved with a `disabled` condition that is true once `dsh-mode-skills` no longer resolves, so an uninstall leaves the row switched off and the mode working. When the check cannot tell, the row stays on.
