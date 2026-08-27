# 🧹 Refactor parseCatalogContent for improved maintainability

## 🎯 What
The `parseCatalogContent` function in `index.js` was overly long and complex, handling both DOM-like parsing via regex and Discord message formatting within a single function. This PR splits the function into three distinct responsibilities:
1. `splitCatalogBlocks(safeHtml)`: Handles the regex-based DOM splitting logic to isolate the Extra and Premium blocks.
2. `formatCatalogMessage(extraGames, premiumGames)`: Handles constructing the Discord message content and final payload.
3. `parseCatalogContent`: Acts as an orchestrator, stringing together string replacement, block splitting, game extraction, and message formatting.

## 💡 Why
Splitting this long function into smaller, focused functions improves readability and maintainability. It adheres to the Single Responsibility Principle, making it easier to test or modify the parsing logic separately from the formatting logic in the future.

## ✅ Verification
- Ensured `npm test` passes successfully.
- Verified test coverage with `jest --coverage`.
- Formatted the codebase using `npx prettier --write index.js`.

## ✨ Result
The complexity of `parseCatalogContent` has been significantly reduced, making the codebase cleaner and easier to maintain without changing any of the underlying logic or behavior.
