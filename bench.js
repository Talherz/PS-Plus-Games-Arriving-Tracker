const fs = require("fs");

// Pre-compute rawGames to isolate the loop optimization
let rawGames = [];
for (let i = 1; i <= 50000; i++) {
  rawGames.push(`Game ${i}`);
}

function originalExtract(rawGames) {
  let extractedGames = [];
  for (let i = 0; i < rawGames.length; i++) {
    let gameName = rawGames[i].trim();
    if (gameName.length > 2 && !extractedGames.includes(gameName)) {
      extractedGames.push(gameName);
    }
  }
  return extractedGames;
}

function optimizedExtract(rawGames) {
  let extractedGames = [];
  let extractedGamesSet = new Set(extractedGames);
  for (let i = 0; i < rawGames.length; i++) {
    let gameName = rawGames[i].trim();
    if (gameName.length > 2 && !extractedGamesSet.has(gameName)) {
      extractedGames.push(gameName);
      extractedGamesSet.add(gameName);
    }
  }
  return extractedGames;
}

const numIterations = 10;

console.time("Original");
for (let i = 0; i < numIterations; i++) {
  originalExtract(rawGames);
}
console.timeEnd("Original");

console.time("Optimized");
for (let i = 0; i < numIterations; i++) {
  optimizedExtract(rawGames);
}
console.timeEnd("Optimized");
