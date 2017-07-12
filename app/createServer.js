const redis = require('redis');
const winston = require('winston');

const { REDIS_HOST, REDIS_PORT } = require('./config');
const { listenForRecords, listenForSubscribers } = require("../app/pubsub.js");
const { SensorTreeCache } = require("../app/sensorTreeCache.js");

module.exports.createServer = createServer;


// This function is a handler for http requests sent by the elasticbeanstalk
// health checker. Without this method, the environment will be displayed as
// 'severe' in a scary red color.
function healthcheck(request, response) {
  if (request.method == 'GET' && request.url == '/') {
    response.writeHead(200);
    response.end();
  }
}


// This function defines the retry strategy for failed attempts at connecting
// to redis. It will make an attempt once per second, for 10 seconds. If it
// exceeds those 10 seconds, it kills the server to give elastic beanstalk a
// chance at rebooting it.
function retryRedisConnection(retryInfo) {
  winston.error("Connection attempt to redis failed, retrying...");
  if (retryInfo.total_retry_time > 1000 * 10) {
    winston.error("Failed all connection attempts to redis, exiting server.");
    process.exit(1);
  }
  return 1000;
}


function createServer(pgClient) {
  const server = require("http").createServer(healthcheck);
  const io = require("socket.io")(server);
  const redisClient = redis.createClient({
    host: REDIS_HOST,
    port: REDIS_PORT,
    retry_strategy: retryRedisConnection
  });

  winston.info('Established connection to redis.');
  winston.info('host: ' + REDIS_HOST);
  winston.info('port: ' + REDIS_PORT);

  const sensorTreeCache = new SensorTreeCache(pgClient);
  sensorTreeCache
    .seed()
    .catch(e => {
      winston.error(`Could not initialize sensor metadata: ${e}`, e.stack);
      process.exit(1);
    })
    .then(cache => {
      listenForSubscribers(cache, io);
      listenForRecords(cache, io, redisClient);
      server.listen(8081);
    });
}
