const fs = require("fs");
const fsPromises = require("fs").promises;
const { XMLParser } = require("fast-xml-parser");

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const ROLE_ID = process.env.DISCORD_ROLE_ID;
const MENTION_TEXT = ROLE_ID ? `<@&${ROLE_ID}>` : "@everyone";
const PREMIUM_SEARCH_OFFSET = 800;
const STRONG_REGEX = /<strong[^>]*>([\s\S]*?)<\/strong>/gi;
const PREMIUM_REGEX = /Premium/i;
const LI_TAG_REGEX = /<li>(.*?)<\/li>/g;
const BLOCK_TAGS_REGEX = /<\/?(p|br|li|h[1-6]|div)[^>]*>/gi;
const HTML_TAGS_REGEX = /<[^>]*>?/gm;

function isValidWebhookUrl(url) {
  if (!url) return false;
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:") return false;
    if (
      parsedUrl.hostname !== "discord.com" &&
      parsedUrl.hostname !== "discordapp.com"
    ) {
      return false;
    }

    // Strict regex check to prevent path traversal via encoded characters like ..%2f
    const decodedPath = decodeURIComponent(parsedUrl.pathname);
    return /^\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(decodedPath);
  } catch (e) {
    return false;
  }
}

if (require.main === module) {
  if (!WEBHOOK_URL) {
    console.error(
      "FATAL ERROR: No Discord Webhook URL provided in environment variables.",
    );
    process.exit(1);
  }
  if (!isValidWebhookUrl(WEBHOOK_URL)) {
    console.error(
      "FATAL ERROR: The provided Discord Webhook URL is invalid. It must start with https://discord.com/api/webhooks/ or https://discordapp.com/api/webhooks/",
    );
    process.exit(1);
  }
}

const STATE_FILE = "saved_state.json";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readStream(response, maxSize, timeoutId) {
  let size = 0;
  const decoder = new TextDecoder("utf-8");
  const chunks = [];
  try {
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > maxSize) {
        throw new Error("Response body exceeds size limit");
      }
      chunks.push(decoder.decode(chunk, { stream: true }));
    }
    chunks.push(decoder.decode());
    return chunks.join("");
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`Aborting: Error reading stream - ${error.message}`);
    return null;
  }
}

function parseRssXml(xmlData) {
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
    return null;
  }
  return Array.isArray(items) ? items : [items];
}

async function fetchPlayStationBlogFeed(etag = null) {
  const rssUrl = `https://blog.playstation.com/feed/`;

  console.log("Fetching native RSS directly from PlayStation...");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const headers = {};
  if (etag) {
    headers["If-None-Match"] = etag;
  }

  const response = await fetch(rssUrl, {
    headers,
    signal: controller.signal,
  });

  if (response.status === 304) {
    clearTimeout(timeoutId);
    console.log("No new updates (304 Not Modified).");
    return { itemList: [], newEtag: etag };
  }

  if (!response.ok) {
    clearTimeout(timeoutId);
    console.error(`Aborting: PS Blog returned error ${response.status}`);
    return null;
  }

  const newEtag = response.headers.get("etag");

  const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
  const contentLength = response.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_SIZE) {
    clearTimeout(timeoutId);
    console.error(`Aborting: Response size exceeds limit`);
    return null;
  }

  const xmlData = await readStream(response, MAX_SIZE, timeoutId);
  if (!xmlData) return null;

  clearTimeout(timeoutId);

  const itemList = parseRssXml(xmlData);
  if (!itemList) return null;

  console.log(`Successfully loaded ${itemList.length} posts natively.`);
  return { itemList, newEtag };
}

async function loadMemoryState() {
  let state = { LAST_ESSENTIAL_ID: "", LAST_CATALOG_ID: "", ETAG: "" };
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
  return state;
}

async function saveMemoryState(state) {
  const tempStateFile = `${STATE_FILE}.tmp`;
  await fsPromises.writeFile(tempStateFile, JSON.stringify(state, null, 2));
  await fsPromises.rename(tempStateFile, STATE_FILE);
  console.log("Memory state updated.");
}

async function checkOfficialPSPlusFeed() {
  try {
    let state = await loadMemoryState();

    const fetchResult = await fetchPlayStationBlogFeed(state.ETAG);
    if (!fetchResult) return;

    const { itemList, newEtag } = fetchResult;

    let stateChanged = false;

    if (newEtag && newEtag !== state.ETAG) {
      state.ETAG = newEtag;
      stateChanged = true;
    }

    if (itemList.length === 0) {
      // 304 Not Modified
      if (stateChanged) {
        await saveMemoryState(state);
      }
      return;
    }

    let foundEssential = false;
    let foundCatalog = false;

    for (let i = 0; i < itemList.length; i++) {
      const item = itemList[i];
      const titleLower = String(item.title).toLowerCase();
      let postId =
        item.guid && item.guid.text
          ? item.guid.text
          : typeof item.guid === "string"
            ? item.guid
            : item.link;

      // Essential Games
      if (
        !foundEssential &&
        titleLower.includes("playstation plus") &&
        titleLower.includes("monthly games")
      ) {
        foundEssential = true;
        if (postId !== state.LAST_ESSENTIAL_ID) {
          const post = {
            title: item.title,
            link: item.link,
            guid: postId,
            content: item["content:encoded"] || item.description || "",
          };
          const success = await processBlogContent(post, "Essential");
          if (success) {
            state.LAST_ESSENTIAL_ID = postId;
            stateChanged = true;
          }
        }
      }

      // Catalog Games
      if (
        !foundCatalog &&
        titleLower.includes("playstation plus") &&
        titleLower.includes("game catalog")
      ) {
        foundCatalog = true;
        if (postId !== state.LAST_CATALOG_ID) {
          const post = {
            title: item.title,
            link: item.link,
            guid: postId,
            content: item["content:encoded"] || item.description || "",
          };
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
      await saveMemoryState(state);
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

const HTML_ENTITIES = {
  "&#8211;": "-",
  "&#8212;": "-",
  "&#8217;": "'",
  "&amp;": "&",
  "&nbsp;": " ",
};
const HTML_ENTITY_REGEX = /&#8211;|&#8212;|&#8217;|&amp;|&nbsp;/g;

function decodeHtmlEntities(text) {
  const str = String(text);
  if (str.indexOf("&") === -1) return str;
  return str.replace(HTML_ENTITY_REGEX, (match) => HTML_ENTITIES[match]);
}

function isolateGameString(rawLine) {
  const matchIdx = rawLine.search(/\.\s/);
  let splitLine = (
    matchIdx !== -1 ? rawLine.slice(0, matchIdx) : rawLine
  ).trim();
  if (splitLine.endsWith(".")) splitLine = splitLine.slice(0, -1);
  return splitLine;
}

function extractGameList(htmlBlock, fallbackTitle = "") {
  let extractedGames = new Set();

  let decodedHtml = decodeHtmlEntities(htmlBlock);

  let textWithNewlines = decodedHtml.replace(BLOCK_TAGS_REGEX, "\n");
  let cleanText = textWithNewlines.replace(HTML_TAGS_REGEX, "");
  let lines = cleanText.split("\n");

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
    for (const match of decodedHtml.matchAll(LI_TAG_REGEX)) {
      let rawText = match[1].replace(HTML_TAGS_REGEX, "").trim();
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

    let parts = titleString.split(/,(?![^()]*\))|\s+and\s+/i);
    for (let i = 0; i < parts.length; i++) {
      let game = parts[i].trim();
      if (game.length > 2) {
        extractedGames.add(game);
      }
    }
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

function parseCatalogContent(postContentStr, postTitle) {
  let safeHtml = postContentStr.replace(
    /Extra (?:and|&) Premium/gi,
    "Extra_And_Prem",
  );

  let blocks = [safeHtml];
  let splitIndex = -1;

  const headingRegex = /<(h[1-4]|p)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  let headerMatchIndex = -1;
  let paragraphMatchIndex = -1;

  while ((match = headingRegex.exec(safeHtml)) !== null) {
    const tagName = match[1].toLowerCase();
    const innerHtml = match[2];

    if (!PREMIUM_REGEX.test(innerHtml)) continue;

    const textContent = innerHtml.replace(HTML_TAGS_REGEX, "");

    if (PREMIUM_REGEX.test(textContent)) {
      if (tagName.startsWith("h")) {
        // If we found a header, record it and break immediately
        headerMatchIndex = match.index;
        break;
      } else if (tagName === "p" && paragraphMatchIndex === -1) {
        // Check if Premium is in a strong tag, and only record the first occurrence
        STRONG_REGEX.lastIndex = 0;
        let strongMatch;
        let found = false;
        while ((strongMatch = STRONG_REGEX.exec(innerHtml)) !== null) {
          const strongText = strongMatch[1].replace(HTML_TAGS_REGEX, "");
          if (PREMIUM_REGEX.test(strongText)) {
            found = true;
            break;
          }
        }
        if (found) {
          paragraphMatchIndex = match.index;
        }
      }
    }
  }

  if (headerMatchIndex !== -1) {
    splitIndex = headerMatchIndex;
  } else if (paragraphMatchIndex !== -1) {
    splitIndex = paragraphMatchIndex;
  }

  if (splitIndex !== -1) {
    blocks = [
      safeHtml.substring(0, splitIndex),
      safeHtml.substring(splitIndex),
    ];
  } else {
    splitIndex = safeHtml.indexOf(
      "PlayStation Plus Premium",
      PREMIUM_SEARCH_OFFSET,
    );
    if (splitIndex === -1) {
      splitIndex = safeHtml.indexOf(
        "Premium | Classics",
        PREMIUM_SEARCH_OFFSET,
      );
    }
    if (splitIndex !== -1) {
      blocks = [
        safeHtml.substring(0, splitIndex),
        safeHtml.substring(splitIndex),
      ];
    }
  }

  let extraBlock = blocks[0] || "";
  let premiumBlock = blocks[1] || "";
  let extraGames = extractGameList(extraBlock, postTitle);
  let premiumGames = extractGameList(premiumBlock, "");

  let messageContent = `${MENTION_TEXT} 🌟 **New PS Plus Game Catalog Update!**\n\n`;
  messageContent += `🟦 **EXTRA:**\n${formatListText(extraGames)}\n`;

  if (premiumGames.length > 0) {
    messageContent += `🟪 **PREMIUM:**\n${formatListText(premiumGames)}`;
  }

  return {
    embedColor: 3447003,
    messageContent,
    tierText: "Click the blog link below to see platform details (PS4/PS5).",
  };
}

function parseEssentialContent(postContentStr, postTitle) {
  let essentialGames = extractGameList(postContentStr, postTitle);
  let messageContent = `${MENTION_TEXT} 🚨 **New PS Plus Essential Games Announced!**\n\n`;
  messageContent += `🟨 **MONTHLY GAMES:**\n${formatListText(essentialGames)}`;

  return {
    embedColor: 16766720,
    messageContent,
    tierText: "Click the blog link for full details.",
  };
}

function parseBlogContent(post, type) {
  const postContentStr = String(post.content);

  let parsedData;
  if (type === "Catalog") {
    parsedData = parseCatalogContent(postContentStr, post.title);
  } else {
    parsedData = parseEssentialContent(postContentStr, post.title);
  }

  let imageUrl = "";
  const imgMatch = postContentStr.match(
    /src="(https:\/\/[^"]+\.(?:jpg|png|jpeg|webp)[^"]*)"/i,
  );
  if (imgMatch) imageUrl = imgMatch[1];

  return { ...parsedData, imageUrl };
}

function formatDiscordMessage(post, parsedContent) {
  const { messageContent, embedColor, tierText, imageUrl } = parsedContent;

  const embedData = {
    title: decodeHtmlEntities(post.title),
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
    allowed_mentions: ROLE_ID ? { roles: [ROLE_ID] } : { parse: [] },
  };

  return payload;
}

async function sendWebhookRequest(payload) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: "error",
    });
    return { res, error: null };
  } catch (error) {
    return { res: null, error };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function executeWebhookWithRetry(payload, title) {
  console.log(`Attempting to send alert to Discord for: ${title}`);

  for (let attempt = 1; attempt <= 3; attempt++) {
    const { res, error } = await sendWebhookRequest(payload);

    if (error) {
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

async function processBlogContent(post, type) {
  const parsedContent = parseBlogContent(post, type);
  const payload = formatDiscordMessage(post, parsedContent);
  return await executeWebhookWithRetry(payload, post.title);
}

if (require.main === module) {
  checkOfficialPSPlusFeed();
}

module.exports = {
  readStream,
  decodeHtmlEntities,
  formatListText,
  extractGameList,
  isValidWebhookUrl,
  checkOfficialPSPlusFeed,
  processBlogContent,
  parseRssXml,
  loadMemoryState,
  saveMemoryState,
};
