const winston = require('winston');
const socket_util = require('./socket_util');

const app = require("http").createServer();
const io = require("socket.io")(app, {
    transports: ['websocket']
});

const redis = require('redis').createClient({
    host: process.env.REDIS_HOST || 'localhost', 
    port: 6379
});

const pg = require('pg');

const sensorTreeCache = {
    get sensorTree() {
        // che
    }
};

// Port number configured by Elastic Beanstalk
app.listen(8081);

// Configure the logger.
winston.level = process.env.LOG_LEVEL || "info";
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {'colorize': true, 'timestamp': true})

const REDIS_CHANNEL_NAME = 'plenario_observations';

/* Polyfill Object.values and Object.entries for Node 6.10
    https://github.com/tc39/proposal-object-values-entries/blob/master/polyfill.js
 */
const reduce = Function.bind.call(Function.call, Array.prototype.reduce);
const isEnumerable = Function.bind.call(Function.call, Object.prototype.propertyIsEnumerable);
const concat = Function.bind.call(Function.call, Array.prototype.concat);
const keys = Reflect.ownKeys;

if (!Object.values) {
	Object.values = function values(O) {
		return reduce(keys(O), (v, k) => concat(v, typeof k === 'string' && isEnumerable(O, k) ? [O[k]] : []), []);
	};
}
if (!Object.entries) {
	Object.entries = function entries(O) {
		return reduce(keys(O), (e, k) => concat(e, typeof k === 'string' && isEnumerable(O, k) ? [[k, O[k]]] : []), []);
	};
}

var rooms = {};
var socket_count = 0;

redis.subscribe(REDIS_CHANNEL_NAME);
/**
 * An observation has the format of 
 */
redis.on('message', (channel, msg) => {
    const observations = JSON.parse(msg);
    // io.sockets gives the default namespace.
    // namespace.connected gives hash of id to socket for all connected clients.
    const idSocketPairs = Object.entries(io.sockets.connected);
    for (let o of observations) {
        const eligiblePairs = idSocketPairs.filter(pair => shouldSend(pair[1].args, o));
        for (let [id, socket] of eligiblePairs) {
            socket.to(id).emit('data', o);
        }
    }

    Object.keys(rooms).forEach(function (roomName) {
        const room = JSON.parse(roomName);
        // Ensure data comes with everything required to publish in the current room.
        if (room.network != observation.network) return;
        
        if (room.features && !room.features.contains(observation.feature)) return;
        if (room.nodes && !room.nodes.contains(observation.node)) return;
        if (room.sensors && !room.sensors.contains(observation.sensor)) return;

        winston.info('Data is valid, broadcasting to room ' + rooms[roomName]);
        io.to(roomName).emit('data', observation);
    });
});

function shouldSend(args, observation) {
    for (let property of ['network', 'feature', 'sensor', 'node']) {

    }
}

function disconnectOnError(socket, msg) {
    socket.emit('internal_error', {error: msg});
    socket.disconnect();
}

io.on('connection', function (socket) {
    // parseArgs should return a _descriptive_ error string
    // And we should only error + disconnect in that one place
    if (!(socket.handshake.query.network)) {
        return disconnectOnError(socket, 'You must specify a network.');
    }
    try {
        var args = socket_util.parse_args(socket.handshake.query)
    }
    catch (err) {
        return disconnectOnError(socket, 'Could not parse query args. ' + err);
    }
    // Here, we just need to assign the args to the client somehow,
    // and retrieve them when iterating through

    // JSON.stringify doesn't guarantee key order!!!
    var room_name = JSON.stringify(args);
    increment_room(room_name);
    socket_util.validate_args(args).then(function () {
        // assign socket to room based on query arguments
        join_room(socket, room_name);
    }, function (err) {
        socket.emit('internal_error', err);
        socket.disconnect()
    });

    // decrement the correct property of the room object on disconnection
    socket.on('disconnect', function () {
        decrement_room(room_name);
    });
});

/**
 * 
 * @param {
 * network: string,
 * 
 * } args 
 */
function parseArgs(args) {

}

// server.listen(8081, function () {
//     winston.info("listening for clients on port 80 ==nginx==> 8081");
// });

/**
 * increment the room object and socket count
 * report performance data if requested
 *
 * @param: {String} room_name
 */
function increment_room(room_name) {
    if (rooms[room_name]) {
        rooms[room_name]++;
    }
    else {
        rooms[room_name] = 1;
    }
    socket_count++;
    if (process.env.PERFORMANCE_TEST.toUpperCase() == 'TRUE') {
        socket_util.log_performance(socket_count);
    }
}

/**
 * decrement the room object and socket count
 * report performance data if requested
 *
 * @param: {String} room_name
 */
function decrement_room(room_name) {
    if (rooms[room_name] > 1) {
        rooms[room_name]--;
    }
    else {
        delete rooms[room_name];
    }
    socket_count--;
    if (process.env.PERFORMANCE_TEST.toUpperCase() == 'TRUE') {
        socket_util.log_performance(socket_count);
    }
    console.log('rooms open:');
    console.log(rooms);
}

/**
 * join socket to room if there are not too many sockets already connected
 *
 * @param: {socket} socket
 * @param: {String} room_name
 */
function join_room(socket, room_name) {
    if (socket_count <= process.env.MAX_SOCKETS) {
        socket.join(room_name);
        console.log('rooms open:');
        console.log(rooms);
    }
    else {
        socket.emit('internal_error', {error: 'Server traffic is too high - cannot connect'});
        socket.disconnect();
        console.log('max sockets reached - client rejected')
    }
}