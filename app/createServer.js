const winston = require('winston');


exports.createServer = createServer;


// This function is a handler for http requests sent by the elasticbeanstalk
// health checker. Without this method, the environment will be displayed as
// 'severe' in a scary red color.
function healthcheck(request, response) {
  if (request.method == 'GET' && request.url == '/') {
    response.writeHead(200);
    response.end();
  }
}

function createServer(pgClient) {
  const { SensorTreeCache } = require("../app/sensorTreeCache.js");
  const {
    listenForRecords,
    listenForSubscribers
  } = require("../app/pubsub.js");

  const redis = require("redis").createClient({
    host: process.env.REDIS_HOST || "localhost",
    port: 6379,
    retry_strategy
  });

  function retry_strategy(retryInfo) {
    // If we've been at this for more than 10 seconds
    // kill this process to give Elastic Beanstalk a chance at rebooting us.
    if (retryInfo.total_retry_time > 1000 * 10) {
      winston.error("Lost connection to Redis.");
      process.exit(1);
    }
    // Wait one second between attempts.
    return 1000;
  }

  const app = require("http").createServer(healthcheck);
  const io = require("socket.io")(app, {
    transports: ["websocket"]
  });

  const sensorTreeCache = new SensorTreeCache(pgClient);
  sensorTreeCache
    .seed()
    .catch(e => {
      winston.error(`Could not initialize sensor metadata: ${e}`, e.stack);
      process.exit(1);
    })
    .then(cache => {
      listenForSubscribers(cache, io);
      listenForRecords(cache, io, redis);
      app.listen(8081);
    });
}
