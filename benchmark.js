const fs = require('fs');

// We will copy the decodeHtmlEntities and extractGameList functions from index.js
function decodeHtmlEntities(text) {
  return String(text)
    .replace(/&#8211;/g, "-")
    .replace(/&#8212;/g, "-")
    .replace(/&#8217;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ");
}

function extractGameListOriginal(htmlBlock, fallbackTitle = "") {
  let extractedGames = [];

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
      if (gameString.length > 2 && !extractedGames.includes(gameString)) {
        extractedGames.push(gameString);
      }
    }
  }

  if (extractedGames.length === 0) {
    const listRegex = /<li>(.*?)<\/li>/g;
    let match;
    while ((match = listRegex.exec(decodedHtml)) !== null) {
      let rawText = match[1].replace(/<[^>]*>?/gm, "").trim();
      let gameString = isolateGameString(rawText);

      if (
        gameString.length > 2 &&
        gameString.length < 80 &&
        !String(gameString).toLowerCase().includes("last chance") &&
        !extractedGames.includes(gameString)
      ) {
        extractedGames.push(gameString);
      }
    }
  }

  if (extractedGames.length === 0 && fallbackTitle.includes(":")) {
    let cleanTitle = decodeHtmlEntities(fallbackTitle);
    let titleString = cleanTitle
      .split(":")[1]
      .replace(/and more/i, "")
      .trim();
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

function extractGameListOptimized(htmlBlock, fallbackTitle = "") {
  let extractedGames = [];
  let seenGames = new Set(); // Using Set for O(1) lookup

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
      if (gameString.length > 2 && !seenGames.has(gameString)) {
        seenGames.add(gameString);
        extractedGames.push(gameString);
      }
    }
  }

  if (extractedGames.length === 0) {
    const listRegex = /<li>(.*?)<\/li>/g;
    let match;
    while ((match = listRegex.exec(decodedHtml)) !== null) {
      let rawText = match[1].replace(/<[^>]*>?/gm, "").trim();
      let gameString = isolateGameString(rawText);

      if (
        gameString.length > 2 &&
        gameString.length < 80 &&
        !String(gameString).toLowerCase().includes("last chance") &&
        !seenGames.has(gameString)
      ) {
        seenGames.add(gameString);
        extractedGames.push(gameString);
      }
    }
  }

  if (extractedGames.length === 0 && fallbackTitle.includes(":")) {
    let cleanTitle = decodeHtmlEntities(fallbackTitle);
    let titleString = cleanTitle
      .split(":")[1]
      .replace(/and more/i, "")
      .trim();
    let rawGames = titleString.split(/,(?![^()]*\))|\s+and\s+/i);
    for (let i = 0; i < rawGames.length; i++) {
      let gameName = rawGames[i].trim();
      if (gameName.length > 2 && !seenGames.has(gameName)) {
        seenGames.add(gameName);
        extractedGames.push(gameName);
      }
    }
  }

  return extractedGames;
}


// Generate some fake HTML data to parse
let fakeHtml = "";
for (let i = 0; i < 5000; i++) {
    fakeHtml += `<p>Game Title ${i % 100} | PS4</p>\n`;
}

function runBenchmark(fn, name) {
    const start = performance.now();
    let result;
    for (let i = 0; i < 1000; i++) {
        result = fn(fakeHtml, "Monthly games: Game A, Game B");
    }
    const end = performance.now();
    console.log(`${name} took ${end - start} ms`);
    return end - start;
}

const originalTime = runBenchmark(extractGameListOriginal, "Original");
const optimizedTime = runBenchmark(extractGameListOptimized, "Optimized");

console.log(`Performance improvement: ${((originalTime - optimizedTime) / originalTime * 100).toFixed(2)}%`);
