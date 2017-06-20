const { setUpRedis, setUpSocketIo } = require("../app/pubsub.js");
const {sensorTree} = require('./fixtures');

const redis = require("redis").createClient({
  host: process.env.REDIS_HOST || "localhost",
  port: 6379
});

const app = require("http").createServer();
const io = require("socket.io")(app, {
  transports: ["websocket"]
});

const pgClient = {
  query(statement) {
    return  Promise.resolve(sensorTree);
  }
};

setUpSocketIo(pgClient, io)
  .then(() => setUpRedis(redis, io))
  .then(() => app.listen(8081));
