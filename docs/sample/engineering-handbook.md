# Engineering handbook

## Code style
- TypeScript everywhere, strict mode on. No `any` in shared types.
- Server code talks to Appwrite only through the server SDK with an API key; never expose keys to the browser.
- Every table row carries a userId and owner-only permissions.

## Reviews
- Small pull requests, under 400 lines where possible.
- Every bug fix ships with a regression test.

## Releases
- Deploy to staging first, smoke-test the login, parcel assignment and delivery flows, then promote.
- Feature flags for anything customer-facing that is not finished.
