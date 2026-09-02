🧪 [testing improvement] Add tests for parseBlogContent

🎯 **What:**
The `parseBlogContent` function was entirely missing test coverage in `index.js`. This function processes blog post objects based on their `type` ("Catalog" or "Essential"), formats the text via delegated parser functions, and extracts an image URL from the `src` attribute.

📊 **Coverage:**
A new test suite (`describe("parseBlogContent", ...`) was added to `index.test.js`. The suite fully exercises `parseBlogContent`:
- Ensures "Catalog" posts call the correct underlying logic and extracts `imageUrl` correctly.
- Ensures "Essential" posts call the correct underlying logic and extracts `imageUrl` correctly.
- Asserts that it correctly handles input without an image, safely returning an empty string.
- Confirms it successfully limits image extraction to supported types (jpg, png, jpeg, webp) and correctly skips things like .gif.
- Tests invalid URLs being skipped gracefully.

✨ **Result:**
Test coverage and codebase reliability has successfully been increased for the main execution pipeline functions!
