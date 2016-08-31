var util = require('util');
var http = require('http');
var express = require('express');

var socket_util = require('./socket_util');

var app = express();
var server = http.createServer(app);
var io = require('socket.io')(server);

var rooms = {};
var socket_count = 0;

io.on('connect', function (socket) {
    if (socket.handshake.query.consumer_token) {
        if (socket.handshake.query.consumer_token == process.env.CONSUMER_TOKEN) {
            console.log('consumer connected');
            // pass filtered 'internal_data' messages from consumer app to 'data' messages received by sockets
            socket.on('internal_data', function (data) {
                var room_args;
                for (room_name in rooms) {
                    if (rooms.hasOwnProperty(room_name)) {
                        room_args = JSON.parse(room_name);
                        if (((!room_args.nodes) || (room_args.nodes.indexOf(data.node_id) > -1)) &&
                            ((!room_args.features_of_interest) || (room_args.features_of_interest.indexOf(data.feature_of_interest) > -1)) &&
                            ((!room_args.sensors) || (room_args.sensors.indexOf(data.sensor) > -1))) {
                            io.to(room_name).emit('data', data);
                        }
                    }
                }
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
        socket_util.validate_args(args).then(function (){
            if (socket_count < process.env.MAX_SOCKETS) {
                // add socket to a room based on its query arguments
                socket.join(JSON.stringify(args));
                if (rooms[JSON.stringify(args)]) {
                    rooms[JSON.stringify(args)]++;
                }
                else {
                    rooms[JSON.stringify(args)] = 1;
                }
                socket_count++;
                console.log('rooms open:');
                console.log(rooms);
                if (process.env.PERFORMANCE_TEST == 'true') {
                    socket_util.log_performance(socket_count);
                }
            }
            else {
                socket_count++;
                socket.emit('internal_error', 'Server traffic is too high - cannot connect');
                socket.disconnect();
                console.log('max sockets reached - client rejected')
            }
        }, function(err) {
            socket.emit('internal_error', err);
            socket.disconnect()
        });

        // decrement the correct property of the room object on disconnection
        socket.on('disconnect', function () {
            if (rooms[JSON.stringify(args)] > 1) {
                rooms[JSON.stringify(args)]--;
            }
            else {
                delete rooms[JSON.stringify(args)];
            }
            socket_count--;
            console.log('rooms open:');
            console.log(rooms);
            if (process.env.PERFORMANCE_TEST == 'true') {
                socket_util.log_performance(socket_count);
            }
        });
    }
});

server.listen(8081, function () {
    console.log("listening for clients on port 80 ==> 8081");
});
