module.exports = (process.env.DATABASE_URL || process.env.POSTGRES_URL)
  ? require('./store.postgres')
  : require('./store.json');
