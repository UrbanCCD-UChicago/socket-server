const {SensorTreeCache} = require('./sensorTreeCache.js');
const {listenForRecords, listenForSubscribers} = require('./pubsub.js');

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

const pg = require('pg');

const sensorTreeCache = new SensorTreeCache(pg);
sensorTreeCache.seed()
.catch(err => {
    // Abort on error if we fail to initiate the sensor tree cache
    console.log(`Fatal error: could not initialize sensor metadata: ${err}`);
    process.exit(1);
})
.then(cache => {
    listenForSubscribers(cache, io);
    listenForRecords(cache, io, redis);
    app.listen(8081);
});