var http = require('http');
var express = require('express');

var socket_util = require('./socket_util');

var app = express();
var server = http.createServer(app);
var io = require('socket.io')(server);

var rooms = {};
var socket_count = 0;

io.on('connect', function (socket) {
    console.log(socket.handshake.query);
    // check if the client provides valid authentication
    if (socket.handshake.query.consumer_token) {
        if (socket.handshake.query.consumer_token == process.env.CONSUMER_TOKEN) {
            console.log('consumer connected');
            // pass filtered 'internal_data' messages from consumer app to 'data' messages received by sockets
            socket.on('internal_data', function (data) {
                Object.keys(rooms).forEach(function (room_name) {
                    if (socket_util.valid_data(data, room_name)) {
                        io.to(room_name).emit('data', data);
                    }
                });
            });
            socket.on('disconnect', function () {
                console.log('consumer disconnected')
            });
        }
        else {
            console.error('consumer_token authentication failed');
            socket.disconnect()
        }
    }
    else block: {
        try {
            var args = socket_util.parse_args(socket)
        }
        catch (err) {
            socket.emit('internal_error', 'Could not parse query args. ' + err);
            socket.disconnect();
            break block
        }
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
    }
});

server.listen(8081, function () {
    console.log("listening for clients on port 80 ==nginx==> 8081");
});

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
    if (process.env.PERFORMANCE_TEST == 'true') {
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
    if (process.env.PERFORMANCE_TEST == 'true') {
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
        socket.emit('internal_error', 'Server traffic is too high - cannot connect');
        socket.disconnect();
        console.log('max sockets reached - client rejected')
    }
}