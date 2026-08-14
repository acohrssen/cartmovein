const hasDb = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);

if (process.env.VERCEL && !hasDb) {
  throw new Error(
    'DATABASE_URL (or POSTGRES_URL) is not set. Connect a Postgres database ' +
    '(e.g. the Neon integration) in your Vercel project settings — the local ' +
    'data.json file store does not work on Vercel\'s read-only filesystem.'
  );
}

module.exports = hasDb ? require('./store.postgres') : require('./store.json');
