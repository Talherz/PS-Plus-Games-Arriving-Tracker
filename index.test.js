process.env.DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/123/abc";

const fsPromises = require("fs").promises;
const {
  decodeHtmlEntities,
  formatListText,
  extractGameList,
  isValidWebhookUrl,
  checkOfficialPSPlusFeed,
  processBlogContent,
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

  it("should handle non-200 HTTP responses from PS Blog", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
    jest.spyOn(console, "error").mockImplementation(() => {});

    await checkOfficialPSPlusFeed();

    expect(console.error).toHaveBeenCalledWith("Aborting: PS Blog returned error 500");
  });

  it("should handle response size limit (content-length header)", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-length": "6291456" }), // > 5MB
    });
    jest.spyOn(console, "error").mockImplementation(() => {});

    await checkOfficialPSPlusFeed();

    expect(console.error).toHaveBeenCalledWith("Aborting: Response size exceeds limit");
  });

  it("should handle streaming size limit exceeded", async () => {
    const chunk = new Uint8Array(6 * 1024 * 1024); // 6MB chunk
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      body: (async function* () {
        yield chunk;
      })(),
    });
    jest.spyOn(console, "error").mockImplementation(() => {});

    await checkOfficialPSPlusFeed();

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Aborting: Error reading stream - Response body exceeds size limit"));
  });

  it("should handle invalid RSS XML structure", async () => {
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel></channel></rss>`;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      body: (async function* () {
        yield new TextEncoder().encode(mockXml);
      })(),
    });
    jest.spyOn(console, "error").mockImplementation(() => {});

    await checkOfficialPSPlusFeed();

    expect(console.error).toHaveBeenCalledWith("Aborting: XML response does not contain valid RSS feed structure.");
  });

  it("should log error on loading state failure other than ENOENT", async () => {
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><item><title>Monthly Games for January</title><link>https://example.com/essential</link><guid>test-guid-1</guid><description>Test Description</description></item></channel></rss>`;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      body: (async function* () {
        yield new TextEncoder().encode(mockXml);
      })(),
    });

    const error = new Error("Permission denied");
    error.code = "EACCES";
    jest.spyOn(fsPromises, "readFile").mockRejectedValue(error);
    jest.spyOn(console, "error").mockImplementation(() => {});

    await checkOfficialPSPlusFeed();
    expect(console.error).toHaveBeenCalledWith("Error parsing STATE_FILE, using default state:", "Permission denied");
  });

  it("should process Catalog games and update state", async () => {
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><item><title>PlayStation Plus Game Catalog for January</title><link>https://example.com/catalog</link><guid>test-guid-catalog</guid><description>Test Catalog Description</description></item></channel></rss>`;
    global.fetch = jest.fn().mockImplementation((url) => {
      if (url && url.includes("playstation.com")) {
        return Promise.resolve({
          ok: true,
          headers: new Headers(),
          body: (async function* () {
            yield new TextEncoder().encode(mockXml);
          })(),
        });
      }
      return Promise.resolve({ ok: true }); // Discord mock
    });

    jest.spyOn(fsPromises, "readFile").mockResolvedValue(JSON.stringify({ LAST_ESSENTIAL_ID: "", LAST_CATALOG_ID: "" }));

    await checkOfficialPSPlusFeed();
    expect(fsPromises.writeFile).toHaveBeenCalledWith(expect.stringContaining("saved_state.json.tmp"), expect.stringContaining("test-guid-catalog"));
  });

  it("should catch and log fetch timeout error correctly", async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockRejectedValue({ name: "AbortError" });
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});

    const promise = checkOfficialPSPlusFeed();
    await jest.runAllTimersAsync();
    await promise;

    expect(console.error).toHaveBeenCalledWith("Execution error: Fetch request to PS Blog timed out.");
    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
    jest.useRealTimers();
  });

  it("should catch and log other execution errors correctly", async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockRejectedValue(new Error("Some random error"));
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});

    const promise = checkOfficialPSPlusFeed();
    await jest.runAllTimersAsync();
    await promise;

    expect(console.error).toHaveBeenCalledWith("Execution error: ", expect.any(Error));
    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
    jest.useRealTimers();
  });

  it("should log warnings and retry on Discord webhook fetch error", async () => {
    jest.useFakeTimers();
    jest.spyOn(console, "warn").mockImplementation(() => {});

    // Mock successful fetch to valid RSS XML
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><item><title>Monthly Games for January</title><link>https://example.com/essential</link><guid>test-guid-new</guid><description>Test Description</description></item></channel></rss>`;

    global.fetch = jest.fn().mockImplementation((url) => {
      if (url && url.includes("playstation.com")) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ "content-length": mockXml.length.toString() }),
          body: (async function* () {
            yield new TextEncoder().encode(mockXml);
          })(),
          text: () => Promise.resolve(mockXml),
        });
      }
      return Promise.reject(new Error("Network Failure"));
    });

    // Mock readFile to return empty state so it triggers the webhook
    jest
      .spyOn(fsPromises, "readFile")
      .mockResolvedValue(
        JSON.stringify({ LAST_ESSENTIAL_ID: "", LAST_CATALOG_ID: "" }),
      );

    const feedPromise = checkOfficialPSPlusFeed();

    // Advance timers for the retries (2 seconds each attempt)
    // There are 3 attempts, so wait twice (attempt 1 and 2 fail, attempt 3 fails and exits)
    await jest.advanceTimersByTimeAsync(2000);
    await jest.advanceTimersByTimeAsync(2000);

    await feedPromise;

    expect(global.fetch).toHaveBeenCalledTimes(4); // 1 for RSS, 3 for Discord webhook
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "Discord webhook fetch error (attempt 1/3): Network Failure",
      ),
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "Discord webhook fetch error (attempt 2/3): Network Failure",
      ),
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "Discord webhook fetch error (attempt 3/3): Network Failure",
      ),
    );

    jest.useRealTimers();
  });
});

describe("processBlogContent", () => {
  let originalFetch;
  let originalEnv;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalEnv = process.env;
    process.env = {
      ...originalEnv,
      DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123/abc",
    };
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it("should process and send Essential games payload", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
      }),
    );

    const post = {
      title: "PlayStation Plus Monthly Games for January",
      link: "https://blog.playstation.com/essential",
      guid: "essential-123",
      content: `
        <p>Here are the games:</p>
        <ul>
          <li>Game 1 | PS4</li>
          <li>Game 2 | PS5</li>
        </ul>
        <img src="https://example.com/image.jpg" />
      `,
    };

    const result = await processBlogContent(post, "Essential");

    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const fetchCallUrl = global.fetch.mock.calls[0][0];
    const fetchCallOptions = global.fetch.mock.calls[0][1];

    expect(fetchCallUrl).toBe("https://discord.com/api/webhooks/123/abc");
    const payload = JSON.parse(fetchCallOptions.body);

    expect(payload.embeds[0].color).toBe(16766720); // Essential color
    expect(payload.embeds[0].image.url).toBe("https://example.com/image.jpg");
    expect(payload.content).toContain("New PS Plus Essential Games Announced!");
    expect(payload.content).toContain("**Game 1** | PS4");
    expect(payload.content).toContain("**Game 2** | PS5");
  });

  it("should process and send Catalog games payload with Extra and Premium", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
      }),
    );

    const post = {
      title: "PlayStation Plus Game Catalog for January",
      link: "https://blog.playstation.com/catalog",
      guid: "catalog-123",
      content: `
        <p>Extra games:</p>
        <ul>
          <li>Extra Game 1 | PS4</li>
        </ul>
        <h2>PlayStation Plus Premium</h2>
        <ul>
          <li>Premium Game 1 | PS4, PS5</li>
        </ul>
        <img src="https://example.com/catalog.jpg" />
      `,
    };

    const result = await processBlogContent(post, "Catalog");

    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const fetchCallUrl = global.fetch.mock.calls[0][0];
    const fetchCallOptions = global.fetch.mock.calls[0][1];

    expect(fetchCallUrl).toBe("https://discord.com/api/webhooks/123/abc");
    const payload = JSON.parse(fetchCallOptions.body);

    expect(payload.embeds[0].color).toBe(3447003); // Catalog color
    expect(payload.embeds[0].image.url).toBe("https://example.com/catalog.jpg");
    expect(payload.content).toContain("New PS Plus Game Catalog Update!");
    expect(payload.content).toContain("**Extra Game 1** | PS4");
    expect(payload.content).toContain("**Premium Game 1** | PS4, PS5");
  });

  it("should retry and eventually return false on persistent failure", async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error("Network Error")));

    const post = {
      title: "PlayStation Plus Game Catalog for January",
      link: "https://blog.playstation.com/catalog",
      guid: "catalog-123",
      content: "<p>Content</p>",
    };

    jest.useFakeTimers();

    const processPromise = processBlogContent(post, "Catalog");

    // Fast-forward through sleep calls (wait a bit before retrying, 2000ms each)
    await jest.advanceTimersByTimeAsync(2000);
    await jest.advanceTimersByTimeAsync(2000);

    const result = await processPromise;

    expect(result).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(3);

    jest.useRealTimers();
  });
});
