const assert = require('assert');
const winston = require('winston');
const { createServer } = require('./createServer.js');
const { Pool } = require('pg');
const {
  POSTGRES_USERNAME,
  POSTGRES_PASSWORD,
  POSTGRES_HOST,
  POSTGRES_PORT,
  POSTGRES_DATABASE
} = require('./config');


winston.configure({
  transports: [
    new (winston.transports.Console)(
      {
        colorize: true,
        timestamp: true
      }
    )
  ]
});

winston.info('Configured logger.')


const pool = new Pool({
  user: POSTGRES_USERNAME,
  password: POSTGRES_PASSWORD,
  host: POSTGRES_HOST,
  port: POSTGRES_PORT,
  database: POSTGRES_DATABASE
});

assert.ok(pool, 'Postgres connection pool is undefined.');

winston.info('Opened database connection.');
winston.info('user: ' + POSTGRES_USERNAME);
winston.info('host: ' + POSTGRES_HOST);
winston.info('port: ' + POSTGRES_PORT);
winston.info('database: ' + POSTGRES_DATABASE);


createServer(pool);
