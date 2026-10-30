# Mode Manager owns the data both plugins can change

dsh-modes and this plugin can both turn skills on or off per mode, create and import skills, and keep versions. While dsh-modes is installed it owns all of that: this plugin's library and setting actions refuse with `managed-by-modes`, the page sends the same requests, under the same names, to dsh-modes, and this plugin's own policy row lists nothing. Two stores of the same settings would disagree; with one owner both pages show the same data, and either plugin still works alone.
