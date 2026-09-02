🧪 [testing improvement: isolateGameString]

🎯 **What:** `isolateGameString` in `index.js` was previously missing tests entirely. This function manages text truncations related to dot-spaces and formatting the resulting games string.

📊 **Coverage:** The new tests in `index.test.js` cover:
- Strings without a dot-space (left unmodified)
- Strings truncated correctly at the first dot-space
- Strings properly trimmed of trailing and wrapping whitespaces, as well as a standalone trailing dot
- Handling for empty or whitespace-only strings

✨ **Result:** A standalone utility function `isolateGameString` now has proper test coverage to ensure stability and accuracy during refactoring.
