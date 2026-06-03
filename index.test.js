const { processBlogContent } = require('./index');

describe('processBlogContent Discord Webhook Rate Limits', () => {
  let originalFetch;
  let consoleLogMock, consoleErrorMock, consoleWarnMock;

  beforeEach(() => {
    // Preserve original fetch
    originalFetch = global.fetch;

    // Mock console to keep test output clean and allow assertions
    consoleLogMock = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorMock = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnMock = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore global.fetch
    global.fetch = originalFetch;

    // Restore console mocks
    jest.restoreAllMocks();
  });

  it('should abort and return false when Discord rate limit is too long (> 250s)', async () => {
    // Mock fetch to simulate 429 response with long Retry-After
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ 'Retry-After': '300' }), // 300 seconds > 250
      text: async () => 'Rate Limited'
    });

    const mockPost = {
      title: 'Test Post',
      link: 'http://example.com/test-post',
      content: 'Some game here'
    };

    const result = await processBlogContent(mockPost, 'Essential');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result).toBe(false);
    expect(consoleErrorMock).toHaveBeenCalledWith(
      expect.stringContaining('Discord rate limit is too long (300s). Aborting attempt.')
    );
  });

  it('should retry when Discord rate limit is short (< 250s) and eventually fail if rate limited continuously', async () => {
    // Mock fetch to simulate 429 response with short Retry-After
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ 'Retry-After': '1' }), // 1 second
      text: async () => 'Rate Limited'
    });

    const mockPost = {
      title: 'Test Post',
      link: 'http://example.com/test-post',
      content: 'Some game here'
    };

    // Fast-forward timers or let the test wait since it's short (3 attempts of 1s each = 3s total)
    // We'll just wait the 3 seconds for this test to be simple and accurate to the real `sleep` function
    const start = Date.now();
    const result = await processBlogContent(mockPost, 'Essential');
    const end = Date.now();

    // 3 attempts * 1 second retry = ~3 seconds (allow some buffer)
    expect(end - start).toBeGreaterThanOrEqual(3000);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(result).toBe(false);
    expect(consoleWarnMock).toHaveBeenCalledWith(
      expect.stringContaining('Rate limited. Retry after 1s (attempt 1/3)')
    );
    expect(consoleWarnMock).toHaveBeenCalledWith(
      expect.stringContaining('Rate limited. Retry after 1s (attempt 2/3)')
    );
    expect(consoleWarnMock).toHaveBeenCalledWith(
      expect.stringContaining('Rate limited. Retry after 1s (attempt 3/3)')
    );
  }, 10000); // increase timeout for this test as it sleeps

  it('should retry and succeed if rate limit resolves', async () => {
    // Mock fetch to fail first with 429, then succeed
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '1' }), // 1 second
        text: async () => 'Rate Limited'
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => 'OK'
      });

    const mockPost = {
      title: 'Test Post',
      link: 'http://example.com/test-post',
      content: 'Some game here'
    };

    const start = Date.now();
    const result = await processBlogContent(mockPost, 'Essential');
    const end = Date.now();

    expect(end - start).toBeGreaterThanOrEqual(1000); // Slept for 1 second
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result).toBe(true);
    expect(consoleWarnMock).toHaveBeenCalledWith(
      expect.stringContaining('Rate limited. Retry after 1s (attempt 1/3)')
    );
    expect(consoleLogMock).toHaveBeenCalledWith(
      expect.stringContaining('SUCCESS! Discord accepted the message.')
    );
  });
});
