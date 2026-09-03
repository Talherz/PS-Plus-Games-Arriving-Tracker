🎯 **What:**
Fixed a Regular Expression Denial of Service (ReDoS) vulnerability in the `STRONG_REGEX` pattern.

⚠️ **Risk:**
The previous regex `/<strong[^>]*>([\s\S]*?)<\/strong>/gi` used the non-greedy modifier `[\s\S]*?`. With specific HTML input structure, this can cause catastrophic backtracking resulting in a denial of service. If an attacker controls or injects malformed content into the parsed RSS feeds, it could lock up the event loop and crash the application.

🛡️ **Solution:**
Updated the regex to use `/<strong[^>]*>([^<]*)<\/strong>/gi`. Using `[^<]*` prevents ReDoS by ensuring that the inner match will not cross over other tags, avoiding the catastrophic backtracking scenario. This preserves functionality for typical `<strong>` contents in the parsed feed without compromising performance.
