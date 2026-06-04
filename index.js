const fs = require('fs');
const { XMLParser } = require('fast-xml-parser');

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

if (!WEBHOOK_URL) {
  console.error("FATAL ERROR: No Discord Webhook URL provided in environment variables.");
  process.exit(1);
}

const STATE_FILE = 'saved_state.json';
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function checkOfficialPSPlusFeed() {
  try {
    const cacheBuster = Date.now();
    const rssUrl = `https://blog.playstation.com/category/ps-plus/feed/?cb=${cacheBuster}`;

    console.log("Fetching native RSS directly from PlayStation...");
    const response = await fetch(rssUrl);

    if (!response.ok) {
      console.error(`Aborting: PS Blog returned error ${response.status}`);
      return;
    }

    const xmlData = await response.text();
    const parser = new XMLParser({
      ignoreAttributes: false,
      textNodeName: "text"
    });

    const xmlDoc = parser.parse(xmlData);
    const items = xmlDoc.rss.channel.item;
    const itemList = Array.isArray(items) ? items : [items];

    let posts = [];
    for (let i = 0; i < itemList.length; i++) {
      let item = itemList[i];
      let guidStr = (item.guid && item.guid.text) ? item.guid.text : (typeof item.guid === 'string' ? item.guid : item.link);
      posts.push({
        title: item.title,
        link: item.link,
        guid: guidStr,
        content: item['content:encoded'] || item.description || ""
      });
    }

    console.log(`Successfully loaded ${posts.length} posts natively.`);

    // Load Memory State
    let state = { LAST_ESSENTIAL_ID: "", LAST_CATALOG_ID: "" };
    if (fs.existsSync(STATE_FILE)) {
      state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
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
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
      console.log("Memory state updated.");
    } else {
      console.log("No new posts detected or updates required. State unchanged.");
    }

  } catch (error) {
    console.error("Execution error: ", error);
    process.exit(1);
  }
}

function decodeHtmlEntities(text) {
  return String(text)
    .replace(/&#8211;/g, '-')
    .replace(/&#8212;/g, '-')
    .replace(/&#8217;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');
}

function extractGameList(htmlBlock, fallbackTitle = "") {
  let extractedGames = [];

  let decodedHtml = decodeHtmlEntities(htmlBlock);

  let textWithNewlines = decodedHtml.replace(/<\/?(p|br|li|h[1-6]|div)[^>]*>/gi, '\n');
  let cleanText = textWithNewlines.replace(/<[^>]*>?/gm, '');
  let lines = cleanText.split('\n');

  function isolateGameString(rawLine) {
    let splitLine = rawLine.split(/\.\s/)[0].trim();
    if (splitLine.endsWith('.')) splitLine = splitLine.slice(0, -1);
    return splitLine;
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (line.includes("| PS") || line.includes("|PS")) {
      let gameString = isolateGameString(line);
      if (gameString.length > 2 && !extractedGames.includes(gameString)) {
        extractedGames.push(gameString);
      }
    }
  }

  if (extractedGames.length === 0) {
    const listRegex = /<li>(.*?)<\/li>/g;
    let match;
    while ((match = listRegex.exec(decodedHtml)) !== null) {
      let rawText = match[1].replace(/<[^>]*>?/gm, '').trim();
      let gameString = isolateGameString(rawText);

      if (gameString.length > 2 && gameString.length < 80 && !String(gameString).toLowerCase().includes("last chance") && !extractedGames.includes(gameString)) {
        extractedGames.push(gameString);
      }
    }
  }

  if (extractedGames.length === 0 && fallbackTitle.includes(":")) {
    let cleanTitle = decodeHtmlEntities(fallbackTitle);
    let titleString = cleanTitle.split(":")[1].replace(/and more/i, "").trim();
    let rawGames = titleString.split(/,(?![^()]*\))|\s+and\s+/i);
    for (let i = 0; i < rawGames.length; i++) {
      let gameName = rawGames[i].trim();
      if (gameName.length > 2 && !extractedGames.includes(gameName)) {
        extractedGames.push(gameName);
      }
    }
  }

  return extractedGames;
}

function formatListText(gameArray) {
  if (gameArray.length === 0) return "> *None detected or formatting changed.*\n";
  let listText = "";
  for (let i = 0; i < gameArray.length; i++) {
    let gameStr = gameArray[i];
    // Split the game string if it contains a pipe to separate the title from the console tags
    if (gameStr.includes("|")) {
      let splitIndex = gameStr.indexOf("|");
      let title = gameStr.substring(0, splitIndex).trim();
      let consoles = gameStr.substring(splitIndex).trim();
      listText += (i + 1) + ". **" + title + "** " + consoles + "\n";
    } else {
      listText += (i + 1) + ". **" + gameStr + "**\n";
    }
  }
  return listText;
}

async function processBlogContent(post, type) {
  let embedColor = 0;
  let messageContent = "";
  let tierText = "";

  if (type === "Catalog") {
    embedColor = 3447003;
    let safeHtml = post.content.replace(/Extra and Premium/ig, "Extra_And_Premium");
    safeHtml = safeHtml.replace(/Extra & Premium/ig, "Extra_And_Premium");

    let blocks = safeHtml.split(/<h[1-4][^>]*>[^<]*Premium[^<]*<\/h[1-4]>/i);
    if (blocks.length === 1) {
      blocks = safeHtml.split(/<p>\s*<strong>[^<]*Premium[^<]*<\/strong>\s*<\/p>/i);
    }

    if (blocks.length === 1) {
      let splitIndex = safeHtml.indexOf("PlayStation Plus Premium", 800);
      if (splitIndex === -1) splitIndex = safeHtml.indexOf("Premium | Classics", 800);
      if (splitIndex !== -1) {
        blocks = [safeHtml.substring(0, splitIndex), safeHtml.substring(splitIndex)];
      }
    }

    let extraBlock = blocks[0] || "";
    let premiumBlock = blocks[1] || "";
    let extraGames = extractGameList(extraBlock, post.title);
    let premiumGames = extractGameList(premiumBlock, "");

    messageContent = "@everyone 🌟 **New PS Plus Game Catalog Update!**\n\n";
    messageContent += "🟦 **EXTRA:**\n" + formatListText(extraGames) + "\n";

    if (premiumGames.length > 0) {
      messageContent += "🟪 **PREMIUM:**\n" + formatListText(premiumGames);
    }
    tierText = "Click the blog link below to see platform details (PS4/PS5).";
  } else {
    embedColor = 16766720;
    let essentialGames = extractGameList(post.content, post.title);
    messageContent = "@everyone 🚨 **New PS Plus Essential Games Announced!**\n\n";
    messageContent += "🟨 **MONTHLY GAMES:**\n" + formatListText(essentialGames);
    tierText = "Click the blog link for full details.";
  }

  let imageUrl = "";
  const imgMatch = post.content.match(/src="(https:\/\/[^"]+\.(?:jpg|png|jpeg|webp)[^"]*)"/i);
  if (imgMatch) imageUrl = imgMatch[1];

  const embedData = {
    "title": post.title,
    "url": post.link,
    "description": tierText,
    "color": embedColor,
    "footer": { "text": "Official PlayStation Blog Auto-Parse" },
    "timestamp": new Date().toISOString()
  };

  if (imageUrl) {
    embedData.image = { "url": imageUrl };
  }

  const payload = {
    "username": "Talherz Waifu",
    "content": messageContent,
    "embeds": [embedData]
  };

  console.log(`Attempting to send alert to Discord for: ${post.title}`);

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      console.log("✅ SUCCESS! Discord accepted the message.");
      return true;
    }

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After") || 2);
      if (retryAfter > 250) {
        console.error(`❌ Discord rate limit is too long (${retryAfter}s). Aborting attempt.`);
        return false;
      }
      console.warn(`⚠️ Rate limited. Retry after ${retryAfter}s (attempt ${attempt}/3)`);
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

checkOfficialPSPlusFeed();
