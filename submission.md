Title: "⚡ [Performance improvement description]"
Description: "💡 **What:** Hoisted regexes out of the main loop and extractGameList function into global constants.
🎯 **Why:** To prevent recompiling these regexes repeatedly inside loops, which adds unnecessary overhead.
📊 **Measured Improvement:** Execution time for 10,000 iterations over a large HTML string improved from ~6.78s to ~6.31s (~7% improvement)."
