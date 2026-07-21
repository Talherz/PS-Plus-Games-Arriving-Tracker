# 🌟 PS Plus Game Arrivals Tracker

A friendly, automated bot that checks the Official PlayStation Blog for new "Monthly Essential" and "Game Catalog" announcements. When new games are announced, it extracts the list of games and delivers a neatly formatted message directly to your Discord server!

This bot runs automatically using **GitHub Actions**, keeping your setup simple, free, and secure. It remembers what it has already posted, so your Discord server won't be spammed with duplicate messages.

## ✨ Features

- **Instant Updates:** Directly reads the official PlayStation feed to get the latest news as soon as it drops.
- **Smart Game Detection:** Automatically finds and extracts the names of the games from the blog posts.
- **Tier Sorting:** Neatly separates the games into "Essential", "Extra", and "Premium" categories so you know exactly what you're getting.
- **Reliable Delivery:** Carefully handles Discord's messaging limits to ensure your alerts always go through.
- **Secure Setup:** Uses GitHub Secrets to keep your Discord Webhook URLs completely hidden and safe.

## 🚀 How to Setup Your Own Tracker

1. **Fork the Repository:** Click "Fork" at the top right to copy this project into your own GitHub account.
2. **Create a Discord Webhook:**
   - In your Discord Server, go to **Server Settings** > **Integrations** > **Webhooks**.
   - Create a new Webhook and copy the URL.
3. **Configure GitHub Secrets:**
   - In your forked repository, go to **Settings** > **Secrets and variables** > **Actions**.
   - Click **New repository secret**.
   - Name the secret `DISCORD_WEBHOOK_URL` and paste your Webhook URL into the value field.
4. **Enable Actions:**
   - Go to the **Actions** tab in your repository.
   - Enable the workflows, and manually trigger the "PS Plus Arrivals Tracker" to run your first check! The bot will now run automatically on a schedule.

### 🔄 How to Force a Re-Post (Resetting Memory)

This bot uses a file called `saved_state.json` as its memory to prevent sending duplicate alerts. If you ever need to force the bot to re-post the latest announcements (for example, if you are testing a new channel or accidentally deleted a message), you just need to wipe its memory:

1. Open `saved_state.json` in your repository and click the edit (pencil) icon.
2. Clear out the saved links so the file looks exactly like this:
   ```json
   {
     "LAST_ESSENTIAL_ID": "",
     "LAST_CATALOG_ID": ""
   }
   ```
3. Commit the change, head over to the Actions tab, and manually run the workflow again!

## 💻 Local Development

If you want to run the bot on your own computer or test out changes to the code, follow these steps:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/ps-plus-tracker.git
   cd ps-plus-tracker
   ```

2. **Install dependencies:**
   Make sure you have [Node.js](https://nodejs.org/) installed (version 18 or higher is required). Then run:
   ```bash
   npm install
   ```

3. **Set your Webhook URL:**
   You will need a Discord Webhook URL for testing. Run the script with the webhook passed as an environment variable:
   ```bash
   DISCORD_WEBHOOK_URL="your_discord_webhook_url_here" node index.js
   ```

4. **Running Tests:**
   The project uses Jest for testing. You can run the test suite using:
   ```bash
   npm test
   ```

5. **Code Formatting:**
   The project uses Prettier for formatting. If you make changes to the code, please format them before committing:
   ```bash
   npx prettier --write index.js
   ```

## 🤝 Contributing

Contributions, issues, and feature requests are always welcome! If you have ideas on how to improve the bot or add new features:

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.
