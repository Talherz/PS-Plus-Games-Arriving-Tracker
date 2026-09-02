# 🧪 Add tests for formatDiscordMessage

🎯 **What:** The testing gap addressed
The `formatDiscordMessage` function in `index.js` was previously untested. It is a pure function that maps input objects to a structured payload. This function was exported in `index.js` and tests were added for it in `index.test.js`.

📊 **Coverage:** What scenarios are now tested
- Formatting a Discord message with all provided data.
- Formatting a Discord message correctly when the `DISCORD_ROLE_ID` environment variable is set.
- Ensuring that HTML entities in the post title are properly decoded (e.g., `&amp;` to `&`).

✨ **Result:** The improvement in test coverage
The codebase's test suite now covers `formatDiscordMessage` functionality, ensuring accurate generation of the Discord webhook payload. This improves the overall stability of the service and minimizes regressions.
