config = {
  POSTGRES_USERNAME: process.env.POSTGRES_USERNAME || 'postgres',
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || 'password',
  POSTGRES_HOST: process.env.POSTGRES_HOST || 'localhost',
  POSTGRES_PORT: process.env.POSTGRES_PORT || 5432,
  POSTGRES_DATABASE: process.env.POSTGRES_DATABASE || 'postgres'
}

module.exports = config
