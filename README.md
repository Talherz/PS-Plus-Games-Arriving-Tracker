# PlayStation-Plus-Blog-Monitor

**📖 Overview**

A lightweight, robust Google Apps Script that automatically monitors the official PlayStation Blog for new PS Plus Game Catalog and Monthly Games announcements.
When a new article drops, the script parses the unstructured text, separates the games by their respective tiers (Essential, Extra, Premium), and delivers a cleanly formatted alert directly to your Discord server via Webhook.

**✨ Features**

- Native XML Parsing: Reads the raw RSS XML directly from PlayStation's servers, avoiding third-party proxy rate limits.
- Cache Busting: Uses timestamp parameters to force Google's execution servers to fetch live data instead of stale, cached versions.
- Dynamic Data Extraction: Employs multi-strategy text isolation to dynamically separate game lists, ensuring the script keeps working even when PR formatting changes from bullet points to raw text.
- Discord Rate Limit Handling: Includes a built-in retry loop that intercepts Discord 429 rate limits, forcing the script to sleep and retry, or gracefully aborting if the timeout exceeds Google's system limits.
- Concurrency Locks: Uses LockService to prevent overlapping cloud executions from causing duplicate webhook deliveries.

**🚀 Deployment Setup**

Create a new project at script.google.com.
Copy the contents of checkOfficialPSPlusFeed.js into your project.
Replace "YOUR_DISCORD_WEBHOOK_URL_HERE" on line 19 with your actual Discord Webhook URL.
Go to the Triggers menu (the alarm clock icon) and set a Time-Driven trigger to run the checkOfficialPSPlusFeed function hourly.

**🤝 Contributing**

Contributions, issues, and feature requests are welcome! If you have ideas for improving the text extraction logic or adding support for different regions, feel free to open an issue or submit a pull request.
