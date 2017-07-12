config = {
  POSTGRES_USERNAME: process.env.POSTGRES_USERNAME || 'postgres',
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || 'password',
  POSTGRES_HOST: process.env.POSTGRES_HOST || 'localhost',
  POSTGRES_PORT: process.env.POSTGRES_PORT || 5432,
  POSTGRES_DATABASE: process.env.POSTGRES_DATABASE || 'postgres',

  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: process.env.REDIS_PORT || 6379
}

module.exports = config
