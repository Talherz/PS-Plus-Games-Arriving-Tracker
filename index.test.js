process.env.DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/123/abc";

const fsPromises = require("fs").promises;
const {
  sendWebhookRequest,
  readStream,
  decodeHtmlEntities,
  formatListText,
  extractGameList,
  isValidWebhookUrl,
  checkOfficialPSPlusFeed,
  processBlogContent,
  fetchPlayStationBlogFeed,
  parseBlogContent,
  loadMemoryState,
  saveMemoryState,
  formatDiscordMessage,
  isolateGameString,
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

    // Path traversal test
    expect(
      isValidWebhookUrl("https://discord.com/api/webhooks/../../users/@me"),
    ).toBe(false);
    expect(
      isValidWebhookUrl("https://discord.com/api/webhooks/../../../users/@me"),
    ).toBe(false);
    expect(
      isValidWebhookUrl(
        "https://discord.com/api/webhooks/123/..%2f..%2fusers/@me",
      ),
    ).toBe(false);
    expect(
      isValidWebhookUrl("https://discord.com/api/webhooks/..%2f..%2fusers/@me"),
    ).toBe(false);

    // Invalid hostnames
    expect(
      isValidWebhookUrl("https://discord.com.evil.com/api/webhooks/123/abc"),
    ).toBe(false);
    expect(
      isValidWebhookUrl("https://discordapp.com.evil.com/api/webhooks/123/abc"),
    ).toBe(false);
    expect(
      isValidWebhookUrl("https://evil.discord.com/api/webhooks/123/abc"),
    ).toBe(false);
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
describe("loadMemoryState", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should handle missing saved state file (ENOENT) and return default state without logging an error", async () => {
    const error = new Error("ENOENT: no such file or directory");
    error.code = "ENOENT";
    jest.spyOn(fsPromises, "readFile").mockRejectedValue(error);

    const result = await loadMemoryState();

    expect(fsPromises.readFile).toHaveBeenCalledWith(
      expect.any(String),
      "utf8",
    );
    expect(result).toEqual({
      LAST_ESSENTIAL_ID: "",
      LAST_CATALOG_ID: "",
      ETAG: "",
    });
    expect(console.error).not.toHaveBeenCalled();
  });

  it("should log an error and return default state when read fails with non-ENOENT error", async () => {
    const error = new Error("Permission denied");
    error.code = "EACCES";
    jest.spyOn(fsPromises, "readFile").mockRejectedValue(error);

    const result = await loadMemoryState();

    expect(fsPromises.readFile).toHaveBeenCalledWith(
      expect.any(String),
      "utf8",
    );
    expect(console.error).toHaveBeenCalledWith(
      "Error parsing STATE_FILE, using default state:",
      "Permission denied",
    );
    expect(result).toEqual({
      LAST_ESSENTIAL_ID: "",
      LAST_CATALOG_ID: "",
      ETAG: "",
    });
  });

  it("should log an error and return default state when JSON parsing fails", async () => {
    jest.spyOn(fsPromises, "readFile").mockResolvedValue("invalid json");

    const result = await loadMemoryState();

    expect(fsPromises.readFile).toHaveBeenCalledWith(
      expect.any(String),
      "utf8",
    );
    expect(console.error).toHaveBeenCalledWith(
      "Error parsing STATE_FILE, using default state:",
      expect.stringContaining("Unexpected token"),
    );
    expect(result).toEqual({
      LAST_ESSENTIAL_ID: "",
      LAST_CATALOG_ID: "",
      ETAG: "",
    });
  });
});

describe("saveMemoryState", () => {
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should write state to a temp file and rename it", async () => {
    jest.spyOn(fsPromises, "writeFile").mockResolvedValue();
    jest.spyOn(fsPromises, "rename").mockResolvedValue();

    const state = { LAST_ESSENTIAL_ID: "123", LAST_CATALOG_ID: "456" };
    await saveMemoryState(state);

    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      expect.stringContaining(".tmp"),
      JSON.stringify(state, null, 2),
    );
    expect(fsPromises.rename).toHaveBeenCalledWith(
      expect.stringContaining(".tmp"),
      expect.any(String),
    );
    expect(console.log).toHaveBeenCalledWith("Memory state updated.");
  });

  it("should propagate errors if writeFile fails", async () => {
    const error = new Error("Write failed");
    jest.spyOn(fsPromises, "writeFile").mockRejectedValue(error);
    jest.spyOn(fsPromises, "rename").mockResolvedValue();

    const state = { LAST_ESSENTIAL_ID: "123", LAST_CATALOG_ID: "456" };

    await expect(saveMemoryState(state)).rejects.toThrow("Write failed");

    expect(fsPromises.writeFile).toHaveBeenCalled();
    expect(fsPromises.rename).not.toHaveBeenCalled();
  });
});

describe("fetchPlayStationBlogFeed", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    jest.useFakeTimers();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should return { itemList: [], newEtag: etag } and clear timeout on 304 response", async () => {
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");
    global.fetch = jest.fn().mockResolvedValue({
      status: 304,
      ok: true,
    });
    const etag = "test-etag";
    const resultPromise = fetchPlayStationBlogFeed(etag);
    await jest.runAllTimersAsync();
    const result = await resultPromise;
    expect(result).toEqual({ itemList: [], newEtag: etag });
    expect(console.log).toHaveBeenCalledWith(
      "No new updates (304 Not Modified).",
    );
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it("should return null and clear timeout on non-200 response", async () => {
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");
    global.fetch = jest.fn().mockResolvedValue({
      status: 500,
      ok: false,
    });
    const resultPromise = fetchPlayStationBlogFeed();
    await jest.runAllTimersAsync();
    const result = await resultPromise;
    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      "Aborting: PS Blog returned error 500",
    );
    expect(clearTimeoutSpy).toHaveBeenCalled();
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
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      body: (async function* () {
        yield new TextEncoder().encode(
          '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel></channel></rss>',
        );
      })(),
    });
    jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(checkOfficialPSPlusFeed()).resolves.not.toThrow();

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

    expect(console.error).toHaveBeenCalledWith(
      "Aborting: PS Blog returned error 500",
    );
  });

  it("should handle response size limit (content-length header)", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-length": "6291456" }), // > 5MB
    });
    jest.spyOn(console, "error").mockImplementation(() => {});

    await checkOfficialPSPlusFeed();

    expect(console.error).toHaveBeenCalledWith(
      "Aborting: Response size exceeds limit",
    );
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

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Aborting: Error reading stream - Response body exceeds size limit",
      ),
    );
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

    expect(console.error).toHaveBeenCalledWith(
      "Aborting: XML response does not contain valid RSS feed structure.",
    );
  });

  it("should log error on loading state failure other than ENOENT", async () => {
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><item><title>PlayStation Plus Monthly Games for January</title><link>https://example.com/essential</link><guid>test-guid-1</guid><description>Test Description</description></item></channel></rss>`;
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
    expect(console.error).toHaveBeenCalledWith(
      "Error parsing STATE_FILE, using default state:",
      "Permission denied",
    );
  });

  it("should process Catalog games and update state", async () => {
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><item><title>PlayStation Plus Game Catalog for January</title><link>https://example.com/catalog</link><guid>test-guid-catalog</guid><description>Test Catalog Description</description></item></channel></rss>`;
    global.fetch = jest.fn().mockImplementation((url) => {
      if (url && url.includes("playstation.com")) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ etag: '"mocked-etag"' }),
          body: (async function* () {
            yield new TextEncoder().encode(mockXml);
          })(),
        });
      }
      return Promise.resolve({ ok: true }); // Discord mock
    });

    jest
      .spyOn(fsPromises, "readFile")
      .mockResolvedValue(
        JSON.stringify({ LAST_ESSENTIAL_ID: "", LAST_CATALOG_ID: "" }),
      );

    await checkOfficialPSPlusFeed();
    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      expect.stringContaining("saved_state.json.tmp"),
      expect.stringContaining("test-guid-catalog"),
    );
  });

  it("should catch and log fetch timeout error correctly", async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockRejectedValue({ name: "AbortError" });
    const mockExit = jest.spyOn(process, "exit").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});

    const promise = checkOfficialPSPlusFeed();
    await jest.runAllTimersAsync();
    await promise;

    expect(console.error).toHaveBeenCalledWith(
      "Execution error: Fetch request to PS Blog timed out.",
    );
    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
    jest.useRealTimers();
  });

  it("should catch and log other execution errors correctly", async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockRejectedValue(new Error("Some random error"));
    const mockExit = jest.spyOn(process, "exit").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});

    const promise = checkOfficialPSPlusFeed();
    await jest.runAllTimersAsync();
    await promise;

    expect(console.error).toHaveBeenCalledWith(
      "Execution error: ",
      expect.any(Error),
    );
    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
    jest.useRealTimers();
  });

  it("should log warnings and retry on Discord webhook fetch error", async () => {
    jest.useFakeTimers();
    jest.spyOn(console, "warn").mockImplementation(() => {});

    // Mock successful fetch to valid RSS XML
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><item><title>PlayStation Plus Monthly Games for January</title><link>https://example.com/essential</link><guid>test-guid-new</guid><description>Test Description</description></item></channel></rss>`;

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

  it("should return false and log error on Discord 429 rate limit with long Retry-After", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 429,
        headers: new Headers({ "Retry-After": "300" }),
      }),
    );

    const post = {
      title: "PlayStation Plus Game Catalog for January",
      link: "https://blog.playstation.com/catalog",
      guid: "catalog-123",
      content: "<p>Content</p>",
    };

    const result = await processBlogContent(post, "Catalog");

    expect(result).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      "❌ Discord rate limit is too long (300s). Aborting attempt.",
    );
  });

  it("should return false and log error on non-200 and non-429 Discord response", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Bad Request: Invalid format"),
      }),
    );

    const post = {
      title: "PlayStation Plus Game Catalog for January",
      link: "https://blog.playstation.com/catalog",
      guid: "catalog-123",
      content: "<p>Content</p>",
    };

    const result = await processBlogContent(post, "Catalog");

    expect(result).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      "❌ DISCORD REJECTED IT! Error code: 400",
    );
    expect(console.error).toHaveBeenCalledWith(
      "Reason: Bad Request: Invalid format",
    );
  });
});

describe("parseRssXml", () => {
  let parseRssXml;

  beforeEach(() => {
    parseRssXml = require("./index").parseRssXml;
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should return an array of items for valid XML with a single item", () => {
    const xmlData = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><item><title>Test Game</title><link>https://example.com</link><guid>test-guid</guid><description>Test Description</description></item></channel></rss>`;
    const result = parseRssXml(xmlData);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    expect(result[0].title).toBe("Test Game");
  });

  it("should return an array of items for valid XML with multiple items", () => {
    const xmlData = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><item><title>Test Game 1</title><link>https://example.com/1</link><guid>test-guid-1</guid><description>Test Description 1</description></item><item><title>Test Game 2</title><link>https://example.com/2</link><guid>test-guid-2</guid><description>Test Description 2</description></item></channel></rss>`;
    const result = parseRssXml(xmlData);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result[0].title).toBe("Test Game 1");
    expect(result[1].title).toBe("Test Game 2");
  });

  it("should return null and log an error for invalid XML input", () => {
    const xmlData = `<?xml version="1.0" encoding="UTF-8"?><notrss></notrss>`;
    const result = parseRssXml(xmlData);
    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      "Aborting: XML response does not contain valid RSS feed structure.",
    );
  });
});

describe("readStream", () => {
  let originalConsoleError;

  beforeEach(() => {
    jest.useFakeTimers();
    originalConsoleError = console.error;
    console.error = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    console.error = originalConsoleError;
  });

  it("should read stream successfully and clear timeout", async () => {
    const encoder = new TextEncoder();
    const chunks = [encoder.encode("Hello"), encoder.encode(" World")];

    const mockResponse = {
      body: (async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      })(),
    };

    const timeoutId = setTimeout(() => {}, 1000);
    const result = await readStream(mockResponse, 1000, timeoutId);

    expect(result).toBe("Hello World");
    // Since readStream throws or returns naturally, the main timeout is handled
    // by the caller. But if readStream errors, it clears the timeout.
    // In this happy path, the timeout should NOT be cleared by readStream itself.
  });

  it("should abort and return null if max size is exceeded", async () => {
    const encoder = new TextEncoder();
    const chunks = [
      encoder.encode("This chunk is 26 bytes."),
      encoder.encode("This chunk will exceed limits."),
    ];

    const mockResponse = {
      body: (async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      })(),
    };

    // Simulate setting a timeout
    const timeoutFn = jest.fn();
    const timeoutId = setTimeout(timeoutFn, 1000);

    // Max size is 30, the second chunk pushes it over
    const result = await readStream(mockResponse, 30, timeoutId);

    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Response body exceeds size limit"),
    );

    // Run timers to verify timeout was cleared
    jest.runAllTimers();
    expect(timeoutFn).not.toHaveBeenCalled();
  });

  it("should abort and return null on other stream reading errors", async () => {
    const mockResponse = {
      body: (async function* () {
        yield new TextEncoder().encode("First chunk");
        throw new Error("Simulated network failure");
      })(),
    };

    const timeoutFn = jest.fn();
    const timeoutId = setTimeout(timeoutFn, 1000);

    const result = await readStream(mockResponse, 1000, timeoutId);

    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Simulated network failure"),
    );

    jest.runAllTimers();
    expect(timeoutFn).not.toHaveBeenCalled();
  });
});
describe("sendWebhookRequest", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    global.fetch = jest.fn();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should send a webhook request successfully", async () => {
    global.fetch.mockResolvedValueOnce({ ok: true });

    const promise = sendWebhookRequest({ content: "test" });
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "test" }),
      }),
    );
    expect(result.res).toEqual({ ok: true });
    expect(result.error).toBeNull();
  });

  it("should return error when fetch throws", async () => {
    const error = new Error("Network error");
    global.fetch.mockRejectedValueOnce(error);

    const promise = sendWebhookRequest({ content: "test" });
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.res).toBeNull();
    expect(result.error).toBe(error);
  });

  it("should abort the request if it times out", async () => {
    const abortError = new Error("AbortError");
    abortError.name = "AbortError";

    global.fetch.mockImplementationOnce((url, { signal }) => {
      return new Promise((resolve, reject) => {
        if (signal.aborted) {
          reject(abortError);
        }
        signal.addEventListener("abort", () => {
          reject(abortError);
        });
      });
    });

    const promise = sendWebhookRequest({ content: "test" });
    await jest.advanceTimersByTimeAsync(10000);
    const result = await promise;

    expect(result.res).toBeNull();
    expect(result.error).toBe(abortError);
  });
});
const originalEnv = process.env;
describe("formatDiscordMessage", () => {
  beforeEach(() => {
    // Save original process.env
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Clean up mock timers
    jest.useRealTimers();
  });

  it("should correctly format a Discord message with all provided data", () => {
    const { formatDiscordMessage } = require("./index");
    jest.useFakeTimers().setSystemTime(new Date("2023-01-01T00:00:00Z"));

    const post = {
      title: "PlayStation Plus Monthly Games - January 2023",
      link: "https://blog.playstation.com/2023/01/01/ps-plus-jan-2023/",
    };

    const parsedContent = {
      messageContent: "Here are the new games!",
      embedColor: 16777215, // White
      tierText: "Some games...",
      imageUrl: "https://example.com/image.jpg",
    };

    const expectedPayload = {
      username: "Talherz Waifu",
      content: "Here are the new games!",
      embeds: [
        {
          title: "PlayStation Plus Monthly Games - January 2023",
          url: "https://blog.playstation.com/2023/01/01/ps-plus-jan-2023/",
          description: "Some games...",
          color: 16777215,
          footer: { text: "Official PlayStation Blog Auto-Parse" },
          timestamp: "2023-01-01T00:00:00.000Z",
          image: { url: "https://example.com/image.jpg" },
        },
      ],
      allowed_mentions: { parse: [] },
    };

    const payload = formatDiscordMessage(post, parsedContent);
    expect(payload).toEqual(expectedPayload);
  });

  it("should format correctly when DISCORD_ROLE_ID is set", () => {
    process.env.DISCORD_ROLE_ID = "123456789";
    const { formatDiscordMessage } = require("./index");
    jest.useFakeTimers().setSystemTime(new Date("2023-01-01T00:00:00Z"));

    const post = {
      title: "PS Plus",
      link: "https://example.com",
    };

    const parsedContent = {
      messageContent: "Hello",
      embedColor: 0,
      tierText: "Games",
      imageUrl: null, // Test without image
    };

    const expectedPayload = {
      username: "Talherz Waifu",
      content: "Hello",
      embeds: [
        {
          title: "PS Plus",
          url: "https://example.com",
          description: "Games",
          color: 0,
          footer: { text: "Official PlayStation Blog Auto-Parse" },
          timestamp: "2023-01-01T00:00:00.000Z",
        },
      ],
      allowed_mentions: { roles: ["123456789"] },
    };

    const payload = formatDiscordMessage(post, parsedContent);
    expect(payload).toEqual(expectedPayload);
  });

  it("should decode HTML entities in the title", () => {
    const { formatDiscordMessage } = require("./index");
    jest.useFakeTimers().setSystemTime(new Date("2023-01-01T00:00:00Z"));

    const post = {
      title: "Game &amp; Watch &#8211; New Release",
      link: "https://example.com",
    };

    const parsedContent = {
      messageContent: "Hello",
      embedColor: 0,
      tierText: "Games",
      imageUrl: null,
    };

    const payload = formatDiscordMessage(post, parsedContent);
    expect(payload.embeds[0].title).toBe("Game & Watch - New Release");
  });
});

describe("isolateGameString", () => {
  it("should return the string unmodified if there is no dot-space", () => {
    expect(isolateGameString("The Last of Us Part I | PS5")).toBe(
      "The Last of Us Part I | PS5",
    );
  });

  it("should truncate the string at the first dot-space", () => {
    expect(
      isolateGameString(
        "Horizon Forbidden West | PS4, PS5. Available on Nov 15",
      ),
    ).toBe("Horizon Forbidden West | PS4, PS5");
    expect(isolateGameString("Game Name. Description text.")).toBe("Game Name");
  });

  it("should trim the string and remove a trailing dot if present", () => {
    expect(isolateGameString("  God of War Ragnarok  ")).toBe(
      "God of War Ragnarok",
    );
    expect(isolateGameString("Ghost of Tsushima.")).toBe("Ghost of Tsushima");
    expect(isolateGameString("  Bloodborne.  ")).toBe("Bloodborne");
  });

  it("should correctly handle an empty string or whitespace only", () => {
    expect(isolateGameString("")).toBe("");
    expect(isolateGameString("   ")).toBe("");
  });
});

describe("parseBlogContent", () => {
  it("should parse Catalog content and extract an image URL", () => {
    const post = {
      title: "PlayStation Plus Game Catalog",
      content: `
        <p>PlayStation Plus Extra and Premium | Game Catalog</p>
        <ul><li><strong>Game 1</strong> | PS4</li></ul>
        <img src="https://example.com/image.jpg" />
      `,
    };

    const result = parseBlogContent(post, "Catalog");

    expect(result.embedColor).toBe(3447003); // Catalog color
    expect(result.messageContent).toContain("**Game 1** | PS4");
    expect(result.imageUrl).toBe("https://example.com/image.jpg");
  });

  it("should parse Essential content and extract an image URL", () => {
    const post = {
      title: "PlayStation Plus Essential Games",
      content: `
        <ul><li><strong>Game 2</strong> | PS5</li></ul>
        <img src="https://example.com/image2.png" />
      `,
    };

    const result = parseBlogContent(post, "Essential");

    expect(result.embedColor).toBe(16766720); // Essential color
    expect(result.messageContent).toContain("**Game 2** | PS5");
    expect(result.imageUrl).toBe("https://example.com/image2.png");
  });

  it("should handle content without an image URL gracefully", () => {
    const post = {
      title: "PlayStation Plus Essential Games",
      content: `
        <ul><li><strong>Game 3</strong> | PS4</li></ul>
        <p>No image here.</p>
      `,
    };

    const result = parseBlogContent(post, "Essential");

    expect(result.imageUrl).toBe("");
  });

  it("should only extract specific image types (jpg, png, jpeg, webp)", () => {
    const post = {
      title: "PlayStation Plus Game Catalog",
      content: `
        <img src="https://example.com/image.gif" />
        <img src="https://example.com/image.webp" />
      `,
    };

    const result = parseBlogContent(post, "Catalog");

    expect(result.imageUrl).toBe("https://example.com/image.webp");
  });

  it("should ignore invalid image URLs", () => {
    const post = {
      title: "PlayStation Plus Game Catalog",
      content: `
        <img src="http://example.com/image.jpg" />
        <img src="/local/image.jpg" />
      `,
    };

    const result = parseBlogContent(post, "Catalog");

    expect(result.imageUrl).toBe("");
  });
});

describe("parseCatalogContent", () => {
  const { parseCatalogContent } = require("./index");

  it("should parse content with both Extra and Premium games correctly", () => {
    const postTitle = "PlayStation Plus Game Catalog";
    const postContentStr = `
      <h2>PlayStation Plus Extra and Premium | Game Catalog</h2>
      <ul>
        <li>Extra Game 1 | PS4</li>
        <li>Extra Game 2 | PS5</li>
      </ul>
      <h2>PlayStation Plus Premium</h2>
      <ul>
        <li>Premium Classic 1 | PS4</li>
      </ul>
    `;

    const result = parseCatalogContent(postContentStr, postTitle);

    expect(result.embedColor).toBe(3447003);
    expect(result.messageContent).toContain("**Extra Game 1** | PS4");
    expect(result.messageContent).toContain("**Extra Game 2** | PS5");
    expect(result.messageContent).toContain("**Premium Classic 1** | PS4");
    expect(result.messageContent).toContain("🟦 **EXTRA:**");
    expect(result.messageContent).toContain("🟪 **PREMIUM:**");
  });

  it("should parse content with only Extra games correctly", () => {
    const postTitle = "PlayStation Plus Game Catalog";
    const postContentStr = `
      <h2>PlayStation Plus Extra and Premium | Game Catalog</h2>
      <ul>
        <li>Extra Game 1 | PS4</li>
      </ul>
    `;

    const result = parseCatalogContent(postContentStr, postTitle);

    expect(result.messageContent).toContain("**Extra Game 1** | PS4");
    expect(result.messageContent).toContain("🟦 **EXTRA:**");
    expect(result.messageContent).not.toContain("🟪 **PREMIUM:**");
  });

  it("should parse content with only Premium games correctly", () => {
    const postTitle = "PlayStation Plus Game Catalog";
    const postContentStr = `
      <h2>PlayStation Plus Premium</h2>
      <ul>
        <li>Premium Classic 1 | PS4</li>
      </ul>
    `;

    const result = parseCatalogContent(postContentStr, postTitle);

    expect(result.messageContent).toContain(
      "> *None detected or formatting changed.*",
    );
    expect(result.messageContent).toContain("🟦 **EXTRA:**");
    expect(result.messageContent).toContain("**Premium Classic 1** | PS4");
    expect(result.messageContent).toContain("🟪 **PREMIUM:**");
  });

  it("should parse Premium games using a <p> tag with <strong> correctly", () => {
    const postTitle = "PlayStation Plus Game Catalog";
    const postContentStr = `
      <h2>PlayStation Plus Extra and Premium | Game Catalog</h2>
      <ul>
        <li>Extra Game 1 | PS4</li>
      </ul>
      <p><strong>PlayStation Plus Premium | Classics</strong></p>
      <ul>
        <li>Premium Classic 1 | PS4</li>
      </ul>
    `;

    const result = parseCatalogContent(postContentStr, postTitle);

    expect(result.messageContent).toContain("**Extra Game 1** | PS4");
    expect(result.messageContent).toContain("**Premium Classic 1** | PS4");
    expect(result.messageContent).toContain("🟪 **PREMIUM:**");
  });

  it("should parse Premium games using fallback string index correctly", () => {
    const postTitle = "PlayStation Plus Game Catalog";
    const postContentStr = `
      <h2>PlayStation Plus Extra and Premium | Game Catalog</h2>
      <ul>
        <li>Extra Game 1 | PS4</li>
      </ul>
      <br>
      PlayStation Plus Premium
      <br>
      <ul>
        <li>Premium Classic 1 | PS4</li>
      </ul>
    `;

    // To hit the fallback `indexOf` path, we need it to occur after the PREMIUM_SEARCH_OFFSET (800)
    // We'll pad the beginning of the content with spaces to reach this offset.
    const paddedContent = " ".repeat(800) + postContentStr;

    const result = parseCatalogContent(paddedContent, postTitle);

    expect(result.messageContent).toContain("**Extra Game 1** | PS4");
    expect(result.messageContent).toContain("**Premium Classic 1** | PS4");
    expect(result.messageContent).toContain("🟪 **PREMIUM:**");
  });

  it("should format string without games for empty sections correctly", () => {
    const postTitle = "PlayStation Plus Game Catalog";
    const postContentStr = "";

    const result = parseCatalogContent(postContentStr, postTitle);

    expect(result.messageContent).toContain(
      "🟦 **EXTRA:**\n> *None detected or formatting changed.*",
    );
    expect(result.messageContent).not.toContain("🟪 **PREMIUM:**");
  });
});

describe("parseEssentialContent", () => {
  it("should extract games and format them correctly", () => {
    const { parseEssentialContent } = require("./index.js");
    const postContentStr =
      "<ul><li>Game 1 | PS4</li><li>Game 2 | PS5</li></ul>";
    const postTitle = "PlayStation Plus Monthly Games";
    const result = parseEssentialContent(postContentStr, postTitle);

    expect(result.embedColor).toBe(16766720);
    expect(result.messageContent).toContain(
      "🚨 **New PS Plus Essential Games Announced!**",
    );
    expect(result.messageContent).toContain("🟨 **MONTHLY GAMES:**");
    expect(result.messageContent).toContain("Game 1");
    expect(result.messageContent).toContain("PS4");
    expect(result.messageContent).toContain("Game 2");
    expect(result.messageContent).toContain("PS5");
    expect(result.tierText).toBe("Click the blog link for full details.");
  });

  it("should handle empty or malformed content gracefully", () => {
    const { parseEssentialContent } = require("./index.js");
    const result = parseEssentialContent("", "Test Title");

    expect(result.embedColor).toBe(16766720);
    expect(result.messageContent).toContain(
      "🚨 **New PS Plus Essential Games Announced!**",
    );
    expect(result.messageContent).toContain("🟨 **MONTHLY GAMES:**");
    expect(result.tierText).toBe("Click the blog link for full details.");
  });
});
