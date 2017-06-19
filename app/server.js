const {setUpRedis, setUpSocketIo} = require('./pubsub.js');

const redis = require('redis').createClient({
    host: process.env.REDIS_HOST || 'localhost', 
    port: 6379
});
setUpRedis(redis);

const app = require("http").createServer();
const io = require("socket.io")(app, {
    transports: ['websocket']
});

const pg = require('pg');

setUpSocketIo(new pg.Client({}), io)
.then(() => setUpRedis(redis, io))
.then(() => app.listen(8081));