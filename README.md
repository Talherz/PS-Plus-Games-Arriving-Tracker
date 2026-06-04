# 🌟 PS Plus Game Arrivals Tracker

An automated, serverless Node.js bot that natively parses the Official PlayStation Blog RSS feed to detect new "Monthly Essential" and "Game Catalog" announcements, extracts the specific games using regex strategies, and delivers formatted lists directly to a Discord server.

Built securely on **GitHub Actions**, this script utilizes GitHub Secrets for environment variables and relies on an internal JSON state tracker to ensure announcements are only posted once.

## ✨ Features

- **Native RSS Parsing:** Uses `fast-xml-parser` to read the official PlayStation feed instantly.
- **Smart HTML Extraction:** Employs a multi-tiered regex algorithm (Pipe markers -> Bullet point checks -> Title fallback) to accurately scrape game names out of unstructured blog paragraphs.
- **Tier Sorting:** Automatically isolates and categorizes "Extra" vs "Premium" tier additions.
- **Rate Limit Protection:** Features an automated sleep-and-retry loop to handle Discord API 429 rate limit rejections gracefully.
- **Secure Architecture:** Uses GitHub Secrets to inject Webhook URLs at runtime, keeping all server credentials entirely hidden from the codebase.

## 🚀 How to Setup Your Own Tracker

1. **Fork the Repository:** Click "Fork" at the top right to copy this project.
2. **Create a Discord Webhook:**
   - Go to your Discord Server Settings > Integrations > Webhooks.
   - Create a new Webhook and copy the URL.
3. **Configure GitHub Secrets:**
   - In your forked repository, go to **Settings** > **Secrets and variables** > **Actions**.
   - Add a new repository secret named `DISCORD_WEBHOOK_URL` and paste your URL.
4. **Enable Actions:**
   - Go to the **Actions** tab.
   - Enable the workflows and manually trigger the "PS Plus Arrivals Tracker" to run your first check!

### 🔄 How to Force a Re-Post (Resetting Memory)

This bot uses the `saved_state.json` file as its memory to prevent spamming your Discord server with duplicate alerts. If you ever need to force the bot to re-post the latest announcements (for example, if you are testing a new channel or accidentally deleted a message), you just need to wipe its memory:

1. Open `saved_state.json` in your repository and click the edit (pencil) icon.
2. Clear out the saved links so the file looks exactly like this:
   ```json
   {
     "LAST_ESSENTIAL_ID": "",
     "LAST_CATALOG_ID": ""
   }
   ```
3. Commit the change, head over to the Actions tab, and manually run the workflow again!

## 🛠️ Built With

- **Node.js 24** - Runtime environment
- **fast-xml-parser** - XML feed extraction
- **GitHub Actions** - CI/CD pipeline and automated hourly chron job

## 🤝 Contributing

Contributions, issues, and feature requests are always welcome! If you have ideas on how to improve the code, optimize the sorting logic, or expand the embed formatting:

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.
