🎯 **What:**
The function `executeWebhookWithRetry` handles critical functionality (delivering Discord webhooks with retry logic, rate limit handling, and abort/timeout fallbacks) but lacked unit tests.

📊 **Coverage:**
- Immediate success.
- Retries on network error and succeeds on subsequent attempt.
- Retries on `AbortError` (timeout) and succeeds on subsequent attempt.
- Exhausts 3 network retry attempts and returns `false`.
- Handles `429 Rate Limit` by sleeping according to the `Retry-After` header and successfully retrying.
- Aborts rate limit retries when `Retry-After` is > 250s.
- Returns `false` on non-retriable errors (e.g. `400 Bad Request`).

✨ **Result:**
The test coverage now completely verifies `executeWebhookWithRetry`, which adds significantly higher confidence in the webhook retry mechanisms and rate limiting functionality. `index.js` was modified to export `executeWebhookWithRetry` and `sleep` in order to make testing them easier.
