# 🧪 Test `parseCatalogContent` Improvement

🎯 **What:**
Added dedicated tests for the \`parseCatalogContent\` function in \`index.js\`. This function performs complex parsing of HTML from PlayStation blog content to categorize game titles into "Extra" and "Premium" lists based on varying headers and tags.

📊 **Coverage:**
The new test suite covers:
- Posts containing both Extra and Premium games correctly identified via header tags.
- Posts featuring only Extra games.
- Posts providing only Premium games (including edge cases around formatted text rendering correctly when empty sections exist).
- Edge cases in blog layouts where `<p>` and `<strong>` tags are used to denote the Premium section rather than a header element.
- The regex match fallback logic to ensure parsing remains robust when headers are non-standard.

✨ **Result:**
Significant increase in test coverage and confidence in the extraction logic. We can now safely refactor the scraping mechanism of the blog knowing the tier sorting correctly accounts for PlayStation's varying blog formatting style.
