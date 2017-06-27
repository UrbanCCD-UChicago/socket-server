const {SensorTreeCache} = require('../app/sensorTreeCache.js');
const {listenForRecords, listenForSubscribers} = require('../app/pubsub.js');
const {localTestTree} = require('./fixtures.js');

const redis = require('redis').createClient({
    host: process.env.REDIS_HOST || 'localhost', 
    port: 6379,
    retry_strategy
});

function retry_strategy(retryInfo) {
    // If we've been at this for more than 10 seconds
    // kill this process to give Elastic Beanstalk a chance at rebooting us.
    if (retryInfo.total_retry_time > (1000 * 10)) {
        console.log('Fatal error: Lost connection to Redis.');
        process.exit(1);
    }
    // Wait one second between attempts.
    return 1000;
}

const app = require("http").createServer();
const io = require("socket.io")(app, {
    transports: ['websocket']
});

const packageResult = sensor_tree => Promise.resolve({rows: [{sensor_tree}]});
const pgClient = {
  query(statement) {
    return packageResult(localTestTree);
  }
};

const sensorTreeCache = new SensorTreeCache(pgClient);
sensorTreeCache.seed()
.catch(err => {
    // Abort on error if we fail to initiate the sensor tree cache
    console.log(`Fatal error: could not initialize sensor metadata: ${err}`, err.stack);
    process.exit(1);
})
.then(cache => {
    listenForSubscribers(cache, io);
    listenForRecords(cache, io, redis);
    app.listen(8081);
});