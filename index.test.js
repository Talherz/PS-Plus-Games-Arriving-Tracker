const fsPromises = require("fs").promises;
const {
  decodeHtmlEntities,
  formatListText,
  extractGameList,
  isValidWebhookUrl,
  checkOfficialPSPlusFeed,
} = require("./index");

describe("isValidWebhookUrl", () => {
  it("should return true for valid discord.com webhook URLs", () => {
    expect(isValidWebhookUrl("https://discord.com/api/webhooks/123/abc")).toBe(
      true,
    );
  });

  it("should return true for valid discordapp.com webhook URLs", () => {
    expect(
      isValidWebhookUrl("https://discordapp.com/api/webhooks/123/abc"),
    ).toBe(true);
  });

  it("should return false for invalid URLs", () => {
    expect(isValidWebhookUrl("https://evil.com/api/webhooks/123/abc")).toBe(
      false,
    );
    expect(isValidWebhookUrl("http://discord.com/api/webhooks/123/abc")).toBe(
      false,
    );
    expect(isValidWebhookUrl("https://discord.com/api/other/123/abc")).toBe(
      false,
    );
    expect(isValidWebhookUrl("discord.com/api/webhooks/123/abc")).toBe(false);
  });

  it("should return false for empty or null inputs", () => {
    expect(isValidWebhookUrl("")).toBe(false);
    expect(isValidWebhookUrl(null)).toBe(false);
    expect(isValidWebhookUrl(undefined)).toBe(false);
  });
});

describe("decodeHtmlEntities", () => {
  it("should replace &#8211; with a hyphen", () => {
    expect(decodeHtmlEntities("word&#8211;word")).toBe("word-word");
  });

  it("should replace &#8212; with a hyphen", () => {
    expect(decodeHtmlEntities("word&#8212;word")).toBe("word-word");
  });

  it("should replace &#8217; with a single quote", () => {
    expect(decodeHtmlEntities("it&#8217;s")).toBe("it's");
  });

  it("should replace &amp; with an ampersand", () => {
    expect(decodeHtmlEntities("black &amp; white")).toBe("black & white");
  });

  it("should replace &nbsp; with a space", () => {
    expect(decodeHtmlEntities("word&nbsp;word")).toBe("word word");
  });

  it("should handle multiple entities in a single string", () => {
    expect(
      decodeHtmlEntities(
        "it&#8217;s black &amp; white&#8212;mostly&nbsp;black",
      ),
    ).toBe("it's black & white-mostly black");
  });

  it("should return the same string if no entities are present", () => {
    expect(decodeHtmlEntities("normal text")).toBe("normal text");
  });

  it("should handle an empty string", () => {
    expect(decodeHtmlEntities("")).toBe("");
  });

  it("should handle non-string inputs by converting them to a string", () => {
    expect(decodeHtmlEntities(123)).toBe("123");
    expect(decodeHtmlEntities(null)).toBe("null");
    expect(decodeHtmlEntities(undefined)).toBe("undefined");
  });
});

describe("formatListText", () => {
  it("should return a specific message for an empty array", () => {
    expect(formatListText([])).toBe(
      "> *None detected or formatting changed.*\n",
    );
  });

  it("should format an array of games without pipes", () => {
    const games = ["Game 1", "Game 2"];
    const expected = "1. **Game 1**\n2. **Game 2**\n";
    expect(formatListText(games)).toBe(expected);
  });

  it("should format an array of games with pipes to separate title and console", () => {
    const games = ["Game 1 | PS4", "Game 2 | PS4, PS5"];
    const expected = "1. **Game 1** | PS4\n2. **Game 2** | PS4, PS5\n";
    expect(formatListText(games)).toBe(expected);
  });

  it("should handle mixed array of games with and without pipes", () => {
    const games = ["Game 1", "Game 2 | PS4"];
    const expected = "1. **Game 1**\n2. **Game 2** | PS4\n";
    expect(formatListText(games)).toBe(expected);
  });
});

describe("extractGameList", () => {
  it("should extract games using the '| PS' format", () => {
    const html = `
      <p>Here are the games:</p>
      <ul>
        <li>Game One | PS4, PS5</li>
        <li>Another Game |PS5</li>
        <li>Not a game list item</li>
      </ul>
    `;
    const result = extractGameList(html);
    expect(result).toEqual(["Game One | PS4, PS5", "Another Game |PS5"]);
  });

  it("should fallback to extracting from <li> elements if no '| PS' matches are found", () => {
    const html = `
      <p>Here are the games:</p>
      <ul>
        <li>Game A</li>
        <li>Game B</li>
        <li>Last Chance to play this game</li>
      </ul>
    `;
    const result = extractGameList(html);
    expect(result).toEqual(["Game A", "Game B"]);
  });

  it("should fallback to parsing the title if neither list formats match", () => {
    const html = `<p>No list here, just some text.</p>`;
    const title =
      "PlayStation Plus Monthly Games: Super Game, Awesome Game and More";
    const result = extractGameList(html, title);
    expect(result).toEqual(["Super Game", "Awesome Game"]);
  });

  it("should ignore short game names when falling back to <li>", () => {
    const html = `
      <ul>
        <li>A</li>
        <li>Ok</li>
        <li>Good Game</li>
      </ul>
    `;
    const result = extractGameList(html);
    expect(result).toEqual(["Good Game"]);
  });

  it("should ignore long game names (80+ characters) when falling back to <li>", () => {
    const html = `
      <ul>
        <li>Normal Game Name</li>
        <li>This is a very long string that is definitely not a game name because it exceeds the eighty character limit.</li>
      </ul>
    `;
    const result = extractGameList(html);
    expect(result).toEqual(["Normal Game Name"]);
  });

  it("should remove trailing dots from extracted lines", () => {
    const html = `
      <ul>
        <li>Awesome Game | PS4. This game is awesome.</li>
      </ul>
    `;
    const result = extractGameList(html);
    expect(result).toEqual(["Awesome Game | PS4"]);
  });

  it("should handle empty inputs gracefully", () => {
    expect(extractGameList("")).toEqual([]);
    expect(extractGameList("", "")).toEqual([]);
  });
});
describe("checkOfficialPSPlusFeed", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest
      .spyOn(fsPromises, "writeFile")
      .mockImplementation(() => Promise.resolve());
    jest
      .spyOn(fsPromises, "rename")
      .mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("should handle missing saved state file (ENOENT) without crashing", async () => {
    // Mock successful fetch to valid RSS XML
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><item><title>Monthly Games for January</title><link>https://example.com/essential</link><guid>test-guid-1</guid><description>Test Description</description></item></channel></rss>`;
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        headers: new Headers({ "content-length": mockXml.length.toString() }),
        body: (async function* () {
          yield new TextEncoder().encode(mockXml);
        })(),
        text: () => Promise.resolve(mockXml),
      }),
    );

    // Mock readFile to throw ENOENT
    const error = new Error("ENOENT: no such file or directory");
    error.code = "ENOENT";
    jest.spyOn(fsPromises, "readFile").mockRejectedValue(error);

    // Attempt execution
    await expect(checkOfficialPSPlusFeed()).resolves.not.toThrow();

    // Verify it attempted to read the file
    expect(fsPromises.readFile).toHaveBeenCalledWith(
      "saved_state.json",
      "utf8",
    );

    // Verify it doesn't log an error for ENOENT
    expect(console.error).not.toHaveBeenCalledWith(
      "Error parsing STATE_FILE, using default state:",
      expect.anything(),
    );
  });
});
