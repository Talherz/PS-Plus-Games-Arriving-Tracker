# Instantaneous Polling using HTTP Conditional GET
The `fetchPlayStationBlogFeed` function in `index.js` has been updated to use HTTP Conditional GET.
It now tracks the `ETag` of the PlayStation Blog RSS Feed.
By sending the `If-None-Match` header on subsequent requests, we bypass rate limits while achieving near-instantaneous polling.

If the RSS Feed remains identical on the PlayStation Blog servers, they will respond with a lightweight `304 Not Modified` and empty body, meaning we can check constantly without penalty.
If the RSS Feed changes (for example, a new post is added), the server returns the updated XML feed and a fresh `ETag`, which is then stored in the `saved_state.json` file.
All tests have been updated accordingly, successfully resolving the user's issue!
