# CartMoveIn

Move-in/move-out cart checkout tracker for Virginia Tech. Student leaders check
carts in and out of buildings; the board is shared across every device via
polling (every 5s) against a common database.

## Local development

```bash
npm install
npm start
```

Without a `DATABASE_URL`/`POSTGRES_URL` set, local runs fall back to a
`data.json` file in the project root — fine for development, but **not**
usable on Vercel (its filesystem is read-only at runtime).

## Deploying to Vercel

1. Push this repo to GitHub and import it into Vercel.
2. Add a Postgres database — the **Neon** integration (Storage tab in your
   Vercel project) is the simplest path and matches the `@neondatabase/serverless`
   driver already used in `server/store.postgres.js`. This automatically sets
   `DATABASE_URL` (and friends) as environment variables on the project.
3. Deploy. On first request the app creates its tables (`buildings`, `sls`,
   `carts`, `checkouts`) automatically if they don't exist yet.

If `DATABASE_URL`/`POSTGRES_URL` isn't set, the app will fail fast on Vercel
with a clear error instead of silently trying (and failing) to write to
`data.json`.

### Why this setup is Vercel-friendly

- **Database driver**: `@neondatabase/serverless` talks to Postgres over
  HTTP, so it works from short-lived serverless function invocations without
  needing a persistent TCP connection pool.
- **Single function**: `api/index.js` re-exports the Express app, and
  `vercel.json` rewrites all traffic to it — including static assets, which
  are explicitly bundled via `functions.api/index.js.includeFiles` so
  `public/` is always available at runtime.
- **Sync**: the client polls `/api/state` every 5 seconds, so all connected
  devices converge on the same database state without needing websockets.
  Checkout is done with an atomic `UPDATE ... WHERE status = 'available'` so
  two people can't claim the same cart in the same polling window.
