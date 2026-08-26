Title: 🧪 Test missing `parseRssXml` functionality and invalid XML structures

Description:
🎯 **What:** The `parseRssXml` function in `index.js` lacked any direct unit test coverage, and its failure path for invalid XML was untested.
📊 **Coverage:** Added test suite for `parseRssXml` with valid single, valid multiple, and invalid structures using assertions and console spying. Exported `parseRssXml` from `index.js` to facilitate testing.
✨ **Result:** Improved test coverage and reliability for XML parsing logic.
