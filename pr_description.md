# 🔒 Fix ReDoS vulnerability in heading regex

🎯 **What:** The vulnerability fixed
The `headingRegex` in `parseCatalogContent` was susceptible to Regular Expression Denial of Service (ReDoS) due to catastrophic backtracking when handling unclosed tags or exceptionally large content inputs. The vulnerable regex used `[\s\S]*?` which can cause the regex engine to explore exponentially many paths.

⚠️ **Risk:** The potential impact if left unfixed
An attacker (or simply malformed content from the RSS feed) could cause the script to consume excessive CPU, leading to slow processing times or completely crashing the Node process due to a timeout/out-of-memory.

🛡️ **Solution:** How the fix addresses the vulnerability
Instead of capturing the inner HTML with a regex group across an arbitrary length, we now use a simpler regex `/<(h[1-4]|p)(?:\s[^>]*)?>/gi` to match only the opening tag. We then use string methods (`indexOf` and `substring`) to find the corresponding closing tag and extract the inner content. This mitigates the ReDoS entirely by avoiding regex backtracking on large blocks of text, while maintaining the same robust parsing capabilities.
