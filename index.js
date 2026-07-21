const fs = require("fs");
const fsPromises = require("fs").promises;
const { XMLParser } = require("fast-xml-parser");
const cheerio = require("cheerio");

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const PREMIUM_SEARCH_OFFSET = 800;

if (!WEBHOOK_URL && require.main === module) {
  console.error(
    "FATAL ERROR: No Discord Webhook URL provided in environment variables.",
  );
  process.exit(1);
}

const STATE_FILE = "saved_state.json";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function checkOfficialPSPlusFeed() {
  try {
    const cacheBuster = Date.now();
    const rssUrl = `https://blog.playstation.com/category/ps-plus/feed/?cb=${cacheBuster}`;

    console.log("Fetching native RSS directly from PlayStation...");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(rssUrl, { signal: controller.signal });

    if (!response.ok) {
      clearTimeout(timeoutId);
      console.error(`Aborting: PS Blog returned error ${response.status}`);
      return;
    }

    const xmlData = await response.text();
    clearTimeout(timeoutId);
    const parser = new XMLParser({
      ignoreAttributes: false,
      textNodeName: "text",
    });

    const xmlDoc = parser.parse(xmlData);
    const items = xmlDoc?.rss?.channel?.item;

    if (!items) {
      console.error(
        "Aborting: XML response does not contain valid RSS feed structure.",
      );
      return;
    }
    const itemList = Array.isArray(items) ? items : [items];

    let posts = [];
    for (let i = 0; i < itemList.length; i++) {
      let item = itemList[i];
      let guidStr =
        item.guid && item.guid.text
          ? item.guid.text
          : typeof item.guid === "string"
            ? item.guid
            : item.link;
      posts.push({
        title: item.title,
        link: item.link,
        guid: guidStr,
        content: item["content:encoded"] || item.description || "",
      });
    }

    console.log(`Successfully loaded ${posts.length} posts natively.`);

    // Load Memory State
    let state = { LAST_ESSENTIAL_ID: "", LAST_CATALOG_ID: "" };
    try {
      const data = await fsPromises.readFile(STATE_FILE, "utf8");
      state = JSON.parse(data);
    } catch (e) {
      if (e.code !== "ENOENT") {
        console.error(
          "Error parsing STATE_FILE, using default state:",
          e.message,
        );
      }
    }

    let foundEssential = false;
    let foundCatalog = false;
    let stateChanged = false;

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const titleLower = String(post.title).toLowerCase();
      const postId = post.guid;

      // Essential Games
      if (!foundEssential && titleLower.includes("monthly games for")) {
        foundEssential = true;
        if (postId !== state.LAST_ESSENTIAL_ID) {
          const success = await processBlogContent(post, "Essential");
          if (success) {
            state.LAST_ESSENTIAL_ID = postId;
            stateChanged = true;
          }
        }
      }

      // Catalog Games
      if (!foundCatalog && titleLower.includes("game catalog for")) {
        foundCatalog = true;
        if (postId !== state.LAST_CATALOG_ID) {
          const success = await processBlogContent(post, "Catalog");
          if (success) {
            state.LAST_CATALOG_ID = postId;
            stateChanged = true;
          }
        }
      }

      if (foundEssential && foundCatalog) break;
    }

    if (stateChanged) {
      const tempStateFile = `${STATE_FILE}.tmp`;
      await fsPromises.writeFile(tempStateFile, JSON.stringify(state, null, 2));
      await fsPromises.rename(tempStateFile, STATE_FILE);
      console.log("Memory state updated.");
    } else {
      console.log(
        "No new posts detected or updates required. State unchanged.",
      );
    }
  } catch (error) {
    if (error.name === "AbortError") {
      console.error("Execution error: Fetch request to PS Blog timed out.");
    } else {
      console.error("Execution error: ", error);
    }
    process.exit(1);
  }
}

function decodeHtmlEntities(text) {
  return String(text)
    .replace(/&#8211;/g, "-")
    .replace(/&#8212;/g, "-")
    .replace(/&#8217;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ");
}

function extractGameList(htmlBlock, fallbackTitle = "") {
  let extractedGames = new Set();

  let decodedHtml = decodeHtmlEntities(htmlBlock);

  let textWithNewlines = decodedHtml.replace(
    /<\/?(p|br|li|h[1-6]|div)[^>]*>/gi,
    "\n",
  );
  let cleanText = textWithNewlines.replace(/<[^>]*>?/gm, "");
  let lines = cleanText.split("\n");

  function isolateGameString(rawLine) {
    let splitLine = rawLine.split(/\.\s/)[0].trim();
    if (splitLine.endsWith(".")) splitLine = splitLine.slice(0, -1);
    return splitLine;
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (line.includes("| PS") || line.includes("|PS")) {
      let gameString = isolateGameString(line);
      if (gameString.length > 2) {
        extractedGames.add(gameString);
      }
    }
  }

  if (extractedGames.size === 0) {
    const listRegex = /<li>(.*?)<\/li>/g;
    let match;
    while ((match = listRegex.exec(decodedHtml)) !== null) {
      let rawText = match[1].replace(/<[^>]*>?/gm, "").trim();
      let gameString = isolateGameString(rawText);

      if (
        gameString.length > 2 &&
        gameString.length < 80 &&
        !String(gameString).toLowerCase().includes("last chance")
      ) {
        extractedGames.add(gameString);
      }
    }
  }

  if (extractedGames.size === 0 && fallbackTitle.includes(":")) {
    let cleanTitle = decodeHtmlEntities(fallbackTitle);
    let titleString = cleanTitle
      .split(":")[1]
      .replace(/and more/i, "")
      .trim();
    titleString
      .split(/,(?![^()]*\))|\s+and\s+/i)
      .map((game) => game.trim())
      .filter((game) => game.length > 2)
      .forEach((game) => extractedGames.add(game));
  }

  return Array.from(extractedGames);
}

function formatListText(gameArray) {
  if (gameArray.length === 0)
    return "> *None detected or formatting changed.*\n";
  let formattedLines = [];
  for (let i = 0; i < gameArray.length; i++) {
    let gameStr = gameArray[i];
    // Split the game string if it contains a pipe to separate the title from the console tags
    if (gameStr.includes("|")) {
      let splitIndex = gameStr.indexOf("|");
      let title = gameStr.substring(0, splitIndex).trim();
      let consoles = gameStr.substring(splitIndex).trim();
      formattedLines.push(`${i + 1}. **${title}** ${consoles}`);
    } else {
      formattedLines.push(`${i + 1}. **${gameStr}**`);
    }
  }
  return `${formattedLines.join("\n")}\n`;
}

async function processBlogContent(post, type) {
  let embedColor = 0;
  let messageContent = "";
  let tierText = "";

  const postContentStr = String(post.content);

  if (type === "Catalog") {
    embedColor = 3447003;
    let safeHtml = postContentStr.replace(
      /Extra and Premium/gi,
      "Extra_And_Premium",
    );
    safeHtml = safeHtml.replace(/Extra & Premium/gi, "Extra_And_Premium");

    let blocks = [safeHtml];
    const $ = cheerio.load(safeHtml, { sourceCodeLocationInfo: true });

    let premiumHeading = $("h1, h2, h3, h4")
      .filter((i, el) => /Premium/i.test($(el).text()))
      .first();

    if (premiumHeading.length === 0) {
      premiumHeading = $("p > strong")
        .filter((i, el) => /Premium/i.test($(el).text()))
        .first()
        .parent();
    }

    if (premiumHeading.length > 0) {
      const splitIndex = premiumHeading[0].startIndex;
      blocks = [
        safeHtml.substring(0, splitIndex),
        safeHtml.substring(splitIndex),
      ];
    } else {
      let splitIndex = safeHtml.indexOf(
        "PlayStation Plus Premium",
        PREMIUM_SEARCH_OFFSET,
      );
      if (splitIndex === -1)
        splitIndex = safeHtml.indexOf(
          "Premium | Classics",
          PREMIUM_SEARCH_OFFSET,
        );
      if (splitIndex !== -1) {
        blocks = [
          safeHtml.substring(0, splitIndex),
          safeHtml.substring(splitIndex),
        ];
      }
    }

    let extraBlock = blocks[0] || "";
    let premiumBlock = blocks[1] || "";
    let extraGames = extractGameList(extraBlock, post.title);
    let premiumGames = extractGameList(premiumBlock, "");

    messageContent = "@everyone 🌟 **New PS Plus Game Catalog Update!**\n\n";
    messageContent += `🟦 **EXTRA:**\n${formatListText(extraGames)}\n`;

    if (premiumGames.length > 0) {
      messageContent += `🟪 **PREMIUM:**\n${formatListText(premiumGames)}`;
    }
    tierText = "Click the blog link below to see platform details (PS4/PS5).";
  } else {
    embedColor = 16766720;
    let essentialGames = extractGameList(postContentStr, post.title);
    messageContent =
      "@everyone 🚨 **New PS Plus Essential Games Announced!**\n\n";
    messageContent += `🟨 **MONTHLY GAMES:**\n${formatListText(essentialGames)}`;
    tierText = "Click the blog link for full details.";
  }

  let imageUrl = "";
  const imgMatch = postContentStr.match(
    /src="(https:\/\/[^"]+\.(?:jpg|png|jpeg|webp)[^"]*)"/i,
  );
  if (imgMatch) imageUrl = imgMatch[1];

  const embedData = {
    title: post.title,
    url: post.link,
    description: tierText,
    color: embedColor,
    footer: { text: "Official PlayStation Blog Auto-Parse" },
    timestamp: new Date().toISOString(),
  };

  if (imageUrl) {
    embedData.image = { url: imageUrl };
  }

  const payload = {
    username: "Talherz Waifu",
    content: messageContent,
    embeds: [embedData],
    allowed_mentions: { parse: ["everyone"] },
  };

  console.log(`Attempting to send alert to Discord for: ${post.title}`);

  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let res;
    try {
      res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (error) {
      if (error.name === "AbortError") {
        console.warn(
          `⚠️ Discord webhook fetch timed out (attempt ${attempt}/3)`,
        );
      } else {
        console.warn(
          `⚠️ Discord webhook fetch error (attempt ${attempt}/3): ${error.message}`,
        );
      }
      if (attempt < 3) {
        await sleep(2000); // Wait a bit before retrying on network error/timeout
        continue;
      }
      return false;
    } finally {
      clearTimeout(timeoutId);
    }

    if (res.ok) {
      console.log("✅ SUCCESS! Discord accepted the message.");
      return true;
    }

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After") || 2);
      if (retryAfter > 250) {
        console.error(
          `❌ Discord rate limit is too long (${retryAfter}s). Aborting attempt.`,
        );
        return false;
      }
      console.warn(
        `⚠️ Rate limited. Retry after ${retryAfter}s (attempt ${attempt}/3)`,
      );
      await sleep(retryAfter * 1000);
      continue;
    }

    const errorText = await res.text();
    console.error(`❌ DISCORD REJECTED IT! Error code: ${res.status}`);
    console.error(`Reason: ${errorText}`);
    return false;
  }

  return false;
}

if (require.main === module) {
  checkOfficialPSPlusFeed();
}

module.exports = {
  decodeHtmlEntities,
  formatListText,
};
